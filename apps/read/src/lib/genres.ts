import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type GenreRow = { slug: string; label: string; art: string; position: number };

/** All genres in display order (admin-managed; cached per request). */
export const getGenres = cache(async (): Promise<GenreRow[]> => {
  const supabase = await createClient();
  const { data } = await supabase.from("genres").select("slug, label, art, position").order("position").order("label");
  return data ?? [];
});
