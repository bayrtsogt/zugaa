-- Core: helper schema, profiles, audit log, rate limiting.
--
-- Security model
--  * Every table has RLS enabled.
--  * Supabase grants ALL on new public tables/functions to anon/authenticated by
--    default. We revoke that and grant exactly what each table needs.
--  * Business logic that touches money or access lives in SECURITY DEFINER
--    functions with an empty search_path; clients never write those tables.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to service_role;

-- Functions created from here on are not executable by anon/authenticated unless
-- granted explicitly.
alter default privileges in schema public revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from anon, authenticated;
alter default privileges in schema private revoke execute on functions from public;

-------------------------------------------------------------------------------
-- profiles
-------------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 80),
  birth_year int check (birth_year between 1900 and 2100),
  is_admin boolean not null default false,
  -- Hook for ДАН (national ID) verification later. Unused in v1.
  age_verified_at timestamptz,
  age_verification_method text check (age_verification_method in ('self_declared', 'dan')),
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

revoke all on table public.profiles from anon, authenticated;
grant select on table public.profiles to authenticated;
-- Users may only change these two columns; is_admin is never client-writable.
grant update (display_name, birth_year) on table public.profiles to authenticated;

-- Helpers in `private` are not exposed through the API.
create function private.is_admin(p_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select p.is_admin from public.profiles p where p.id = p_user), false);
$$;

create function private.is_service_role()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(auth.jwt() ->> 'role', '') = 'service_role';
$$;

-- Single place that decides whether a user may open 18+ content.
-- Self-declared birth year today; swap in ДАН verification here later.
create function private.is_adult(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select p.birth_year is not null
       and extract(year from (now() at time zone 'Asia/Ulaanbaatar'))::int - p.birth_year >= 18
    from public.profiles p
    where p.id = p_user
  ), false);
$$;

grant execute on function private.is_admin(uuid) to authenticated, service_role;
grant execute on function private.is_service_role() to authenticated, service_role;
grant execute on function private.is_adult(uuid) to authenticated, service_role;
grant usage on schema private to authenticated, anon;
grant execute on function private.is_service_role() to anon;

create policy "profiles: read own"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select private.is_admin()));

create policy "profiles: update own"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create function private.touch_birth_year()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.birth_year is distinct from old.birth_year then
    -- Self-declared birth year is asked once; only an admin may correct it.
    if old.birth_year is not null and not private.is_admin() and auth.uid() is not null then
      raise exception 'birth_year_locked' using errcode = '42501';
    end if;
    new.age_verified_at := now();
    new.age_verification_method := 'self_declared';
  end if;
  return new;
end;
$$;

create trigger profiles_birth_year
  before update of birth_year on public.profiles
  for each row execute function private.touch_birth_year();

-------------------------------------------------------------------------------
-- audit_log
-------------------------------------------------------------------------------
create table public.audit_log (
  id bigint generated always as identity primary key,
  actor text not null check (actor in ('user', 'admin', 'telegram', 'system', 'provider')),
  actor_user_id uuid references auth.users (id) on delete set null,
  actor_telegram_id bigint,
  action text not null,
  entity text not null,
  entity_id text,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_log_entity_idx on public.audit_log (entity, entity_id, created_at desc);
alter table public.audit_log enable row level security;
revoke all on table public.audit_log from anon, authenticated;
grant select on table public.audit_log to authenticated;

create policy "audit_log: admins read"
  on public.audit_log for select to authenticated
  using ((select private.is_admin()));

-------------------------------------------------------------------------------
-- Rate limiting (fixed window, shared across all Worker isolates)
-------------------------------------------------------------------------------
create table private.rate_limits (
  key text not null,
  window_start timestamptz not null,
  hits int not null default 0,
  primary key (key, window_start)
);

-- Returns true when the call is allowed. Server-only (service_role).
create function public.check_rate_limit(p_key text, p_max int, p_window_seconds int)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_window timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_hits int;
begin
  insert into private.rate_limits as r (key, window_start, hits)
  values (p_key, v_window, 1)
  on conflict (key, window_start) do update set hits = r.hits + 1
  returning hits into v_hits;

  -- Opportunistic cleanup of old windows.
  if random() < 0.01 then
    delete from private.rate_limits where window_start < now() - interval '1 day';
  end if;

  return v_hits <= p_max;
end;
$$;
revoke execute on function public.check_rate_limit(text, int, int) from public, anon, authenticated;
grant execute on function public.check_rate_limit(text, int, int) to service_role;
