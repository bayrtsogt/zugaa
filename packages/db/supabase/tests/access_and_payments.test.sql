-- pgTAP: content protection, idempotent unlocks/approvals, subscription expiry.
-- Run: pnpm db:test   (supabase test db)
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(75);

select is(
  (select count(*) from pg_tables where schemaname = 'public' and not rowsecurity)::int, 0,
  'RLS enabled on every public table');

-------------------------------------------------------------------------------
-- Fixtures
-------------------------------------------------------------------------------
insert into auth.users (id, email, aud, role) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'reader@test.mn', 'authenticated', 'authenticated'),
  ('aaaaaaaa-0000-4000-8000-000000000002', 'payer@test.mn',  'authenticated', 'authenticated'),
  ('aaaaaaaa-0000-4000-8000-000000000003', 'admin@test.mn',  'authenticated', 'authenticated'),
  ('aaaaaaaa-0000-4000-8000-000000000004', 'kid@test.mn',    'authenticated', 'authenticated');
update public.profiles set is_admin = true where id = 'aaaaaaaa-0000-4000-8000-000000000003';
update public.profiles set birth_year = extract(year from now())::int - 12 where id = 'aaaaaaaa-0000-4000-8000-000000000004';

create temp table ids as select
  '11111111-0000-4000-8000-000000000003'::uuid as locked_ch,   -- horror ch3 (paid, wait-free story)
  '11111111-0000-4000-8000-000000000004'::uuid as locked_ch2,
  '11111111-0000-4000-8000-000000000001'::uuid as free_ch,
  '11111111-1111-4111-8111-111111111111'::uuid as horror,
  '22222222-0000-4000-8000-000000000001'::uuid as adult_free_ch,
  '22222222-0000-4000-8000-000000000003'::uuid as adult_locked_ch,
  '22222222-2222-4222-8222-222222222222'::uuid as mystery;
grant select on ids to anon, authenticated, service_role;

create or replace function pg_temp.as_user(p uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;
create or replace function pg_temp.as_anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  execute 'set local role anon';
end $$;
create or replace function pg_temp.as_service() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  execute 'set local role service_role';
end $$;
create or replace function pg_temp.as_postgres() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
end $$;

-------------------------------------------------------------------------------
-- 1. chapters.content is never directly readable
-------------------------------------------------------------------------------
select pg_temp.as_anon();
select throws_ok($$ select content from public.chapters limit 1 $$, '42501', null, 'anon cannot select chapters.content');
select lives_ok($$ select id, title from public.chapters limit 1 $$, 'anon can select chapter metadata');
select throws_ok($$ select * from public.chapter_choices $$, '42501', null, 'anon cannot read chapter_choices');
select throws_ok($$ select public.has_access(null, (select free_ch from ids)) $$, '42501', null, 'anon cannot call has_access');

select pg_temp.as_user('aaaaaaaa-0000-4000-8000-000000000001');
select throws_ok($$ select content from public.chapters limit 1 $$, '42501', null, 'authenticated cannot select chapters.content');
select throws_ok($$ select to_jsonb(c) from public.chapters c limit 1 $$, '42501', null, 'authenticated cannot select whole chapter rows');
select is((select count(*) from public.chapter_choices)::int, 0, 'non-admin sees no chapter_choices rows');

-------------------------------------------------------------------------------
-- 2. get_chapter: preview only when locked
-------------------------------------------------------------------------------
select pg_temp.as_anon();
select is((select locked from public.get_chapter((select free_ch from ids))), false, 'anon reads free chapter');
select ok((select char_length(content) > 1000 from public.get_chapter((select free_ch from ids))), 'free chapter returns full content');
select is((select locked from public.get_chapter((select locked_ch from ids))), true, 'anon: paid chapter locked');
select ok((select char_length(content) <= 600 from public.get_chapter((select locked_ch from ids))), 'anon: locked chapter returns <= 600 chars');
select ok((select position('Чи надгүйгээр явчихлаа' in content) = 0 from public.get_chapter((select locked_ch from ids))), 'anon: locked chapter ending not in preview');
select is((select choices from public.get_chapter((select locked_ch from ids))), null, 'locked chapter returns no choices');

select pg_temp.as_user('aaaaaaaa-0000-4000-8000-000000000001');
select is((select locked from public.get_chapter((select locked_ch from ids))), true, 'reader without purchase: locked');
select ok((select char_length(content) <= 600 from public.get_chapter((select locked_ch from ids))), 'reader without purchase: preview only');
select is((select wait_free_available from public.get_chapter((select locked_ch from ids))), true, 'wait-free available, get_chapter starts nothing');
select is((select count(*) from public.wait_free_timers)::int, 0, 'viewing (or prefetching) does not start a timer');
select isnt(public.start_wait_free((select locked_ch from ids)), null, 'start_wait_free starts the countdown');
select isnt((select wait_free_ends_at from public.get_chapter((select locked_ch from ids))), null, 'countdown visible');
select is(public.start_wait_free((select locked_ch2 from ids)), null, 'only one running timer per story');

-------------------------------------------------------------------------------
-- 3. Users cannot write money/access tables or escalate
-------------------------------------------------------------------------------
select throws_ok($$ insert into public.unlocks (user_id, story_id, chapter_id, method) values (auth.uid(), (select horror from ids), (select locked_ch from ids), 'coins') $$, '42501', null, 'cannot insert unlocks');
select throws_ok($$ update public.wallets set balance_coins = 9999 $$, '42501', null, 'cannot update wallet');
select throws_ok($$ insert into public.wallet_transactions (user_id, delta_coins, reason) values (auth.uid(), 100, 'topup') $$, '42501', null, 'cannot insert transactions');
select throws_ok($$ update public.profiles set is_admin = true where id = auth.uid() $$, '42501', null, 'cannot set is_admin');
select throws_ok($$ insert into public.subscriptions (user_id, starts_at, expires_at) values (auth.uid(), now(), now() + interval '1 year') $$, '42501', null, 'cannot insert subscriptions');
select throws_ok($$ update public.payment_requests set status = 'approved' $$, '42501', null, 'cannot update payment_requests');
select lives_ok($$ update public.profiles set display_name = 'Уншигч' where id = auth.uid() $$, 'can update own display_name');
select is((select count(*) from public.profiles)::int, 1, 'sees only own profile');
update public.stories set title = 'x';
select is((select count(*) from public.stories where title = 'x')::int, 0, 'non-admin story update changes nothing (RLS)');

-------------------------------------------------------------------------------
-- 4. unlock_chapter: insufficient, then idempotent charge
-------------------------------------------------------------------------------
select is((public.unlock_chapter((select locked_ch2 from ids)) ->> 'status'), 'insufficient', 'unlock without coins: insufficient');
select is((select balance_coins from public.wallets), 0, 'no charge when insufficient');

select pg_temp.as_postgres();
update public.wallets set balance_coins = 100 where user_id = 'aaaaaaaa-0000-4000-8000-000000000001';

select pg_temp.as_user('aaaaaaaa-0000-4000-8000-000000000001');
select is((public.unlock_chapter((select locked_ch2 from ids)) ->> 'status'), 'unlocked', 'first unlock succeeds');
select is((public.unlock_chapter((select locked_ch2 from ids)) ->> 'status'), 'already', 'second unlock is a no-op');
select is((select balance_coins from public.wallets), 60, 'charged exactly once (100 - 40)');
select is((select count(*) from public.wallet_transactions where reason = 'unlock_chapter')::int, 1, 'one unlock transaction');
select is((select count(*) from public.unlocks)::int, 1, 'one unlock row');
select is((select locked from public.get_chapter((select locked_ch2 from ids))), false, 'unlocked chapter readable');
select ok((select position('Өлзий гэдэг байсан' in content) > 0 from public.get_chapter((select locked_ch2 from ids))), 'full content returned after unlock');

-------------------------------------------------------------------------------
-- 5. Wait-free timer elapses -> access, materialised as unlock
-------------------------------------------------------------------------------
select pg_temp.as_postgres();
update public.wait_free_timers set started_at = now() - interval '25 hours'
 where user_id = 'aaaaaaaa-0000-4000-8000-000000000001';
select pg_temp.as_user('aaaaaaaa-0000-4000-8000-000000000001');
select is((select locked from public.get_chapter((select locked_ch from ids))), false, 'wait-free elapsed: chapter open');
select isnt(public.start_wait_free('11111111-0000-4000-8000-000000000005'), null, 'next timer starts once previous elapsed');
select is((select count(*) from public.unlocks where method = 'wait_free')::int, 1, 'elapsed timer became a permanent unlock');
select is((select locked from public.get_chapter((select locked_ch from ids))), false, 'still open after timer slot moved on');

-------------------------------------------------------------------------------
-- 6. 18+ gate
-------------------------------------------------------------------------------
select pg_temp.as_anon();
select is((select gate from public.get_chapter((select adult_free_ch from ids))), 'login_required', 'anon: 18+ requires login');
select is((select content from public.get_chapter((select adult_free_ch from ids))), null, 'anon: no 18+ text at all');
select pg_temp.as_user('aaaaaaaa-0000-4000-8000-000000000001');
select is((select gate from public.get_chapter((select adult_free_ch from ids))), 'birth_year_required', 'no birth year: asked once');
select pg_temp.as_user('aaaaaaaa-0000-4000-8000-000000000004');
select is((select gate from public.get_chapter((select adult_free_ch from ids))), 'underage', 'minor blocked');
select throws_ok($$ select public.unlock_chapter((select adult_locked_ch from ids)) $$, '42501', null, 'minor cannot buy 18+ chapter');
select pg_temp.as_user('aaaaaaaa-0000-4000-8000-000000000001');
update public.profiles set birth_year = 1990 where id = auth.uid();
select is((select gate from public.get_chapter((select adult_free_ch from ids))), null, 'adult passes gate');
select is((select locked from public.get_chapter((select adult_free_ch from ids))), false, 'adult reads free 18+ chapter');
select throws_ok($$ update public.profiles set birth_year = 2015 where id = auth.uid() $$, '42501', 'birth_year_locked', 'birth year is set once');
select pg_temp.as_anon();
select ok((select locked and char_length(content) <= 600 from public.get_chapter_at('arvan-guravdugaar-davhar', 4)), 'get_chapter_at: anon gets preview only');

-------------------------------------------------------------------------------
-- 7. Payment requests: server-side price, limits, approval idempotency
-------------------------------------------------------------------------------
select pg_temp.as_user('aaaaaaaa-0000-4000-8000-000000000002');
create temp table pr_month as select * from public.create_payment_request('sub_month');
select is((select amount_mnt from pr_month), 20000, 'price taken from products');
select matches((select ref_code from pr_month), '^ZG-[0-9]{4,}$', 'ref code format');
create temp table pr_coins as select * from public.create_payment_request('coins_550');
create temp table pr_week as select * from public.create_payment_request('sub_week');
grant select on pr_month, pr_coins, pr_week to service_role;
select throws_ok($$ select public.create_payment_request('coins_300') $$, 'P0001', 'too_many_open', 'max 3 open requests');
select throws_ok($$ select public.approve_payment((select id from pr_month)) $$, '42501', 'forbidden', 'user cannot approve');

select is((public.submit_payment_request((select id from pr_month)) ->> 'status'), 'submitted', 'submit -> submitted');
select is((public.submit_payment_request((select id from pr_coins)) ->> 'status'), 'submitted', 'submit coins');
select is((public.submit_payment_request((select id from pr_week)) ->> 'status'), 'submitted', 'submit week');

select pg_temp.as_service();
select is((public.approve_payment((select id from pr_coins), 42) ->> 'already'), 'false', 'approve coins');
select is((public.approve_payment((select id from pr_coins), 42) ->> 'already'), 'true', 'double approve is a no-op');
select is((select balance_coins from public.wallets where user_id = 'aaaaaaaa-0000-4000-8000-000000000002'), 550, 'coins granted once');

select is((public.approve_payment((select id from pr_month), 42) ->> 'already'), 'false', 'approve month');
select is((public.approve_payment((select id from pr_month), 42) ->> 'already'), 'true', 'double approve month no-op');
select is((select count(*) from public.subscriptions where user_id = 'aaaaaaaa-0000-4000-8000-000000000002')::int, 1, 'one subscription after double approve');

-- Extension: week pass bought while month is active starts at month's expiry.
select is((public.approve_payment((select id from pr_week), 42) ->> 'status'), 'approved', 'approve week');
select is(
  (select max(expires_at) - min(starts_at) from public.subscriptions where user_id = 'aaaaaaaa-0000-4000-8000-000000000002')::text,
  '37 days', 'week extends from current expiry (30 + 7 days)');
select ok((select count(*) from public.audit_log where entity_id = (select id::text from pr_month)) >= 3, 'state changes audited');

-------------------------------------------------------------------------------
-- 8. Subscription grants access; expiry removes it
-------------------------------------------------------------------------------
select pg_temp.as_user('aaaaaaaa-0000-4000-8000-000000000002');
select is((select locked from public.get_chapter((select locked_ch2 from ids))), false, 'subscriber reads paid chapter');
select pg_temp.as_postgres();
update public.subscriptions
   set starts_at = now() - interval '40 days', expires_at = now() - interval '1 second'
 where user_id = 'aaaaaaaa-0000-4000-8000-000000000002';
select pg_temp.as_user('aaaaaaaa-0000-4000-8000-000000000002');
select is((select locked from public.get_chapter((select locked_ch2 from ids))), true, 'expired subscription: locked again');
select ok((select char_length(content) <= 600 from public.get_chapter((select locked_ch2 from ids))), 'expired subscription: preview only');

-------------------------------------------------------------------------------
-- 9. Rejection + story purchase + admin session approval
-------------------------------------------------------------------------------
create temp table pr_story as select * from public.create_payment_request('story_ul_tanikh_zakhidal');
select public.submit_payment_request((select id from pr_story));
create temp table pr_rej as select * from public.create_payment_request('coins_300');
select public.submit_payment_request((select id from pr_rej));

select pg_temp.as_user('aaaaaaaa-0000-4000-8000-000000000003');
select is((public.reject_payment((select id from pr_rej), null, 'Гүйлгээ олдсонгүй') ->> 'status'), 'rejected', 'admin rejects');
select is((public.approve_payment((select id from pr_rej)) ->> 'ok'), 'false', 'cannot approve a rejected request');
select is((public.approve_payment((select id from pr_story)) ->> 'status'), 'approved', 'admin session can approve');

select pg_temp.as_postgres();
select is((select count(*) from public.unlocks where user_id = 'aaaaaaaa-0000-4000-8000-000000000002' and story_id = (select mystery from ids) and chapter_id is null)::int, 1, 'story purchase unlocks whole story');

select * from finish();
rollback;
