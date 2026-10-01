import Link from "next/link";
import { buttonClass } from "@zugaa/ui";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { ageLabel, genreLabel } from "@/lib/labels";

export const metadata = { title: "Өгүүллэг" };

export default async function AdminStories() {
  await requireAdmin();
  const supabase = await createClient();
  const { data: stories } = await supabase
    .from("stories")
    .select("id, title, slug, status, genre, age_rating, created_at, chapters(count)")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-serif text-2xl">Өгүүллэг</h1>
        <div className="flex gap-2">
          <Link href="/admin/import" className={buttonClass("secondary", "sm")}>
            JSON оруулах
          </Link>
          <Link href="/admin/stories/new" className={buttonClass("primary", "sm")}>
            Шинэ өгүүллэг
          </Link>
        </div>
      </div>
      {(stories ?? []).length === 0 ? (
        <p className="text-muted">Өгүүллэг алга.</p>
      ) : (
        <ul className="divide-y divide-line border-y border-line">
          {stories!.map((s) => (
            <li key={s.id}>
              <Link href={`/admin/stories/${s.id}`} className="flex min-h-14 items-center justify-between gap-4 py-3 hover:text-accent">
                <span className="min-w-0">
                  <span className="block truncate font-serif text-lg">{s.title}</span>
                  <span className="block text-sm text-muted">
                    {genreLabel(s.genre)} · {ageLabel(s.age_rating)} · {s.chapters[0]?.count ?? 0} бүлэг
                  </span>
                </span>
                <span className={s.status === "published" ? "text-sm text-ok" : "text-sm text-muted"}>
                  {s.status === "published" ? "Нийтлэгдсэн" : "Ноорог"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
