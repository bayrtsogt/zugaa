import "server-only";
import { createClient } from "@/lib/supabase/server";

export async function isFollowing(userId: string, storyId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.from("follows").select("story_id").eq("user_id", userId).eq("story_id", storyId).maybeSingle();
  return Boolean(data);
}

export type StoryUpdate = {
  story_id: string;
  slug: string;
  title: string;
  cover_url: string | null;
  genre: string;
  new_chapters: number;
  first_new_number: number;
  first_new_title: string;
};

/** Followed stories with chapters published since the reader last read them. */
export async function getStoryUpdates(): Promise<StoryUpdate[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("my_story_updates");
  return (data ?? []) as StoryUpdate[];
}

export type FollowedStory = { story_id: string; slug: string; title: string; ongoing: boolean };

export async function getFollowedStories(userId: string): Promise<FollowedStory[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("follows")
    .select("story_id, created_at, stories(slug, title, ongoing)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  return (data ?? [])
    .filter((f) => f.stories)
    .map((f) => ({ story_id: f.story_id, slug: f.stories!.slug, title: f.stories!.title, ongoing: f.stories!.ongoing }));
}

export async function getTelegramLinked(userId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.from("telegram_links").select("user_id").eq("user_id", userId).maybeSingle();
  return Boolean(data);
}
