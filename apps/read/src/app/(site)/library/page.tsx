import type { Metadata } from "next";
import Link from "next/link";
import { Icon, cx, fieldClass } from "@zugaa/ui";
import { listStories } from "@/lib/content";
import { getGenres } from "@/lib/genres";
import { StoryList } from "@/components/story-list";

export const metadata: Metadata = {
  title: "Номын сан",
  description: "Бүх өгүүллэг: аймшиг, нууцлаг, триллер, хайр дурлал.",
};

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ genre?: string; q?: string; focus?: string }>;
}) {
  const sp = await searchParams;
  const genres = await getGenres();
  const genre = genres.some((g) => g.slug === sp.genre) ? sp.genre : undefined;
  const q = (sp.q ?? "").slice(0, 60);
  const stories = await listStories({ genre, q });

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-bold tracking-tight">Номын сан</h1>

      <form role="search" action="/library" className="relative">
        {genre ? <input type="hidden" name="genre" value={genre} /> : null}
        <label htmlFor="q" className="sr-only">
          Хайх
        </label>
        <Icon.Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input id="q" name="q" type="search" defaultValue={q} placeholder="Нэр, агуулгаар хайх" className={cx(fieldClass, "rounded-full pl-10")} autoFocus={sp.focus === "search"} />
      </form>

      <nav aria-label="Төрөл">
        <ul className="flex flex-wrap gap-2">
          <li>
            <Link
              href={q ? `/library?q=${encodeURIComponent(q)}` : "/library"}
              aria-current={!genre ? "page" : undefined}
              className={cx(
                "inline-flex min-h-11 items-center rounded-full border px-5 text-sm",
                !genre ? "border-ink bg-ink text-paper" : "border-ink/40 hover:border-ink",
              )}
            >
              Бүгд
            </Link>
          </li>
          {genres.map((g) => {
            const active = genre === g.slug;
            const params = new URLSearchParams({ genre: g.slug, ...(q ? { q } : {}) });
            return (
              <li key={g.slug}>
                <Link
                  href={`/library?${params}`}
                  aria-current={active ? "page" : undefined}
                  className={cx(
                    "inline-flex min-h-11 items-center rounded-full border px-5 text-sm",
                    active ? "border-ink bg-ink text-paper" : "border-ink/40 hover:border-ink",
                  )}
                >
                  {g.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {stories.length > 0 ? (
        <StoryList stories={stories} priority={3} />
      ) : (
        <p className="py-8 text-muted">{q ? `«${q}» гэсэн хайлтаар өгүүллэг олдсонгүй.` : "Энэ төрөлд өгүүллэг алга байна."}</p>
      )}
    </div>
  );
}
