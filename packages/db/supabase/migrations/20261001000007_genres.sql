-- Genres become data (admin-managed) instead of a fixed check constraint.
-- `art` picks one of the built-in line-art illustrations used as a placeholder cover.

create table public.genres (
  slug text primary key check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' and char_length(slug) <= 40),
  label text not null check (char_length(label) between 1 and 40),
  art text not null default 'other' check (art in ('horror', 'thriller', 'mystery', 'romance', 'other')),
  position int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.genres enable row level security;
revoke all on table public.genres from anon, authenticated;
grant select on table public.genres to anon, authenticated;
grant insert, update, delete on table public.genres to authenticated;

create policy "genres: read all" on public.genres for select to anon, authenticated using (true);
create policy "genres: admin insert" on public.genres for insert to authenticated
  with check ((select private.is_admin()));
create policy "genres: admin update" on public.genres for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "genres: admin delete" on public.genres for delete to authenticated
  using ((select private.is_admin()));

insert into public.genres (slug, label, art, position) values
  ('horror', 'Аймшиг', 'horror', 10),
  ('thriller', 'Триллер', 'thriller', 20),
  ('mystery', 'Нууцлаг', 'mystery', 30),
  ('romance', 'Хайр дурлал', 'romance', 40),
  ('other', 'Бусад', 'other', 90)
on conflict (slug) do nothing;

-- Any story genre not yet in the table (defensive) gets a row before the FK.
insert into public.genres (slug, label, art, position)
select distinct s.genre, s.genre, 'other', 80 from public.stories s
where not exists (select 1 from public.genres g where g.slug = s.genre)
on conflict do nothing;

alter table public.stories drop constraint if exists stories_genre_check;
alter table public.stories
  add constraint stories_genre_fk foreign key (genre) references public.genres (slug)
  on update cascade on delete restrict;
