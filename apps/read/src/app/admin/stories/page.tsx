import Link from "next/link";
import { Notice, buttonClass } from "@zugaa/ui";
import { StoryTable } from "./story-table";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { ageLabel } from "@/lib/labels";

export const metadata = { title: "Өгүүллэг" };

export default async function AdminStories({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  const msg = (await searchParams).msg?.slice(0, 300);
  await requireAdmin();
  const supabase = await createClient();
  const { data: stories, error } = await supabase
    .from("stories")
    .select("id, title, slug, status, genre, age_rating, created_at, chapters(id), genre_info:genres(label)")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-display text-2xl">Өгүүллэг</h1>
        <div className="flex gap-2">
          <Link href="/admin/import" className={buttonClass("secondary", "sm")}>
            JSON оруулах
          </Link>
          <Link href="/admin/stories/new" className={buttonClass("primary", "sm")}>
            Шинэ өгүүллэг
          </Link>
        </div>
      </div>
      {msg ? <Notice>{msg}</Notice> : null}
      {error ? <Notice tone="accent">Жагсаалтыг ачаалж чадсангүй: {error.message}</Notice> : null}
      {(stories ?? []).length === 0 ? (
        <p className="text-muted">Өгүүллэг алга.</p>
      ) : (
        <StoryTable
          rows={stories!.map((s) => ({
            id: s.id,
            title: s.title,
            status: s.status,
            meta: `${s.genre_info?.label ?? s.genre} · ${ageLabel(s.age_rating)} · ${s.chapters.length} бүлэг`,
          }))}
        />
      )}
    </div>
  );
}
