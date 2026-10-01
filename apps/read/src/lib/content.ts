import "server-only";
import { cache } from "react";
import type { Genre } from "@zugaa/db";
import { createClient } from "@/lib/supabase/server";

export type StoryCard = {
  id: string;
  slug: string;
  title: string;
  description: string;
  cover_url: string | null;
  cover_color: string;
  genre: string;
  age_rating: string;
  status: string;
  price_coins: number | null;
  wait_free_hours: number | null;
  published_at: string | null;
};

const STORY_COLUMNS =
  "id, slug, title, description, cover_url, cover_color, genre, age_rating, status, price_coins, wait_free_hours, published_at";

export async function listStories(opts: { genre?: Genre; q?: string; limit?: number } = {}): Promise<StoryCard[]> {
  const supabase = await createClient();
  let query = supabase
    .from("stories")
    .select(STORY_COLUMNS)
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(opts.limit ?? 50);
  if (opts.genre) query = query.eq("genre", opts.genre);
  if (opts.q) {
    // PostgREST `or` syntax: strip characters that would break the filter.
    const term = opts.q.replace(/[,()*%\\]/g, " ").trim().slice(0, 60);
    if (term) query = query.or(`title.ilike.*${term}*,description.ilike.*${term}*`);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

/** Story by slug. RLS hides drafts from everyone but admins. */
export const getStory = cache(async (slug: string): Promise<StoryCard | null> => {
  const supabase = await createClient();
  const { data } = await supabase.from("stories").select(STORY_COLUMNS).eq("slug", slug).maybeSingle();
  return data;
});

export type ChapterListItem = {
  id: string;
  number: number;
  title: string;
  is_free: boolean;
  price_coins: number;
  is_ending: boolean;
  published_at: string | null;
  has_access: boolean;
};

export const getStoryChapters = cache(async (storyId: string): Promise<ChapterListItem[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_story_chapters", { p_story_id: storyId });
  if (error) throw error;
  return data ?? [];
});

export type Choice = { label: string; target_number: number };

export type ChapterView = {
  id: string;
  story_id: string;
  story_slug: string;
  story_title: string;
  story_price_coins: number | null;
  number: number;
  title: string;
  /** Full text when unlocked; a short preview when locked; null behind the age gate. */
  content: string | null;
  locked: boolean;
  gate: "login_required" | "birth_year_required" | "underage" | null;
  is_free: boolean;
  price_coins: number;
  is_ending: boolean;
  prev_number: number | null;
  next_number: number | null;
  choices: Choice[] | null;
  wait_free_hours: number | null;
  wait_free_ends_at: string | null;
  wait_free_other_chapter: number | null;
  /** Signed-in reader may start the wait-free timer for this chapter now. */
  wait_free_available: boolean;
};

/** The only path chapter text takes: get_chapter_at → get_chapter → has_access. */
export const getChapter = cache(async (slug: string, number: number): Promise<ChapterView | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_chapter_at", { p_slug: slug, p_number: number });
  if (error) throw error;
  const row = data?.[0];
  if (!row?.id) return null;
  return row as unknown as ChapterView;
});

export type Progress = { story_id: string; chapter_id: string; scroll_pct: number; updated_at: string };

export async function getProgress(userId: string, storyId: string): Promise<(Progress & { number: number }) | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("reading_progress")
    .select("story_id, chapter_id, scroll_pct, updated_at, chapters(number)")
    .eq("user_id", userId)
    .eq("story_id", storyId)
    .maybeSingle();
  if (!data?.chapters) return null;
  return { ...data, number: data.chapters.number };
}

export type ContinueItem = {
  story: Pick<StoryCard, "slug" | "title" | "cover_url" | "cover_color" | "genre">;
  chapter: { number: number; title: string };
  scroll_pct: number;
  updated_at: string;
};

export async function getContinueReading(userId: string, limit = 3): Promise<ContinueItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("reading_progress")
    .select("scroll_pct, updated_at, stories(slug, title, cover_url, cover_color, genre), chapters(number, title)")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(limit);
  return (data ?? [])
    .filter((r) => r.stories && r.chapters)
    .map((r) => ({ story: r.stories!, chapter: r.chapters!, scroll_pct: Number(r.scroll_pct), updated_at: r.updated_at }));
}

export type NewChapter = {
  id: string;
  number: number;
  title: string;
  published_at: string;
  story: { slug: string; title: string };
};

export async function getNewChapters(limit = 6): Promise<NewChapter[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("chapters")
    .select("id, number, title, published_at, stories!inner(slug, title, status)")
    .eq("stories.status", "published")
    .not("published_at", "is", null)
    .order("published_at", { ascending: false })
    .limit(limit);
  return (data ?? []).map((c) => ({
    id: c.id,
    number: c.number,
    title: c.title,
    published_at: c.published_at!,
    story: { slug: c.stories.slug, title: c.stories.title },
  }));
}
