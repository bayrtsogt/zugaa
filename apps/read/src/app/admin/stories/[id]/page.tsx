import Link from "next/link";
import { notFound } from "next/navigation";
import { buttonClass, Cover, SectionTitle } from "@zugaa/ui";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { StoryForm } from "../../forms";
import { deleteStory, setStoryStatus } from "../../actions";

export const metadata = { title: "Өгүүллэг засах" };

export default async function EditStory({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const supabase = await createClient();
  const { data: story } = await supabase
    .from("stories")
    .select("id, title, slug, description, cover_url, cover_color, genre, age_rating, price_coins, wait_free_hours, status")
    .eq("id", id)
    .maybeSingle();
  if (!story) notFound();
  const { data: chapters } = await supabase
    .from("chapters")
    .select("id, number, title, is_free, price_coins, published_at, is_ending")
    .eq("story_id", id)
    .order("number");
  const nextNumber = (chapters?.at(-1)?.number ?? 0) + 1;
  const published = story.status === "published";

  return (
    <div className="space-y-10">
      <div className="space-y-4">
        <Link href="/admin/stories" className="text-sm text-accent">
          ← Өгүүллэг
        </Link>
        <div className="flex flex-wrap items-start gap-5">
          <Cover title={story.title} color={story.cover_color} src={story.cover_url} className="w-24 shrink-0" />
          <div className="min-w-0 flex-1 space-y-3">
            <h1 className="font-serif text-2xl">{story.title}</h1>
            <p className={published ? "text-sm text-ok" : "text-sm text-muted"}>{published ? "Нийтлэгдсэн" : "Ноорог"}</p>
            <div className="flex flex-wrap gap-2">
              <form action={setStoryStatus}>
                <input type="hidden" name="id" value={story.id} />
                <input type="hidden" name="status" value={published ? "draft" : "published"} />
                <button type="submit" className={buttonClass(published ? "secondary" : "primary", "sm")}>
                  {published ? "Нийтлэлээс буулгах" : "Нийтлэх"}
                </button>
              </form>
              <Link href={`/s/${story.slug}`} className={buttonClass("quiet", "sm")}>
                Сайт дээр харах
              </Link>
            </div>
          </div>
        </div>
      </div>

      <section aria-labelledby="chapters" className="space-y-3">
        <SectionTitle
          action={
            <Link href={`/admin/stories/${story.id}/chapters/new?number=${nextNumber}`} className="text-sm text-accent">
              + Шинэ бүлэг
            </Link>
          }
        >
          <span id="chapters">Бүлгүүд</span>
        </SectionTitle>
        {(chapters ?? []).length === 0 ? (
          <p className="text-muted">Бүлэг алга.</p>
        ) : (
          <ol className="divide-y divide-line border-y border-line">
            {chapters!.map((c) => (
              <li key={c.id}>
                <Link href={`/admin/stories/${story.id}/chapters/${c.id}`} className="flex min-h-14 items-center justify-between gap-4 py-3 hover:text-accent">
                  <span className="min-w-0 truncate">
                    <span className="mr-2 tabular-nums text-muted">{c.number}.</span>
                    {c.title}
                  </span>
                  <span className="shrink-0 text-sm text-muted">
                    {c.is_free ? "Үнэгүй" : `${c.price_coins} coin`}
                    {c.is_ending ? " · төгсгөл" : ""}
                    {" · "}
                    {c.published_at ? <span className="text-ok">нийтлэгдсэн</span> : "ноорог"}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section aria-labelledby="details" className="max-w-page space-y-4">
        <SectionTitle>
          <span id="details">Мэдээлэл</span>
        </SectionTitle>
        <StoryForm story={story} />
      </section>

      <form action={deleteStory} className="border-t border-line pt-6">
        <input type="hidden" name="id" value={story.id} />
        <details>
          <summary className="min-h-11 cursor-pointer text-sm text-accent">Өгүүллэг устгах</summary>
          <p className="my-3 text-sm text-muted">Бүх бүлэг, худалдан авалт, уншсан түүх хамт устна. Буцаах боломжгүй.</p>
          <button type="submit" className={buttonClass("secondary", "sm")}>
            Тийм, устгах
          </button>
        </details>
      </form>
    </div>
  );
}
