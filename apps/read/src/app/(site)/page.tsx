import Link from "next/link";
import { Cover, SectionTitle } from "@zugaa/ui";
import { formatRelative } from "@zugaa/wallet";
import { getUser } from "@/lib/auth";
import { getContinueReading, getNewChapters, listStories } from "@/lib/content";
import { GENRES } from "@/lib/labels";
import { StoryList } from "@/components/story-list";

export default async function HomePage() {
  const user = await getUser();
  const [continueItems, newChapters, stories] = await Promise.all([
    user ? getContinueReading(user.id, 3) : Promise.resolve([]),
    getNewChapters(5),
    listStories({ limit: 8 }),
  ]);

  return (
    <div className="space-y-10">
      <h1 className="sr-only">Зугаа — Унших</h1>

      {continueItems.length > 0 ? (
        <section aria-labelledby="continue">
          <SectionTitle>
            <span id="continue">Үргэлжлүүлэн унших</span>
          </SectionTitle>
          <ul className="space-y-3">
            {continueItems.map((c) => (
              <li key={c.story.slug}>
                <Link href={`/s/${c.story.slug}/${c.chapter.number}`} className="group flex items-center gap-4 py-1">
                  <Cover title={c.story.title} color={c.story.cover_color} src={c.story.cover_url} size="sm" className="w-11 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-serif text-lg group-hover:text-accent">{c.story.title}</p>
                    <p className="text-sm text-muted">
                      Бүлэг {c.chapter.number} · {c.chapter.title}
                    </p>
                    <div className="mt-2 h-px w-full bg-line" aria-hidden>
                      <div className="h-px bg-accent" style={{ width: `${Math.round(c.scroll_pct)}%` }} />
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {newChapters.length > 0 ? (
        <section aria-labelledby="new">
          <SectionTitle>
            <span id="new">Шинэ бүлгүүд</span>
          </SectionTitle>
          <ul className="divide-y divide-line border-y border-line">
            {newChapters.map((c) => (
              <li key={c.id}>
                <Link href={`/s/${c.story.slug}/${c.number}`} className="group flex min-h-14 items-baseline justify-between gap-4 py-3">
                  <span className="min-w-0">
                    <span className="block truncate group-hover:text-accent">
                      {c.number}. {c.title}
                    </span>
                    <span className="block truncate text-sm text-muted">{c.story.title}</span>
                  </span>
                  <span className="shrink-0 text-xs text-muted">{formatRelative(c.published_at)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="genres">
        <SectionTitle>
          <span id="genres">Төрөл</span>
        </SectionTitle>
        <ul className="flex flex-wrap gap-2">
          {GENRES.map((g) => (
            <li key={g.value}>
              <Link
                href={`/library?genre=${g.value}`}
                className="inline-flex min-h-11 items-center rounded-sm border border-line px-4 text-sm hover:border-field"
              >
                {g.label}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="stories">
        <SectionTitle
          action={
            <Link href="/library" className="text-sm text-accent underline-offset-4 hover:underline">
              Бүгд
            </Link>
          }
        >
          <span id="stories">Өгүүллэгүүд</span>
        </SectionTitle>
        {stories.length > 0 ? (
          <StoryList stories={stories} priority={2} />
        ) : (
          <p className="text-muted">Одоогоор нийтлэгдсэн өгүүллэг алга.</p>
        )}
      </section>
    </div>
  );
}
