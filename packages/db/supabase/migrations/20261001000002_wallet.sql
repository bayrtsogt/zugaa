-- App-agnostic wallet layer: products, wallets, transactions, subscriptions.
-- Shared by every Зугаа mini app; `app` columns say which app a row belongs to.

create table public.products (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  kind text not null check (kind in ('coin_pack', 'subscription', 'story')),
  app text not null default 'all',
  title text not null,
  description text,
  price_mnt int not null check (price_mnt > 0),
  coins int check (coins > 0),
  duration_days int check (duration_days > 0),
  story_id uuid, -- FK added in the content migration
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint products_kind_fields check (
    (kind = 'coin_pack' and coins is not null)
    or (kind = 'subscription' and duration_days is not null)
    or (kind = 'story' and story_id is not null)
  )
);
alter table public.products enable row level security;
revoke all on table public.products from anon, authenticated;
grant select on table public.products to anon, authenticated;
grant insert, update, delete on table public.products to authenticated;

create policy "products: read active"
  on public.products for select to anon, authenticated
  using (active or (select private.is_admin()));
create policy "products: admin insert"
  on public.products for insert to authenticated
  with check ((select private.is_admin()));
create policy "products: admin update"
  on public.products for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "products: admin delete"
  on public.products for delete to authenticated
  using ((select private.is_admin()));

-------------------------------------------------------------------------------
create table public.wallets (
  user_id uuid primary key references auth.users (id) on delete cascade,
  balance_coins int not null default 0 check (balance_coins >= 0),
  updated_at timestamptz not null default now()
);
alter table public.wallets enable row level security;
revoke all on table public.wallets from anon, authenticated;
grant select on table public.wallets to authenticated;
create policy "wallets: read own"
  on public.wallets for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));

-------------------------------------------------------------------------------
create table public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  delta_coins int not null check (delta_coins <> 0),
  reason text not null check (reason in ('topup', 'unlock_chapter', 'unlock_story', 'admin_adjust')),
  app text not null default 'all',
  ref_id text,
  note text,
  created_at timestamptz not null default now()
);
create index wallet_transactions_user_idx on public.wallet_transactions (user_id, created_at desc);
alter table public.wallet_transactions enable row level security;
revoke all on table public.wallet_transactions from anon, authenticated;
grant select on table public.wallet_transactions to authenticated;
create policy "wallet_transactions: read own"
  on public.wallet_transactions for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));

-------------------------------------------------------------------------------
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  product_id uuid references public.products (id),
  scope text not null default 'all',
  starts_at timestamptz not null,
  expires_at timestamptz not null,
  payment_request_id uuid, -- FK added in the payments migration
  created_at timestamptz not null default now(),
  constraint subscriptions_range check (expires_at > starts_at)
);
create index subscriptions_user_idx on public.subscriptions (user_id, expires_at desc);
alter table public.subscriptions enable row level security;
revoke all on table public.subscriptions from anon, authenticated;
grant select on table public.subscriptions to authenticated;
create policy "subscriptions: read own"
  on public.subscriptions for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));

-- Active subscription covering `p_app` (scope 'all' covers every app).
create function private.active_subscription_until(p_user uuid, p_app text default 'all')
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select max(s.expires_at)
  from public.subscriptions s
  where s.user_id = p_user
    and (s.scope = 'all' or s.scope = p_app)
    and s.starts_at <= now()
    and s.expires_at > now();
$$;
grant execute on function private.active_subscription_until(uuid, text) to authenticated, service_role;

-- Value of one coin in MNT. Kept in SQL so the nudge and pricing agree.
create function private.coin_value_mnt()
returns int language sql immutable as $$ select 10 $$;

-------------------------------------------------------------------------------
-- New user bootstrap: profile + empty wallet.
-------------------------------------------------------------------------------
create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    nullif(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)), '')
  )
  on conflict (id) do nothing;

  insert into public.wallets (user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-------------------------------------------------------------------------------
-- Admin manual coin adjustment (admin session only).
-------------------------------------------------------------------------------
create function public.admin_adjust_coins(p_user_id uuid, p_delta int, p_reason text)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_balance int;
begin
  if not private.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_delta = 0 then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;
  if coalesce(btrim(p_reason), '') = '' then
    raise exception 'reason_required' using errcode = '22023';
  end if;

  insert into public.wallets (user_id) values (p_user_id) on conflict (user_id) do nothing;

  update public.wallets
     set balance_coins = balance_coins + p_delta, updated_at = now()
   where user_id = p_user_id
     and balance_coins + p_delta >= 0
  returning balance_coins into v_balance;

  if v_balance is null then
    raise exception 'insufficient_balance' using errcode = 'P0001';
  end if;

  insert into public.wallet_transactions (user_id, delta_coins, reason, app, note)
  values (p_user_id, p_delta, 'admin_adjust', 'all', p_reason);

  insert into public.audit_log (actor, actor_user_id, action, entity, entity_id, data)
  values ('admin', auth.uid(), 'wallet.adjust', 'wallet', p_user_id::text,
          jsonb_build_object('delta', p_delta, 'reason', p_reason, 'balance', v_balance));

  return v_balance;
end;
$$;
grant execute on function public.admin_adjust_coins(uuid, int, text) to authenticated;
