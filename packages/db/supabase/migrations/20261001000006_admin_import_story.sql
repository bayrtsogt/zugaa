-- Bulk story import from JSON (admin panel). One call = one story, one
-- transaction. Existing stories (same slug) are updated in place: chapters are
-- upserted by number and never deleted, so unlocks and reading progress keep
-- pointing at the same chapter rows. Choices of imported chapters are replaced.
--
-- Shape (validated in the app first, re-checked here):
-- { "slug", "title", "description", "genre", "age_rating", "price_coins",
--   "wait_free_hours", "cover_url",
--   "chapters": [ { "number", "title", "content", "free", "price_coins",
--                   "ending", "choices": [ { "label", "goto" } ] } ] }

create function public.admin_import_story(p_story jsonb, p_publish boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_story_id uuid;
  v_created boolean;
  v_ch jsonb;
  v_choice jsonb;
  v_numbers int[] := '{}';
  v_chapter_id uuid;
  v_target uuid;
  v_choices int := 0;
  v_pos int;
  v_now timestamptz := now();
begin
  if not private.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if jsonb_typeof(p_story -> 'chapters') <> 'array' or jsonb_array_length(p_story -> 'chapters') = 0 then
    raise exception 'chapters_required' using errcode = '22023';
  end if;

  insert into public.stories as s (slug, title, description, cover_url, genre, age_rating, price_coins,
                                   wait_free_hours, status)
  values (
    p_story ->> 'slug',
    p_story ->> 'title',
    coalesce(p_story ->> 'description', ''),
    nullif(p_story ->> 'cover_url', ''),
    coalesce(p_story ->> 'genre', 'other'),
    coalesce(p_story ->> 'age_rating', 'all'),
    nullif(p_story ->> 'price_coins', '')::int,
    nullif(p_story ->> 'wait_free_hours', '')::int,
    case when p_publish then 'published' else 'draft' end
  )
  on conflict (slug) do update set
    title = excluded.title,
    description = excluded.description,
    cover_url = excluded.cover_url,
    genre = excluded.genre,
    age_rating = excluded.age_rating,
    price_coins = excluded.price_coins,
    wait_free_hours = excluded.wait_free_hours,
    status = case when p_publish then 'published' else s.status end
  returning id, (xmax = 0) into v_story_id, v_created;

  -- Chapters: upsert by (story_id, number).
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

  -- Choices: replace for the imported chapters.
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
          raise exception 'choice_target_missing: chapter % → %', v_ch ->> 'number', v_choice ->> 'goto'
            using errcode = '22023';
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
          jsonb_build_object('slug', p_story ->> 'slug', 'chapters', cardinality(v_numbers),
                             'choices', v_choices, 'published', p_publish));

  return jsonb_build_object('story_id', v_story_id, 'slug', p_story ->> 'slug', 'created', v_created,
                            'chapters', cardinality(v_numbers), 'choices', v_choices);
end;
$$;
grant execute on function public.admin_import_story(jsonb, boolean) to authenticated;
