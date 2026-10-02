-- pgTAP: follows, new-chapter updates, Telegram linking/notification claims,
-- ongoing stories and image fields in get_chapter.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(24);

insert into auth.users (id, email, aud, role) values
  ('bbbbbbbb-0000-4000-8000-000000000001', 'follower@test.mn', 'authenticated', 'authenticated'),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'other@test.mn',    'authenticated', 'authenticated');

insert into public.stories (id, slug, title, status, ongoing, published_at) values
  ('cccccccc-0000-4000-8000-000000000001', 'follow-test', 'Дагах тест', 'published', true, now() - interval '2 days');
insert into public.chapters (id, story_id, number, title, content, is_free, image_url, published_at) values
  ('cccccccc-0000-4000-8000-0000000000c1', 'cccccccc-0000-4000-8000-000000000001', 1, 'Нэг', repeat('Эхний бүлэг. ', 100), true,
   'https://example.com/1.webp', now() - interval '2 days'),
  ('cccccccc-0000-4000-8000-0000000000c2', 'cccccccc-0000-4000-8000-000000000001', 2, 'Хоёр', repeat('Хоёр дахь. ', 100), true,
   null, now() - interval '2 days');

create or replace function pg_temp.as_user(p uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
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
-- Ongoing story + images in get_chapter
-------------------------------------------------------------------------------
select pg_temp.as_user('bbbbbbbb-0000-4000-8000-000000000001');
select is((select image_url from public.get_chapter('cccccccc-0000-4000-8000-0000000000c1')), 'https://example.com/1.webp', 'chapter image returned');
select is((select continues_later from public.get_chapter('cccccccc-0000-4000-8000-0000000000c1')), false, 'middle chapter: not «continues later»');
select is((select continues_later from public.get_chapter('cccccccc-0000-4000-8000-0000000000c2')), true, 'last chapter of an ongoing story: «continues later»');

-------------------------------------------------------------------------------
-- Storage: only admins upload to the media bucket
-------------------------------------------------------------------------------
select throws_ok($$ insert into storage.objects (bucket_id, name) values ('media', 'x.webp') $$,
  '42501', null, 'non-admin cannot upload to media');
select pg_temp.as_postgres();
update public.profiles set is_admin = true where id = 'bbbbbbbb-0000-4000-8000-000000000002';
select pg_temp.as_user('bbbbbbbb-0000-4000-8000-000000000002');
select lives_ok($$ insert into storage.objects (bucket_id, name) values ('media', 'chapters/x.webp') $$, 'admin can upload to media');
select pg_temp.as_user('bbbbbbbb-0000-4000-8000-000000000001');

-------------------------------------------------------------------------------
-- Follows: own rows only, server-managed timestamps
-------------------------------------------------------------------------------
select throws_ok($$ insert into public.follows (user_id, story_id) values ('bbbbbbbb-0000-4000-8000-000000000002', 'cccccccc-0000-4000-8000-000000000001') $$,
  '42501', null, 'cannot follow on behalf of someone else');
select throws_ok($$ insert into public.follows (user_id, story_id, notified_at) values ('bbbbbbbb-0000-4000-8000-000000000001', 'cccccccc-0000-4000-8000-000000000001', now() + interval '1 year') $$,
  '42501', null, 'cannot set notified_at');

-- Reading an ongoing story follows it automatically.
select public.save_reading_progress('cccccccc-0000-4000-8000-0000000000c1', 10);
select is((select count(*) from public.follows where story_id = 'cccccccc-0000-4000-8000-000000000001')::int, 1, 'reading an ongoing story auto-follows');
select lives_ok($$ delete from public.follows where story_id = 'cccccccc-0000-4000-8000-000000000001' $$, 'can unfollow');
select is((select count(*) from public.follows)::int, 0, 'unfollowed');
select lives_ok($$ insert into public.follows (user_id, story_id) values ('bbbbbbbb-0000-4000-8000-000000000001', 'cccccccc-0000-4000-8000-000000000001') $$, 'can follow');

select pg_temp.as_user('bbbbbbbb-0000-4000-8000-000000000002');
select is((select count(*) from public.follows)::int, 0, 'other users do not see my follows');

-- A new chapter appears after the follower last read.
select pg_temp.as_postgres();
update public.follows set seen_at = now() - interval '1 day', notified_at = now() - interval '1 day';
insert into public.chapters (id, story_id, number, title, content, published_at) values
  ('cccccccc-0000-4000-8000-0000000000c3', 'cccccccc-0000-4000-8000-000000000001', 3, 'Гурав', repeat('Гурав. ', 100), now() - interval '1 minute');
insert into public.chapter_choices (chapter_id, label, target_chapter_id, image_url) values
  ('cccccccc-0000-4000-8000-0000000000c2', 'Урагшлах', 'cccccccc-0000-4000-8000-0000000000c3', 'https://example.com/choice.webp');

select pg_temp.as_user('bbbbbbbb-0000-4000-8000-000000000001');
select is((select new_chapters from public.my_story_updates()), 1, 'my_story_updates: one new chapter');
select is((select first_new_number from public.my_story_updates()), 3, 'my_story_updates: first new chapter number');
select is((select choices -> 0 ->> 'image_url' from public.get_chapter('cccccccc-0000-4000-8000-0000000000c2')), 'https://example.com/choice.webp', 'choice image returned');
select public.save_reading_progress('cccccccc-0000-4000-8000-0000000000c3', 5);
select is((select count(*) from public.my_story_updates())::int, 0, 'reading the story clears updates');

-------------------------------------------------------------------------------
-- Telegram linking and notification claims
-------------------------------------------------------------------------------
select throws_ok($$ insert into public.telegram_links (user_id, chat_id) values ('bbbbbbbb-0000-4000-8000-000000000001', 1) $$,
  '42501', null, 'users cannot write telegram_links directly');
select throws_ok($$ select public.link_telegram('x', 1) $$, '42501', null, 'users cannot call link_telegram');
select throws_ok($$ select * from public.claim_chapter_notifications('cccccccc-0000-4000-8000-000000000001') $$, '42501', 'forbidden', 'users cannot claim notifications');

create temp table tok as select public.create_telegram_link_token() as t;
grant select on tok to service_role;
select pg_temp.as_service();
select is(public.link_telegram((select t from tok), 777), true, 'token links the chat');
select is(public.link_telegram((select t from tok), 777), false, 'token is single-use');

select is((select count(*) from public.claim_chapter_notifications('cccccccc-0000-4000-8000-000000000001'))::int, 1, 'one follower due a notification');
select is((select count(*) from public.claim_chapter_notifications('cccccccc-0000-4000-8000-000000000001'))::int, 0, 'claimed once — no duplicate message');
select is(public.unlink_telegram_chat(777), true, '/stop unlinks the chat');

select * from finish();
rollback;
