-- KinoTube ("kino") shares accounts, payments and the Telegram approval flow.
--
-- * A subscription product grants a subscription whose scope is the product's
--   app: 'all' products keep scope 'all' (every app), 'kino' products give
--   scope 'kino' (movies only), 'read' products give scope 'read'.
-- * Extensions stack only on subscriptions of the same scope.
-- * my_access_until(app) lets a client app ask "until when may I use <app>?".

create or replace function public.approve_payment(
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
    -- Extend from the current expiry if a subscription of the same scope is still running.
    perform private.lock_wallet(r.user_id);
    select greatest(now(), coalesce(max(s.expires_at), now())) into v_start
      from public.subscriptions s
     where s.user_id = r.user_id and s.scope = p.app and s.expires_at > now();
    v_expires := v_start + make_interval(days => p.duration_days);
    insert into public.subscriptions (user_id, product_id, scope, starts_at, expires_at, payment_request_id)
    values (r.user_id, p.id, p.app, v_start, v_expires, r.id);

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

-------------------------------------------------------------------------------
-- Signed-in user: until when p_app is open (scope p_app or 'all'), or null.
-- Stacked passes start at the previous one's expiry, so while one is running
-- the chain ends at the latest expires_at.
-------------------------------------------------------------------------------
create function public.my_access_until(p_app text)
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select max(s.expires_at)
    from public.subscriptions s
   where s.user_id = auth.uid()
     and (s.scope = 'all' or s.scope = p_app)
     and s.expires_at > now()
     and private.active_subscription_until(auth.uid(), p_app) is not null;
$$;
grant execute on function public.my_access_until(text) to authenticated;
