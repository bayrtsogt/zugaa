-- Reading app content: stories, chapters, choices, progress, unlocks, access.

create table public.stories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  title text not null check (char_length(title) between 1 and 200),
  description text not null default '',
  cover_url text,
  cover_color text not null default '#3b2a2a' check (cover_color ~ '^#[0-9a-fA-F]{6}$'),
  genre text not null default 'other' check (genre in ('horror', 'thriller', 'mystery', 'romance', 'other')),
  age_rating text not null default 'all' check (age_rating in ('all', '16', '18')),
  status text not null default 'draft' check (status in ('draft', 'published')),
  price_coins int check (price_coins > 0),
  wait_free_hours int check (wait_free_hours > 0),
  created_at timestamptz not null default now(),
  published_at timestamptz
);
create index stories_published_idx on public.stories (published_at desc) where status = 'published';
alter table public.stories enable row level security;

alter table public.products
  add constraint products_story_fk foreign key (story_id) references public.stories (id) on delete cascade;

create function private.stories_set_published_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'published' and new.published_at is null then
    new.published_at := now();
  end if;
  return new;
end;
$$;
create trigger stories_published_at
  before insert or update of status on public.stories
  for each row execute function private.stories_set_published_at();

create function private.story_visible(p_story_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.stories s
    where s.id = p_story_id and s.status = 'published' and s.published_at <= now()
  );
$$;
grant execute on function private.story_visible(uuid) to anon, authenticated, service_role;

revoke all on table public.stories from anon, authenticated;
grant select on table public.stories to anon, authenticated;
grant insert, update, delete on table public.stories to authenticated;

create policy "stories: read published"
  on public.stories for select to anon, authenticated
  using ((status = 'published' and published_at <= now()) or (select private.is_admin()));
create policy "stories: admin insert"
  on public.stories for insert to authenticated
  with check ((select private.is_admin()));
create policy "stories: admin update"
  on public.stories for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "stories: admin delete"
  on public.stories for delete to authenticated
  using ((select private.is_admin()));

-------------------------------------------------------------------------------
-- chapters
--
-- `content` is NOT selectable by anon/authenticated (column privileges). Text
-- is served only by get_chapter(), which enforces has_access().
-------------------------------------------------------------------------------
create table public.chapters (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.stories (id) on delete cascade,
  number int not null check (number > 0),
  title text not null check (char_length(title) between 1 and 200),
  content text not null default '',
  is_free boolean not null default false,
  price_coins int not null default 40 check (price_coins > 0),
  -- Branching stories: an ending chapter shows "Төгсгөл" instead of "next".
  is_ending boolean not null default false,
  created_at timestamptz not null default now(),
  published_at timestamptz,
  unique (story_id, number)
);
create index chapters_published_idx on public.chapters (published_at desc);
alter table public.chapters enable row level security;

revoke all on table public.chapters from anon, authenticated;
grant select (id, story_id, number, title, is_free, price_coins, is_ending, created_at, published_at)
  on table public.chapters to anon, authenticated;
-- Admins write through RLS; UPDATE/INSERT privileges do not allow reading content.
grant insert, update, delete on table public.chapters to authenticated;

create policy "chapters: read published"
  on public.chapters for select to anon, authenticated
  using (
    (published_at <= now() and (select private.story_visible(story_id)))
    or (select private.is_admin())
  );
create policy "chapters: admin insert"
  on public.chapters for insert to authenticated
  with check ((select private.is_admin()));
create policy "chapters: admin update"
  on public.chapters for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "chapters: admin delete"
  on public.chapters for delete to authenticated
  using ((select private.is_admin()));

create function private.chapter_visible(p_chapter_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.chapters c
    where c.id = p_chapter_id and c.published_at <= now() and private.story_visible(c.story_id)
  );
$$;

-------------------------------------------------------------------------------
-- chapter_choices (branching). Served to readers via get_chapter only.
-------------------------------------------------------------------------------
create table public.chapter_choices (
  id uuid primary key default gen_random_uuid(),
  chapter_id uuid not null references public.chapters (id) on delete cascade,
  label text not null check (char_length(label) between 1 and 200),
  target_chapter_id uuid not null references public.chapters (id) on delete cascade,
  position int not null default 0
);
create index chapter_choices_chapter_idx on public.chapter_choices (chapter_id, position);
alter table public.chapter_choices enable row level security;
revoke all on table public.chapter_choices from anon, authenticated;
grant select, insert, update, delete on table public.chapter_choices to authenticated;
create policy "chapter_choices: admin all"
  on public.chapter_choices for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

-------------------------------------------------------------------------------
-- unlocks
-------------------------------------------------------------------------------
create table public.unlocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  story_id uuid not null references public.stories (id) on delete cascade,
  chapter_id uuid references public.chapters (id) on delete cascade, -- null = whole story
  method text not null check (method in ('coins', 'wait_free', 'free', 'purchase')),
  created_at timestamptz not null default now()
);
create unique index unlocks_user_chapter_uq on public.unlocks (user_id, chapter_id) where chapter_id is not null;
create unique index unlocks_user_story_uq on public.unlocks (user_id, story_id) where chapter_id is null;
alter table public.unlocks enable row level security;
revoke all on table public.unlocks from anon, authenticated;
grant select on table public.unlocks to authenticated;
create policy "unlocks: read own"
  on public.unlocks for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));

-------------------------------------------------------------------------------
-- wait-free timers: one running timer per user per story.
-------------------------------------------------------------------------------
create table public.wait_free_timers (
  user_id uuid not null references auth.users (id) on delete cascade,
  story_id uuid not null references public.stories (id) on delete cascade,
  chapter_id uuid not null references public.chapters (id) on delete cascade,
  started_at timestamptz not null default now(),
  primary key (user_id, story_id)
);
alter table public.wait_free_timers enable row level security;
revoke all on table public.wait_free_timers from anon, authenticated;
grant select on table public.wait_free_timers to authenticated;
create policy "wait_free_timers: read own"
  on public.wait_free_timers for select to authenticated
  using (user_id = (select auth.uid()));

-------------------------------------------------------------------------------
-- reading_progress
-------------------------------------------------------------------------------
create table public.reading_progress (
  user_id uuid not null references auth.users (id) on delete cascade,
  story_id uuid not null references public.stories (id) on delete cascade,
  chapter_id uuid not null references public.chapters (id) on delete cascade,
  scroll_pct numeric(5, 2) not null default 0 check (scroll_pct between 0 and 100),
  updated_at timestamptz not null default now(),
  primary key (user_id, story_id)
);
create index reading_progress_recent_idx on public.reading_progress (user_id, updated_at desc);
alter table public.reading_progress enable row level security;
revoke all on table public.reading_progress from anon, authenticated;
grant select, delete on table public.reading_progress to authenticated;
create policy "reading_progress: read own"
  on public.reading_progress for select to authenticated
  using (user_id = (select auth.uid()));
create policy "reading_progress: delete own"
  on public.reading_progress for delete to authenticated
  using (user_id = (select auth.uid()));

-------------------------------------------------------------------------------
-- Access
-------------------------------------------------------------------------------

-- has_access(user, chapter) = free OR active subscription OR unlock (chapter or
-- whole story) OR this chapter's wait-free timer has elapsed.
create function public.has_access(p_user uuid, p_chapter_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select
      c.is_free
      or (
        p_user is not null
        and (
          private.active_subscription_until(p_user, 'read') is not null
          or exists (
            select 1 from public.unlocks u
            where u.user_id = p_user
              and (u.chapter_id = c.id or (u.story_id = c.story_id and u.chapter_id is null))
          )
          or exists (
            select 1 from public.wait_free_timers t
            where t.user_id = p_user
              and t.chapter_id = c.id
              and s.wait_free_hours is not null
              and t.started_at + make_interval(hours => s.wait_free_hours) <= now()
          )
        )
      )
    from public.chapters c
    join public.stories s on s.id = c.story_id
    where c.id = p_chapter_id
  ), false);
$$;
-- Internal: takes an arbitrary user id, so not callable by clients.
revoke execute on function public.has_access(uuid, uuid) from public, anon, authenticated;
grant execute on function public.has_access(uuid, uuid) to service_role;

-- Locked chapters get a short preview: at most ~600 chars and never more than
-- 40% of the chapter, cut back to a word boundary.
create function private.preview_text(p_content text)
returns text
language sql
immutable
set search_path = ''
as $$
  select btrim(regexp_replace(
    left(p_content, least(600, floor(char_length(p_content) * 0.4)::int)),
    '\s+\S*$', ''
  ));
$$;

-- Age gate for 18+ stories. Returns null when the user may read.
create function private.age_gate(p_user uuid, p_age_rating text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_age_rating <> '18' then null
    when p_user is null then 'login_required'
    when private.is_admin(p_user) then null
    when (select birth_year from public.profiles where id = p_user) is null then 'birth_year_required'
    when not private.is_adult(p_user) then 'underage'
    else null
  end;
$$;

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
  wait_free_available boolean
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
  wait_free_hours := s.wait_free_hours; wait_free_available := false;

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
     where ch.chapter_id = c.id;
  else
    content := private.preview_text(c.content);
    choices := null;
  end if;

  return next;
end;
$$;
grant execute on function public.get_chapter(uuid) to anon, authenticated;

-- Starts the wait-free timer for a locked chapter the reader is looking at.
-- Called by the lock screen after it is actually displayed. One running timer
-- per user per story; an elapsed timer becomes a permanent unlock first.
create function public.start_wait_free(p_chapter_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  c public.chapters%rowtype;
  s public.stories%rowtype;
  t public.wait_free_timers%rowtype;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  select * into c from public.chapters ch where ch.id = p_chapter_id;
  if not found or not private.chapter_visible(c.id) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  select * into s from public.stories st where st.id = c.story_id;
  if s.wait_free_hours is null or c.is_free or private.age_gate(v_uid, s.age_rating) is not null then
    return null;
  end if;

  perform private.lock_wallet(v_uid); -- serialise per user

  select * into t from public.wait_free_timers w where w.user_id = v_uid and w.story_id = s.id;
  if found then
    if t.started_at + make_interval(hours => s.wait_free_hours) <= now() then
      insert into public.unlocks (user_id, story_id, chapter_id, method)
      values (v_uid, s.id, t.chapter_id, 'wait_free') on conflict do nothing;
      delete from public.wait_free_timers w where w.user_id = v_uid and w.story_id = s.id;
    elsif exists (select 1 from public.unlocks u
                   where u.user_id = v_uid
                     and (u.chapter_id = t.chapter_id or (u.story_id = s.id and u.chapter_id is null))) then
      delete from public.wait_free_timers w where w.user_id = v_uid and w.story_id = s.id;
    elsif t.chapter_id = c.id then
      return t.started_at + make_interval(hours => s.wait_free_hours);
    else
      return null; -- another chapter's timer is running
    end if;
  end if;

  if public.has_access(v_uid, c.id) then
    return null;
  end if;

  insert into public.wait_free_timers (user_id, story_id, chapter_id)
  values (v_uid, s.id, c.id)
  returning * into t;
  return t.started_at + make_interval(hours => s.wait_free_hours);
end;
$$;
grant execute on function public.start_wait_free(uuid) to authenticated;

-- Resolves /s/{slug}/{number} to a chapter id (ids only, no content).
create function public.get_chapter_id(p_slug text, p_number int)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select c.id
  from public.chapters c
  join public.stories s on s.id = c.story_id
  where s.slug = p_slug and c.number = p_number;
$$;
grant execute on function public.get_chapter_id(text, int) to anon, authenticated;

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
  wait_free_available boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select g.* from public.get_chapter(public.get_chapter_id(p_slug, p_number)) g;
$$;
grant execute on function public.get_chapter_at(text, int) to anon, authenticated;

-- Chapter list with per-user lock state for the story page.
create function public.get_story_chapters(p_story_id uuid)
returns table (
  id uuid,
  number int,
  title text,
  is_free boolean,
  price_coins int,
  is_ending boolean,
  published_at timestamptz,
  has_access boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.number, c.title, c.is_free, c.price_coins, c.is_ending, c.published_at,
         private.is_admin(auth.uid()) or public.has_access(auth.uid(), c.id)
  from public.chapters c
  where c.story_id = p_story_id
    and (
      (c.published_at <= now() and private.story_visible(c.story_id))
      or private.is_admin(auth.uid())
    )
  order by c.number;
$$;
grant execute on function public.get_story_chapters(uuid) to anon, authenticated;

-------------------------------------------------------------------------------
-- Unlocking with coins. Atomic and idempotent: the wallet row is locked first,
-- so concurrent calls for the same user serialise and the second one sees the
-- unlock and returns 'already' without charging.
-------------------------------------------------------------------------------
create function private.lock_wallet(p_user uuid)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare v_balance int;
begin
  insert into public.wallets (user_id) values (p_user) on conflict (user_id) do nothing;
  select balance_coins into v_balance from public.wallets where user_id = p_user for update;
  return v_balance;
end;
$$;

create function public.unlock_chapter(p_chapter_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  c public.chapters%rowtype;
  s public.stories%rowtype;
  v_balance int;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  select * into c from public.chapters ch where ch.id = p_chapter_id;
  if not found or not private.chapter_visible(c.id) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  select * into s from public.stories st where st.id = c.story_id;
  if private.age_gate(v_uid, s.age_rating) is not null then
    raise exception 'age_restricted' using errcode = '42501';
  end if;

  v_balance := private.lock_wallet(v_uid);

  if public.has_access(v_uid, c.id) then
    return jsonb_build_object('status', 'already', 'balance', v_balance);
  end if;

  update public.wallets
     set balance_coins = balance_coins - c.price_coins, updated_at = now()
   where user_id = v_uid and balance_coins >= c.price_coins
  returning balance_coins into v_balance;

  if not found then
    return jsonb_build_object('status', 'insufficient', 'balance',
      (select balance_coins from public.wallets where user_id = v_uid), 'price', c.price_coins);
  end if;

  insert into public.wallet_transactions (user_id, delta_coins, reason, app, ref_id)
  values (v_uid, -c.price_coins, 'unlock_chapter', 'read', c.id::text);
  insert into public.unlocks (user_id, story_id, chapter_id, method)
  values (v_uid, c.story_id, c.id, 'coins');
  delete from public.wait_free_timers w where w.user_id = v_uid and w.chapter_id = c.id;

  return jsonb_build_object('status', 'unlocked', 'balance', v_balance);
end;
$$;
grant execute on function public.unlock_chapter(uuid) to authenticated;

create function public.unlock_story(p_story_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  s public.stories%rowtype;
  v_balance int;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  select * into s from public.stories st where st.id = p_story_id;
  if not found or not private.story_visible(s.id) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if s.price_coins is null then
    raise exception 'not_for_sale' using errcode = 'P0001';
  end if;
  if private.age_gate(v_uid, s.age_rating) is not null then
    raise exception 'age_restricted' using errcode = '42501';
  end if;

  v_balance := private.lock_wallet(v_uid);

  if exists (select 1 from public.unlocks u where u.user_id = v_uid and u.story_id = s.id and u.chapter_id is null) then
    return jsonb_build_object('status', 'already', 'balance', v_balance);
  end if;

  update public.wallets
     set balance_coins = balance_coins - s.price_coins, updated_at = now()
   where user_id = v_uid and balance_coins >= s.price_coins
  returning balance_coins into v_balance;

  if not found then
    return jsonb_build_object('status', 'insufficient', 'balance',
      (select balance_coins from public.wallets where user_id = v_uid), 'price', s.price_coins);
  end if;

  insert into public.wallet_transactions (user_id, delta_coins, reason, app, ref_id)
  values (v_uid, -s.price_coins, 'unlock_story', 'read', s.id::text);
  insert into public.unlocks (user_id, story_id, chapter_id, method)
  values (v_uid, s.id, null, 'coins');
  delete from public.wait_free_timers w where w.user_id = v_uid and w.story_id = s.id;

  return jsonb_build_object('status', 'unlocked', 'balance', v_balance);
end;
$$;
grant execute on function public.unlock_story(uuid) to authenticated;

-------------------------------------------------------------------------------
-- Reading progress (debounced from the reader).
-------------------------------------------------------------------------------
create function public.save_reading_progress(p_chapter_id uuid, p_scroll_pct numeric)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_story uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  select c.story_id into v_story from public.chapters c
   where c.id = p_chapter_id and private.chapter_visible(c.id);
  if v_story is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  insert into public.reading_progress (user_id, story_id, chapter_id, scroll_pct, updated_at)
  values (v_uid, v_story, p_chapter_id, greatest(0, least(100, coalesce(p_scroll_pct, 0))), now())
  on conflict (user_id, story_id) do update
    set chapter_id = excluded.chapter_id, scroll_pct = excluded.scroll_pct, updated_at = now();
end;
$$;
grant execute on function public.save_reading_progress(uuid, numeric) to authenticated;
