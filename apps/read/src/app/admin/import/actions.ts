"use server";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { notifyFollowers } from "@/lib/notify";
import { createClient } from "@/lib/supabase/server";
import { assertAdmin } from "@/lib/auth";
import { validateImport, type StoryReport } from "@/lib/story-import";
import { getGenres } from "@/lib/genres";

export type CheckResult = { error?: string; reports: StoryReport[]; existing: string[] };

/**
 * Server-side validation against the database: a chapters-only batch needs an
 * existing story, and choices pointing outside the file are matched with the
 * chapters already imported.
 */
async function validateWithDb(text: string) {
  const { reports, error } = validateImport(text, (await getGenres()).map((g) => g.slug));
  if (error) return { error, reports: [], existing: [] as string[] };
  const slugs = reports.map((r) => r.slug).filter(Boolean);
  const supabase = await createClient();
  const { data } = slugs.length
    ? await supabase.from("stories").select("slug, title, chapters(number, title)").in("slug", slugs)
    : { data: [] };
  const bySlug = new Map((data ?? []).map((s) => [s.slug, s]));
  for (const r of reports) {
    const db = bySlug.get(r.slug);
    if (r.partial && r.slug) {
      if (!db) {
        r.errors.push(`«${r.slug}» өгүүллэг байхгүй. Шинэ өгүүллэгт «title» заавал (эхний ээлжийн JSON-оо эхэлж оруулна уу).`);
        r.story = null;
      } else {
        r.title = db.title;
      }
    }
    if (r.external.length) {
      const written = new Set((db?.chapters ?? []).filter((c) => c.title !== PLACEHOLDER_TITLE).map((c) => c.number));
      const missing = r.external.filter((n) => !written.has(n));
      r.warnings = r.warnings.filter((w) => !w.startsWith("Энэ файлд байхгүй бүлэг"));
      if (missing.length) {
        r.warnings.push(
          `${missing.join(", ")}-р бүлэг хараахан бичигдээгүй. Дараагийн ээлжинд оруулах хүртэл тэр сонголт нуугдаж, уншигчид «Үргэлжлэл удахгүй» гэж харагдана.`,
        );
      }
    }
  }
  return { reports, existing: (data ?? []).map((s) => s.slug) };
}

/** Title of the hidden draft chapter created for a choice target not written yet. */
const PLACEHOLDER_TITLE = "Бичигдээгүй бүлэг";

/** Validates on the server too and reports which slugs already exist. */
export async function checkImport(text: string): Promise<CheckResult> {
  await assertAdmin();
  return validateWithDb(text);
}

export type ImportResult = {
  error?: string;
  results: Array<{
    slug: string;
    title: string;
    ok: boolean;
    created?: boolean;
    chapters?: number;
    choices?: number;
    placeholders?: number;
    message?: string;
  }>;
};

/** Imports every valid story; each story is one database transaction. */
export async function importStories(text: string, publish: boolean): Promise<ImportResult> {
  await assertAdmin();
  const { reports, error } = await validateWithDb(text);
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
    const d = data as { story_id: string; created: boolean; chapters: number; choices: number; placeholders: number };
    if (publish) {
      const storyId = d.story_id;
      after(() => notifyFollowers(storyId).catch((e) => console.error("notify followers", e)));
    }
    results.push({
      slug: r.slug,
      title: r.title,
      ok: true,
      created: d.created,
      chapters: d.chapters,
      choices: d.choices,
      placeholders: d.placeholders,
    });
  }
  revalidatePath("/admin/stories", "layout");
  revalidatePath("/", "layout");
  return { results };
}
