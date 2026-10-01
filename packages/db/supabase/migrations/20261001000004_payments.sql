-- Payments: manual bank transfer approved via Telegram/admin panel.
-- approve_payment() is the single place that grants what a product gives;
-- a future QPay / byl.mn webhook calls the same function.

create table public.payment_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  product_id uuid not null references public.products (id),
  ref_code text not null unique,
  amount_mnt int not null check (amount_mnt > 0),
  status text not null default 'created'
    check (status in ('created', 'submitted', 'approved', 'rejected', 'expired')),
  provider text not null default 'manual' check (provider in ('manual', 'qpay', 'byl')),
  provider_ref text, -- external invoice / transaction id for gateway payments
  submitted_at timestamptz,
  decided_at timestamptz,
  decided_by_telegram_id bigint,
  decided_by_user_id uuid references auth.users (id) on delete set null,
  reject_reason text,
  telegram_chat_id bigint,
  telegram_message_id bigint,
  ebarimt_id text, -- e-receipt id, filled by a later integration
  created_at timestamptz not null default now()
);
create index payment_requests_user_idx on public.payment_requests (user_id, created_at desc);
create index payment_requests_open_idx on public.payment_requests (status, created_at)
  where status in ('created', 'submitted');
create unique index payment_requests_provider_ref_uq on public.payment_requests (provider, provider_ref)
  where provider_ref is not null;
create index payment_requests_tg_msg_idx on public.payment_requests (telegram_chat_id, telegram_message_id)
  where telegram_message_id is not null;

alter table public.payment_requests enable row level security;
revoke all on table public.payment_requests from anon, authenticated;
grant select on table public.payment_requests to authenticated;
create policy "payment_requests: read own"
  on public.payment_requests for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));

alter table public.subscriptions
  add constraint subscriptions_payment_request_fk
  foreign key (payment_request_id) references public.payment_requests (id) on delete set null;
create unique index subscriptions_payment_request_uq on public.subscriptions (payment_request_id)
  where payment_request_id is not null;

-------------------------------------------------------------------------------
-- Audit every state change.
-------------------------------------------------------------------------------
create function private.audit_payment_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor text;
begin
  if tg_op = 'INSERT' then
    insert into public.audit_log (actor, actor_user_id, action, entity, entity_id, data)
    values ('user', new.user_id, 'payment.created', 'payment_request', new.id::text,
            jsonb_build_object('ref_code', new.ref_code, 'amount_mnt', new.amount_mnt, 'product_id', new.product_id));
    return new;
  end if;

  if new.status is distinct from old.status then
    v_actor := case
      when new.status = 'expired' then 'system'
      when new.status in ('approved', 'rejected') and new.decided_by_telegram_id is not null then 'telegram'
      when new.status in ('approved', 'rejected') and new.decided_by_user_id is not null then 'admin'
      when new.status in ('approved', 'rejected') then 'provider'
      else 'user'
    end;
    insert into public.audit_log (actor, actor_user_id, actor_telegram_id, action, entity, entity_id, data)
    values (v_actor, coalesce(new.decided_by_user_id, auth.uid()), new.decided_by_telegram_id,
            'payment.' || new.status, 'payment_request', new.id::text,
            jsonb_build_object('from', old.status, 'to', new.status, 'ref_code', new.ref_code,
                               'reject_reason', new.reject_reason));
  elsif new.reject_reason is distinct from old.reject_reason then
    insert into public.audit_log (actor, actor_user_id, actor_telegram_id, action, entity, entity_id, data)
    values (case when new.decided_by_telegram_id is not null then 'telegram' else 'admin' end,
            new.decided_by_user_id, new.decided_by_telegram_id,
            'payment.reject_reason', 'payment_request', new.id::text,
            jsonb_build_object('reject_reason', new.reject_reason));
  end if;
  return new;
end;
$$;

create trigger payment_requests_audit
  after insert or update on public.payment_requests
  for each row execute function private.audit_payment_request();

-------------------------------------------------------------------------------
-- Expiry: unsubmitted requests expire after 24 h (pg_cron + lazy checks).
-------------------------------------------------------------------------------
create function private.expire_payment_requests(p_user uuid default null)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare v_count int;
begin
  update public.payment_requests
     set status = 'expired'
   where status = 'created'
     and created_at < now() - interval '24 hours'
     and (p_user is null or user_id = p_user);
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

do $$
begin
  create extension if not exists pg_cron;
  perform cron.schedule('zugaa-expire-payment-requests', '*/15 * * * *',
                        'select private.expire_payment_requests()');
exception when others then
  raise notice 'pg_cron unavailable (%); relying on lazy expiry', sqlerrm;
end;
$$;

-------------------------------------------------------------------------------
-- User: create a request. Price always comes from products.
-------------------------------------------------------------------------------
create function public.create_payment_request(p_product_code text)
returns public.payment_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  p public.products%rowtype;
  v_code text;
  v_attempt int := 0;
  v_row public.payment_requests%rowtype;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select * into p from public.products where code = p_product_code and active;
  if not found then
    raise exception 'product_not_found' using errcode = 'P0002';
  end if;

  -- Serialise per user so the open-request limit cannot be raced.
  perform private.lock_wallet(v_uid);
  perform private.expire_payment_requests(v_uid);

  if (select count(*) from public.payment_requests
       where user_id = v_uid and status in ('created', 'submitted')) >= 3 then
    raise exception 'too_many_open' using errcode = 'P0001';
  end if;

  loop
    -- ZG-1234; widens by a digit if the 4-digit space gets crowded.
    v_code := 'ZG-' || (floor(random() * 9 * power(10, 3 + v_attempt / 20)) + power(10, 3 + v_attempt / 20))::bigint::text;
    exit when not exists (select 1 from public.payment_requests where ref_code = v_code);
    v_attempt := v_attempt + 1;
  end loop;

  insert into public.payment_requests (user_id, product_id, ref_code, amount_mnt)
  values (v_uid, p.id, v_code, p.price_mnt)
  returning * into v_row;
  return v_row;
end;
$$;
grant execute on function public.create_payment_request(text) to authenticated;

-------------------------------------------------------------------------------
-- User: "Гүйлгээ хийсэн". created → submitted.
-- Returns whether the admin still needs to be notified (so a failed Telegram
-- send can be retried by tapping again).
-------------------------------------------------------------------------------
create function public.submit_payment_request(p_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  r public.payment_requests%rowtype;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  perform private.expire_payment_requests(v_uid);

  select * into r from public.payment_requests
   where id = p_request_id and user_id = v_uid
   for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  if r.status = 'created' then
    if (select count(*) from public.payment_requests
         where user_id = v_uid and submitted_at > now() - interval '1 hour') >= 5 then
      raise exception 'rate_limited' using errcode = 'P0001';
    end if;
    update public.payment_requests
       set status = 'submitted', submitted_at = now()
     where id = r.id
    returning * into r;
    return jsonb_build_object('status', r.status, 'needs_notify', true);
  end if;

  return jsonb_build_object(
    'status', r.status,
    'needs_notify', r.status = 'submitted' and r.telegram_message_id is null
  );
end;
$$;
grant execute on function public.submit_payment_request(uuid) to authenticated;

-------------------------------------------------------------------------------
-- approve_payment: submitted → approved, then grant the product. Idempotent.
-- Callable by the service role (Telegram webhook, payment providers) or by an
-- admin session (admin panel).
-------------------------------------------------------------------------------
create function public.approve_payment(
  p_request_id uuid,
  p_admin_telegram_id bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin_user uuid;
  r public.payment_requests%rowtype;
  p public.products%rowtype;
  v_start timestamptz;
  v_expires timestamptz;
begin
  if private.is_service_role() then
    v_admin_user := null;
  elsif private.is_admin() then
    v_admin_user := auth.uid();
  else
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select * into r from public.payment_requests where id = p_request_id for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  if r.status = 'approved' then
    return jsonb_build_object('ok', true, 'already', true, 'status', r.status, 'ref_code', r.ref_code);
  end if;
  if r.status <> 'submitted' then
    return jsonb_build_object('ok', false, 'already', false, 'status', r.status, 'ref_code', r.ref_code);
  end if;

  select * into p from public.products where id = r.product_id;

  update public.payment_requests
     set status = 'approved',
         decided_at = now(),
         decided_by_telegram_id = p_admin_telegram_id,
         decided_by_user_id = v_admin_user
   where id = r.id;

  if p.kind = 'coin_pack' then
    perform private.lock_wallet(r.user_id);
    update public.wallets
       set balance_coins = balance_coins + p.coins, updated_at = now()
     where user_id = r.user_id;
    insert into public.wallet_transactions (user_id, delta_coins, reason, app, ref_id)
    values (r.user_id, p.coins, 'topup', p.app, r.id::text);

  elsif p.kind = 'subscription' then
    -- Extend from the current expiry if a subscription is still running.
    perform private.lock_wallet(r.user_id);
    select greatest(now(), coalesce(max(s.expires_at), now())) into v_start
      from public.subscriptions s
     where s.user_id = r.user_id and s.scope = 'all' and s.expires_at > now();
    v_expires := v_start + make_interval(days => p.duration_days);
    insert into public.subscriptions (user_id, product_id, scope, starts_at, expires_at, payment_request_id)
    values (r.user_id, p.id, 'all', v_start, v_expires, r.id);

  elsif p.kind = 'story' then
    insert into public.unlocks (user_id, story_id, chapter_id, method)
    values (r.user_id, p.story_id, null, 'purchase')
    on conflict do nothing;
    delete from public.wait_free_timers w where w.user_id = r.user_id and w.story_id = p.story_id;
  end if;

  return jsonb_build_object('ok', true, 'already', false, 'status', 'approved', 'ref_code', r.ref_code,
                            'kind', p.kind, 'expires_at', v_expires);
end;
$$;
revoke execute on function public.approve_payment(uuid, bigint) from public, anon;
grant execute on function public.approve_payment(uuid, bigint) to authenticated, service_role;

create function public.reject_payment(
  p_request_id uuid,
  p_admin_telegram_id bigint default null,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin_user uuid;
  r public.payment_requests%rowtype;
begin
  if private.is_service_role() then
    v_admin_user := null;
  elsif private.is_admin() then
    v_admin_user := auth.uid();
  else
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select * into r from public.payment_requests where id = p_request_id for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if r.status = 'rejected' then
    return jsonb_build_object('ok', true, 'already', true, 'status', r.status, 'ref_code', r.ref_code);
  end if;
  if r.status not in ('created', 'submitted') then
    return jsonb_build_object('ok', false, 'already', false, 'status', r.status, 'ref_code', r.ref_code);
  end if;

  update public.payment_requests
     set status = 'rejected',
         decided_at = now(),
         decided_by_telegram_id = p_admin_telegram_id,
         decided_by_user_id = v_admin_user,
         reject_reason = nullif(btrim(p_reason), '')
   where id = r.id;

  return jsonb_build_object('ok', true, 'already', false, 'status', 'rejected', 'ref_code', r.ref_code);
end;
$$;
revoke execute on function public.reject_payment(uuid, bigint, text) from public, anon;
grant execute on function public.reject_payment(uuid, bigint, text) to authenticated, service_role;

-- Follow-up reason for an already rejected request (Telegram reply / admin).
create function public.set_payment_reject_reason(p_request_id uuid, p_reason text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (private.is_service_role() or private.is_admin()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.payment_requests
     set reject_reason = left(nullif(btrim(p_reason), ''), 500)
   where id = p_request_id and status = 'rejected';
  return found;
end;
$$;
revoke execute on function public.set_payment_reject_reason(uuid, text) from public, anon;
grant execute on function public.set_payment_reject_reason(uuid, text) to authenticated, service_role;

-------------------------------------------------------------------------------
-- Wallet summary for the signed-in user (balance, subscription, monthly nudge).
-------------------------------------------------------------------------------
create function public.my_wallet_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_month_start timestamptz := date_trunc('month', now() at time zone 'Asia/Ulaanbaatar') at time zone 'Asia/Ulaanbaatar';
  v_spent_coins int;
  v_month_price int;
begin
  if v_uid is null then
    return null;
  end if;

  select coalesce(sum(-t.delta_coins), 0) into v_spent_coins
    from public.wallet_transactions t
   where t.user_id = v_uid
     and t.reason in ('unlock_chapter', 'unlock_story')
     and t.created_at >= v_month_start;

  select price_mnt into v_month_price from public.products
   where code = 'sub_month' and active;

  return jsonb_build_object(
    'balance_coins', coalesce((select balance_coins from public.wallets where user_id = v_uid), 0),
    'subscription_expires_at', private.active_subscription_until(v_uid, 'all'),
    'month_spent_mnt', v_spent_coins * private.coin_value_mnt(),
    'month_subscription_price_mnt', v_month_price,
    'show_nudge', v_month_price is not null
                  and private.active_subscription_until(v_uid, 'all') is null
                  and v_spent_coins * private.coin_value_mnt() >= v_month_price * 0.7
  );
end;
$$;
grant execute on function public.my_wallet_summary() to authenticated;

-------------------------------------------------------------------------------
-- Admin helpers (need auth.users email, so security definer + admin check).
-------------------------------------------------------------------------------
create function public.admin_list_payment_requests(p_status text default null, p_limit int default 100)
returns table (
  id uuid,
  ref_code text,
  status text,
  amount_mnt int,
  product_title text,
  product_kind text,
  user_id uuid,
  user_email text,
  created_at timestamptz,
  submitted_at timestamptz,
  decided_at timestamptz,
  decided_by_telegram_id bigint,
  decided_by_user_id uuid,
  reject_reason text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if not private.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select r.id, r.ref_code, r.status, r.amount_mnt, p.title, p.kind, r.user_id, u.email::text,
           r.created_at, r.submitted_at, r.decided_at, r.decided_by_telegram_id, r.decided_by_user_id,
           r.reject_reason
      from public.payment_requests r
      join public.products p on p.id = r.product_id
      join auth.users u on u.id = r.user_id
     where p_status is null or r.status = p_status
     order by (r.status = 'submitted') desc, r.created_at desc
     limit least(greatest(p_limit, 1), 500);
end;
$$;
grant execute on function public.admin_list_payment_requests(text, int) to authenticated;

create function public.admin_find_users(p_query text)
returns table (id uuid, email text, display_name text, balance_coins int, subscription_expires_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if not private.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select u.id, u.email::text, pr.display_name, coalesce(w.balance_coins, 0),
           private.active_subscription_until(u.id, 'all')
      from auth.users u
      left join public.profiles pr on pr.id = u.id
      left join public.wallets w on w.user_id = u.id
     where coalesce(btrim(p_query), '') = ''
        or u.email ilike '%' || btrim(p_query) || '%'
        or u.id::text = btrim(p_query)
     order by u.created_at desc
     limit 50;
end;
$$;
grant execute on function public.admin_find_users(text) to authenticated;

-------------------------------------------------------------------------------
-- Realtime: users watch their own payment request status (RLS applies).
-------------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.payment_requests;
  end if;
end;
$$;
