-- Serial publishing support:
--  * get_chapter() only returns choices whose target chapter is published and
--    reports `continues_later` when a chapter's choices lead to chapters that
--    are not out yet (the reader shows «Үргэлжлэл удахгүй»).
--  * admin_import_story() merges partial JSON: on an existing story, fields
--    that are absent keep their value; choices may point to chapters that are
--    not written yet (a hidden draft placeholder is created and filled later).
--  * admin_export_story() returns a story as import-ready JSON.

drop function public.get_chapter_at(text, int);
drop function public.get_chapter(uuid);

-- The only way chapter text leaves the database. Read-only: it never starts
-- timers or writes anything, so link prefetches have no side effects.
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
  continues_later boolean
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
             'target_number', tc.number
           ) order by ch.position, ch.label), '[]'::jsonb)
      into choices
      from public.chapter_choices ch
      join public.chapters tc on tc.id = ch.target_chapter_id
     where ch.chapter_id = c.id
       and (v_admin or private.chapter_visible(tc.id));
    -- Serial publishing: choices exist but their chapters are not out yet.
    continues_later := choices = '[]'::jsonb and exists (
      select 1 from public.chapter_choices ch where ch.chapter_id = c.id
    );
  else
    content := private.preview_text(c.content);
    choices := null;
  end if;

  return next;
end;
$$;
grant execute on function public.get_chapter(uuid) to anon, authenticated;

-- Resolves /s/{slug}/{number} to a chapter id (unchanged).
-- One round trip for the reader route /s/{slug}/{number}.
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
  continues_later boolean
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
    insert into public.stories (slug, title, description, cover_url, genre, age_rating, price_coins, wait_free_hours, status)
    values (
      v_slug,
      p_story ->> 'title',
      coalesce(p_story ->> 'description', ''),
      nullif(p_story ->> 'cover_url', ''),
      coalesce(p_story ->> 'genre', 'other'),
      coalesce(p_story ->> 'age_rating', 'all'),
      nullif(p_story ->> 'price_coins', '')::int,
      nullif(p_story ->> 'wait_free_hours', '')::int,
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
      status = case when p_publish then 'published' else s.status end
    where s.id = v_story_id;
  end if;

  -- Chapters: upsert by (story_id, number). Placeholders become real here.
  for v_ch in select * from jsonb_array_elements(p_story -> 'chapters') loop
    insert into public.chapters as c (story_id, number, title, content, is_free, price_coins, is_ending, published_at)
    values (
      v_story_id,
      (v_ch ->> 'number')::int,
      v_ch ->> 'title',
      coalesce(v_ch ->> 'content', ''),
      coalesce((v_ch ->> 'free')::boolean, false),
      coalesce(nullif(v_ch ->> 'price_coins', '')::int, 40),
      coalesce((v_ch ->> 'ending')::boolean, false),
      case when p_publish then v_now else null end
    )
    on conflict (story_id, number) do update set
      title = excluded.title,
      content = excluded.content,
      is_free = excluded.is_free,
      price_coins = excluded.price_coins,
      is_ending = excluded.is_ending,
      published_at = coalesce(c.published_at, excluded.published_at);
    v_numbers := v_numbers || (v_ch ->> 'number')::int;
  end loop;

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
        insert into public.chapter_choices (chapter_id, label, target_chapter_id, position)
        values (v_chapter_id, v_choice ->> 'label', v_target, v_pos);
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

-- Import-ready JSON of a story (admin only), for editing and re-importing.
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
    'cover_url', s.cover_url,
    'chapters', coalesce((
      select jsonb_agg(
        jsonb_strip_nulls(jsonb_build_object(
          'number', c.number, 'title', c.title,
          'free', case when c.is_free then true end,
          'price_coins', case when c.price_coins <> 40 then c.price_coins end,
          'ending', case when c.is_ending then true end,
          'draft', case when c.published_at is null then true end,
          'content', c.content,
          'choices', (
            select jsonb_agg(jsonb_build_object('label', ch.label, 'goto', t.number) order by ch.position)
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
