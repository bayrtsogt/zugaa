-- Images and retention:
--  * `media` storage bucket (public read, admin write) for story covers,
--    chapter images and choice images; image_url columns on chapters/choices.
--  * stories.ongoing: a serial still being written. The last published
--    chapter then ends with «Үргэлжлэл удахгүй» instead of «Төгсгөл».
--  * follows: readers follow stories (button, or automatically when they start
--    reading an ongoing one); in-app «new chapters» and Telegram notifications.
--  * telegram_links: a reader links their Telegram chat through the bot
--    (/start <one-time token>) to get new-chapter messages.

-------------------------------------------------------------------------------
-- Storage
-------------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 5242880, array['image/webp', 'image/jpeg', 'image/png', 'image/gif'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "media: admin insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and (select private.is_admin()));
create policy "media: admin update" on storage.objects for update to authenticated
  using (bucket_id = 'media' and (select private.is_admin()))
  with check (bucket_id = 'media' and (select private.is_admin()));
create policy "media: admin delete" on storage.objects for delete to authenticated
  using (bucket_id = 'media' and (select private.is_admin()));
-- Public bucket: files are served by URL without a select policy (no listing).

-------------------------------------------------------------------------------
-- Columns
-------------------------------------------------------------------------------
alter table public.stories add column ongoing boolean not null default false;

alter table public.chapters add column image_url text
  check (image_url is null or (image_url ~ '^https?://' and char_length(image_url) <= 1000));
-- Shown as a teaser even on a locked chapter, like the title.
grant select (image_url) on table public.chapters to anon, authenticated;

alter table public.chapter_choices add column image_url text
  check (image_url is null or (image_url ~ '^https?://' and char_length(image_url) <= 1000));

-------------------------------------------------------------------------------
-- follows
-------------------------------------------------------------------------------
create table public.follows (
  user_id uuid not null references auth.users (id) on delete cascade,
  story_id uuid not null references public.stories (id) on delete cascade,
  created_at timestamptz not null default now(),
  -- New chapters after this are «new» in the app (bumped when the reader reads the story).
  seen_at timestamptz not null default now(),
  -- New chapters after this have not been sent to Telegram yet.
  notified_at timestamptz not null default now(),
  primary key (user_id, story_id)
);
create index follows_story_idx on public.follows (story_id);
alter table public.follows enable row level security;
revoke all on table public.follows from anon, authenticated;
grant select, delete on table public.follows to authenticated;
grant insert (user_id, story_id) on table public.follows to authenticated;
create policy "follows: read own" on public.follows for select to authenticated
  using (user_id = (select auth.uid()));
create policy "follows: add own" on public.follows for insert to authenticated
  with check (user_id = (select auth.uid()) and (select private.story_visible(story_id)));
create policy "follows: remove own" on public.follows for delete to authenticated
  using (user_id = (select auth.uid()));

-- Reading a story marks its chapters seen; starting an ongoing story follows it.
create function private.follow_on_progress()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' and exists (select 1 from public.stories s where s.id = new.story_id and s.ongoing) then
    insert into public.follows (user_id, story_id) values (new.user_id, new.story_id)
    on conflict do nothing;
  end if;
  update public.follows f set seen_at = now()
   where f.user_id = new.user_id and f.story_id = new.story_id;
  return new;
end;
$$;
create trigger reading_progress_follow
  after insert or update on public.reading_progress
  for each row execute function private.follow_on_progress();

-- Followed stories with chapters published since the reader last read them.
create function public.my_story_updates()
returns table (story_id uuid, slug text, title text, cover_url text, genre text,
               new_chapters int, first_new_number int, first_new_title text)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.slug, s.title, s.cover_url, s.genre,
         count(*)::int,
         (array_agg(c.number order by c.number))[1],
         (array_agg(c.title order by c.number))[1]
    from public.follows f
    join public.stories s on s.id = f.story_id
    join public.chapters c on c.story_id = s.id
   where f.user_id = auth.uid()
     and private.story_visible(s.id)
     and c.published_at <= now() and c.published_at > f.seen_at
   group by s.id, f.seen_at
   order by max(c.published_at) desc
   limit 20;
$$;
grant execute on function public.my_story_updates() to authenticated;

-------------------------------------------------------------------------------
-- Telegram notifications
-------------------------------------------------------------------------------
create table public.telegram_links (
  user_id uuid primary key references auth.users (id) on delete cascade,
  chat_id bigint not null unique,
  linked_at timestamptz not null default now()
);
alter table public.telegram_links enable row level security;
revoke all on table public.telegram_links from anon, authenticated;
grant select, delete on table public.telegram_links to authenticated;
create policy "telegram_links: read own" on public.telegram_links for select to authenticated
  using (user_id = (select auth.uid()));
create policy "telegram_links: remove own" on public.telegram_links for delete to authenticated
  using (user_id = (select auth.uid()));

create table private.telegram_link_tokens (
  token text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  expires_at timestamptz not null
);

-- One-time token for t.me/<bot>?start=<token> (15 minutes).
create function public.create_telegram_link_token()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_token text := replace(gen_random_uuid()::text, '-', '');
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  delete from private.telegram_link_tokens where user_id = v_uid or expires_at < now();
  insert into private.telegram_link_tokens (token, user_id, expires_at)
  values (v_token, v_uid, now() + interval '15 minutes');
  return v_token;
end;
$$;
grant execute on function public.create_telegram_link_token() to authenticated;

-- Called by the bot webhook (service role) on "/start <token>".
create function public.link_telegram(p_token text, p_chat_id bigint)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid;
begin
  if not private.is_service_role() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  delete from private.telegram_link_tokens t
   where t.token = p_token and t.expires_at > now()
  returning t.user_id into v_uid;
  if v_uid is null then
    return false;
  end if;
  delete from public.telegram_links where chat_id = p_chat_id and user_id <> v_uid;
  insert into public.telegram_links (user_id, chat_id) values (v_uid, p_chat_id)
  on conflict (user_id) do update set chat_id = excluded.chat_id, linked_at = now();
  return true;
end;
$$;
revoke execute on function public.link_telegram(text, bigint) from public, anon, authenticated;
grant execute on function public.link_telegram(text, bigint) to service_role;

-- "/stop" in the bot.
create function public.unlink_telegram_chat(p_chat_id bigint)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_service_role() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  delete from public.telegram_links where chat_id = p_chat_id;
  return found;
end;
$$;
revoke execute on function public.unlink_telegram_chat(bigint) from public, anon, authenticated;
grant execute on function public.unlink_telegram_chat(bigint) to service_role;

-- Followers of a story with Telegram linked and unsent new chapters. Claims
-- them (notified_at = now()) in the same statement so a message is sent once.
create function public.claim_chapter_notifications(p_story_id uuid)
returns table (chat_id bigint, story_slug text, story_title text, new_chapters int,
               first_new_number int, first_new_title text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (private.is_service_role() or private.is_admin()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not private.story_visible(p_story_id) then
    return;
  end if;
  return query
  with due as (
    select f.user_id, f.notified_at,
           count(*)::int as n,
           (array_agg(c.number order by c.number))[1] as first_number,
           (array_agg(c.title order by c.number))[1] as first_title
      from public.follows f
      join public.telegram_links l on l.user_id = f.user_id
      join public.chapters c on c.story_id = f.story_id
     where f.story_id = p_story_id
       and c.published_at <= now() and c.published_at > f.notified_at
     group by f.user_id, f.notified_at
  ), claimed as (
    update public.follows f set notified_at = now()
      from due
     where f.user_id = due.user_id and f.story_id = p_story_id and f.notified_at = due.notified_at
    returning f.user_id
  )
  select l.chat_id, s.slug, s.title, due.n, due.first_number, due.first_title
    from claimed
    join due on due.user_id = claimed.user_id
    join public.telegram_links l on l.user_id = claimed.user_id
    join public.stories s on s.id = p_story_id;
end;
$$;
revoke execute on function public.claim_chapter_notifications(uuid) from public, anon;
grant execute on function public.claim_chapter_notifications(uuid) to authenticated, service_role;

-------------------------------------------------------------------------------
-- Reader / import / export carry the new fields
-------------------------------------------------------------------------------
drop function public.get_chapter_at(text, int);
drop function public.get_chapter(uuid);

create function public.get_chapter(p_chapter_id uuid)
returns table (
  id uuid,
  story_id uuid,
  story_slug text,
  story_title text,
  story_price_coins int,
  number int,
  title text,
  content text,
  locked boolean,
  gate text,
  is_free boolean,
  price_coins int,
  is_ending boolean,
  prev_number int,
  next_number int,
  choices jsonb,
  wait_free_hours int,
  wait_free_ends_at timestamptz,
  wait_free_other_chapter int,
  wait_free_available boolean,
  continues_later boolean,
  image_url text,
  story_ongoing boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
  v_admin boolean := private.is_admin(v_uid);
  c public.chapters%rowtype;
  s public.stories%rowtype;
  t public.wait_free_timers%rowtype;
  v_gate text;
  v_access boolean := false;
begin
  select * into c from public.chapters ch where ch.id = p_chapter_id;
  if not found then return; end if;
  select * into s from public.stories st where st.id = c.story_id;
  if not v_admin and not private.chapter_visible(c.id) then return; end if;

  id := c.id; story_id := s.id; story_slug := s.slug; story_title := s.title;
  story_price_coins := s.price_coins; number := c.number; title := c.title;
  is_free := c.is_free; price_coins := c.price_coins; is_ending := c.is_ending;
  wait_free_hours := s.wait_free_hours; wait_free_available := false; continues_later := false;
  image_url := c.image_url; story_ongoing := s.ongoing;

  select max(x.number) into prev_number from public.chapters x
   where x.story_id = s.id and x.number < c.number and (v_admin or x.published_at <= now());
  select min(x.number) into next_number from public.chapters x
   where x.story_id = s.id and x.number > c.number and (v_admin or x.published_at <= now());

  v_gate := case when v_admin then null else private.age_gate(v_uid, s.age_rating) end;
  gate := v_gate;
  if v_gate is not null then
    content := null; locked := true; choices := null;
    return next; return;
  end if;

  v_access := v_admin or public.has_access(v_uid, c.id);

  if not v_access and v_uid is not null and s.wait_free_hours is not null then
    select * into t from public.wait_free_timers w where w.user_id = v_uid and w.story_id = s.id;
    if t.chapter_id = c.id then
      wait_free_ends_at := t.started_at + make_interval(hours => s.wait_free_hours);
    elsif t.chapter_id is not null and not public.has_access(v_uid, t.chapter_id) then
      -- Another chapter's timer is still running.
      select x.number into wait_free_other_chapter from public.chapters x where x.id = t.chapter_id;
    else
      wait_free_available := true;
    end if;
  end if;

  locked := not v_access;
  if v_access then
    content := c.content;
    select coalesce(jsonb_agg(jsonb_build_object(
             'label', ch.label,
             'target_number', tc.number,
             'image_url', ch.image_url
           ) order by ch.position, ch.label), '[]'::jsonb)
      into choices
      from public.chapter_choices ch
      join public.chapters tc on tc.id = ch.target_chapter_id
     where ch.chapter_id = c.id
       and (v_admin or private.chapter_visible(tc.id));
    -- Serial publishing: choices exist but their chapters are not out yet.
    -- Ongoing story: the last published chapter is not an ending.
    continues_later := choices = '[]'::jsonb and (
      exists (select 1 from public.chapter_choices ch where ch.chapter_id = c.id)
      or (s.ongoing and not c.is_ending and next_number is null)
    );
  else
    content := private.preview_text(c.content);
    choices := null;
  end if;

  return next;
end;
$$;
grant execute on function public.get_chapter(uuid) to anon, authenticated;

create function public.get_chapter_at(p_slug text, p_number int)
returns table (
  id uuid,
  story_id uuid,
  story_slug text,
  story_title text,
  story_price_coins int,
  number int,
  title text,
  content text,
  locked boolean,
  gate text,
  is_free boolean,
  price_coins int,
  is_ending boolean,
  prev_number int,
  next_number int,
  choices jsonb,
  wait_free_hours int,
  wait_free_ends_at timestamptz,
  wait_free_other_chapter int,
  wait_free_available boolean,
  continues_later boolean,
  image_url text,
  story_ongoing boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select g.* from public.get_chapter(public.get_chapter_id(p_slug, p_number)) g;
$$;
grant execute on function public.get_chapter_at(text, int) to anon, authenticated;

drop function public.admin_import_story(jsonb, boolean);

create function public.admin_import_story(p_story jsonb, p_publish boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_story_id uuid;
  v_created boolean := false;
  v_ch jsonb;
  v_choice jsonb;
  v_numbers int[] := '{}';
  v_chapter_id uuid;
  v_target uuid;
  v_choices int := 0;
  v_placeholders int := 0;
  v_pos int;
  v_now timestamptz := now();
  v_slug text := p_story ->> 'slug';
  v_old_images jsonb;
  v_img text;
begin
  if not private.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if coalesce(v_slug, '') = '' then
    raise exception 'slug_required' using errcode = '22023';
  end if;
  if jsonb_typeof(p_story -> 'chapters') <> 'array' or jsonb_array_length(p_story -> 'chapters') = 0 then
    raise exception 'chapters_required' using errcode = '22023';
  end if;

  select id into v_story_id from public.stories where slug = v_slug;
  if v_story_id is null then
    if coalesce(p_story ->> 'title', '') = '' then
      raise exception 'title_required: % гэсэн өгүүллэг байхгүй тул гарчиг заавал', v_slug using errcode = '22023';
    end if;
    insert into public.stories (slug, title, description, cover_url, genre, age_rating, price_coins, wait_free_hours, ongoing, status)
    values (
      v_slug,
      p_story ->> 'title',
      coalesce(p_story ->> 'description', ''),
      nullif(p_story ->> 'cover_url', ''),
      coalesce(p_story ->> 'genre', 'other'),
      coalesce(p_story ->> 'age_rating', 'all'),
      nullif(p_story ->> 'price_coins', '')::int,
      nullif(p_story ->> 'wait_free_hours', '')::int,
      coalesce((p_story ->> 'ongoing')::boolean, false),
      case when p_publish then 'published' else 'draft' end
    )
    returning id into v_story_id;
    v_created := true;
  else
    -- Merge: only keys present in the JSON change.
    update public.stories s set
      title = case when p_story ? 'title' and coalesce(p_story ->> 'title', '') <> '' then p_story ->> 'title' else s.title end,
      description = case when p_story ? 'description' then coalesce(p_story ->> 'description', '') else s.description end,
      cover_url = case when p_story ? 'cover_url' then nullif(p_story ->> 'cover_url', '') else s.cover_url end,
      genre = case when p_story ? 'genre' then p_story ->> 'genre' else s.genre end,
      age_rating = case when p_story ? 'age_rating' then p_story ->> 'age_rating' else s.age_rating end,
      price_coins = case when p_story ? 'price_coins' then nullif(p_story ->> 'price_coins', '')::int else s.price_coins end,
      wait_free_hours = case when p_story ? 'wait_free_hours' then nullif(p_story ->> 'wait_free_hours', '')::int else s.wait_free_hours end,
      ongoing = case when p_story ? 'ongoing' then coalesce((p_story ->> 'ongoing')::boolean, false) else s.ongoing end,
      status = case when p_publish then 'published' else s.status end
    where s.id = v_story_id;
  end if;

  -- Chapters: upsert by (story_id, number). Placeholders become real here.
  for v_ch in select * from jsonb_array_elements(p_story -> 'chapters') loop
    insert into public.chapters as c (story_id, number, title, content, is_free, price_coins, is_ending, image_url, published_at)
    values (
      v_story_id,
      (v_ch ->> 'number')::int,
      v_ch ->> 'title',
      coalesce(v_ch ->> 'content', ''),
      coalesce((v_ch ->> 'free')::boolean, false),
      coalesce(nullif(v_ch ->> 'price_coins', '')::int, 40),
      coalesce((v_ch ->> 'ending')::boolean, false),
      nullif(v_ch ->> 'image_url', ''),
      case when p_publish then v_now else null end
    )
    on conflict (story_id, number) do update set
      title = excluded.title,
      content = excluded.content,
      is_free = excluded.is_free,
      price_coins = excluded.price_coins,
      is_ending = excluded.is_ending,
      -- Images are usually uploaded in the admin after the text import: keep them unless the JSON sets the key.
      image_url = case when v_ch ? 'image_url' then excluded.image_url else c.image_url end,
      published_at = coalesce(c.published_at, excluded.published_at);
    v_numbers := v_numbers || (v_ch ->> 'number')::int;
  end loop;

  -- Choice images survive a re-import: remembered by "chapter:target".
  select coalesce(jsonb_object_agg(c.number || ':' || t.number, cc.image_url), '{}'::jsonb) into v_old_images
    from public.chapter_choices cc
    join public.chapters c on c.id = cc.chapter_id
    join public.chapters t on t.id = cc.target_chapter_id
   where c.story_id = v_story_id and c.number = any (v_numbers) and cc.image_url is not null;

  delete from public.chapter_choices cc
   using public.chapters c
   where cc.chapter_id = c.id and c.story_id = v_story_id and c.number = any (v_numbers);

  for v_ch in select * from jsonb_array_elements(p_story -> 'chapters') loop
    if jsonb_typeof(v_ch -> 'choices') = 'array' then
      select id into v_chapter_id from public.chapters
       where story_id = v_story_id and number = (v_ch ->> 'number')::int;
      v_pos := 0;
      for v_choice in select * from jsonb_array_elements(v_ch -> 'choices') loop
        select id into v_target from public.chapters
         where story_id = v_story_id and number = (v_choice ->> 'goto')::int;
        if v_target is null then
          -- Not written yet: hidden draft placeholder, filled by a later import.
          insert into public.chapters (story_id, number, title, content, published_at)
          values (v_story_id, (v_choice ->> 'goto')::int, 'Бичигдээгүй бүлэг', '', null)
          returning id into v_target;
          v_placeholders := v_placeholders + 1;
        end if;
        v_img := case when v_choice ? 'image_url' then nullif(v_choice ->> 'image_url', '')
                      else v_old_images ->> ((v_ch ->> 'number') || ':' || (v_choice ->> 'goto')) end;
        insert into public.chapter_choices (chapter_id, label, target_chapter_id, position, image_url)
        values (v_chapter_id, v_choice ->> 'label', v_target, v_pos, v_img);
        v_pos := v_pos + 1;
        v_choices := v_choices + 1;
      end loop;
    end if;
  end loop;

  insert into public.audit_log (actor, actor_user_id, action, entity, entity_id, data)
  values ('admin', auth.uid(), case when v_created then 'story.import_create' else 'story.import_update' end,
          'story', v_story_id::text,
          jsonb_build_object('slug', v_slug, 'chapters', v_numbers, 'choices', v_choices,
                             'placeholders', v_placeholders, 'published', p_publish));

  return jsonb_build_object('story_id', v_story_id, 'slug', v_slug, 'created', v_created,
                            'chapters', cardinality(v_numbers), 'choices', v_choices,
                            'placeholders', v_placeholders);
end;
$$;
grant execute on function public.admin_import_story(jsonb, boolean) to authenticated;

drop function public.admin_export_story(text);

create function public.admin_export_story(p_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  s public.stories%rowtype;
begin
  if not private.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into s from public.stories where slug = p_slug;
  if not found then
    return null;
  end if;
  return jsonb_build_object(
    'slug', s.slug, 'title', s.title, 'description', s.description, 'genre', s.genre,
    'age_rating', s.age_rating, 'price_coins', s.price_coins, 'wait_free_hours', s.wait_free_hours,
    'cover_url', s.cover_url, 'ongoing', s.ongoing,
    'chapters', coalesce((
      select jsonb_agg(
        jsonb_strip_nulls(jsonb_build_object(
          'number', c.number, 'title', c.title,
          'free', case when c.is_free then true end,
          'price_coins', case when c.price_coins <> 40 then c.price_coins end,
          'ending', case when c.is_ending then true end,
          'draft', case when c.published_at is null then true end,
          'image_url', c.image_url,
          'content', c.content,
          'choices', (
            select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('label', ch.label, 'goto', t.number, 'image_url', ch.image_url)) order by ch.position)
            from public.chapter_choices ch join public.chapters t on t.id = ch.target_chapter_id
            where ch.chapter_id = c.id
          )
        )) order by c.number)
      from public.chapters c where c.story_id = s.id
    ), '[]'::jsonb)
  );
end;
$$;
grant execute on function public.admin_export_story(text) to authenticated;
