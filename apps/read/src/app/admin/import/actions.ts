"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assertAdmin } from "@/lib/auth";
import { validateImport, type StoryReport } from "@/lib/story-import";

export type CheckResult = { error?: string; reports: StoryReport[]; existing: string[] };

/** Validates on the server too and reports which slugs already exist. */
export async function checkImport(text: string): Promise<CheckResult> {
  await assertAdmin();
  const { reports, error } = validateImport(text);
  if (error) return { error, reports: [], existing: [] };
  const slugs = reports.map((r) => r.slug).filter(Boolean);
  const supabase = await createClient();
  const { data } = slugs.length ? await supabase.from("stories").select("slug").in("slug", slugs) : { data: [] };
  return { reports, existing: (data ?? []).map((s) => s.slug) };
}

export type ImportResult = {
  error?: string;
  results: Array<{ slug: string; title: string; ok: boolean; created?: boolean; chapters?: number; choices?: number; message?: string }>;
};

/** Imports every valid story; each story is one database transaction. */
export async function importStories(text: string, publish: boolean): Promise<ImportResult> {
  await assertAdmin();
  const { reports, error } = validateImport(text);
  if (error) return { error, results: [] };
  const supabase = await createClient();
  const results: ImportResult["results"] = [];
  for (const r of reports) {
    if (!r.story) {
      results.push({ slug: r.slug, title: r.title, ok: false, message: r.errors[0] ?? "Алдаатай" });
      continue;
    }
    const { data, error: rpcError } = await supabase.rpc("admin_import_story", {
      p_story: r.story as never,
      p_publish: publish,
    });
    if (rpcError) {
      results.push({ slug: r.slug, title: r.title, ok: false, message: rpcError.message });
      continue;
    }
    const d = data as { created: boolean; chapters: number; choices: number };
    results.push({ slug: r.slug, title: r.title, ok: true, created: d.created, chapters: d.chapters, choices: d.choices });
  }
  revalidatePath("/admin/stories");
  revalidatePath("/");
  return { results };
}
