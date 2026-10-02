import Link from "next/link";
import { Cover, DrawnArrow, SectionTitle } from "@zugaa/ui";
import { formatRelative } from "@zugaa/wallet";
import { getUser } from "@/lib/auth";
import { getContinueReading, getNewChapters, listStories } from "@/lib/content";
import { getGenres } from "@/lib/genres";
import { StoryList } from "@/components/story-list";
import { getStoryUpdates } from "@/lib/follows";

export default async function HomePage() {
  const user = await getUser();
  const [updates, continueItems, newChapters, stories, genres] = await Promise.all([
    user ? getStoryUpdates() : Promise.resolve([]),
    user ? getContinueReading(user.id, 3) : Promise.resolve([]),
    getNewChapters(5),
    listStories({ limit: 8 }),
    getGenres(),
  ]);

  return (
    <div className="space-y-12">
      <header className="relative pr-20 pt-4">
        <h1 className="font-display text-[2.25rem] font-bold leading-[1.1] tracking-tight sm:text-5xl">
          Өнөөдөр юу
          <br />
          унших вэ?
        </h1>
        <p className="mt-3 text-muted">Монгол өгүүллэг, бүлэг бүлгээр</p>
        <DrawnArrow className="absolute right-0 top-8 h-20 w-24 text-ink sm:right-6" />
      </header>

      {updates.length > 0 ? (
        <section aria-labelledby="updates" className="rounded-md border border-ink px-4 py-4">
          <h2 id="updates" className="mb-3 font-display text-xl">
            Дагаж буй өгүүллэгт шинэ бүлэг
          </h2>
          <ul className="space-y-3">
            {updates.map((u) => (
              <li key={u.story_id}>
                <Link href={`/s/${u.slug}/${u.first_new_number}`} className="group flex items-center gap-4">
                  <Cover title={u.title} genre={genres.find((g) => g.slug === u.genre)?.art ?? "other"} src={u.cover_url} className="w-12 shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-display text-lg group-hover:underline group-hover:underline-offset-4">{u.title}</span>
                    <span className="block truncate text-sm text-muted">
                      {u.first_new_number}. {u.first_new_title}
                      {u.new_chapters > 1 ? ` · +${u.new_chapters - 1} бүлэг` : ""}
                    </span>
                  </span>
                  <span className="shrink-0 rounded-full bg-accent px-2.5 py-0.5 text-sm text-paper">Шинэ</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {continueItems.length > 0 ? (
        <section aria-labelledby="continue">
          <SectionTitle>
            <span id="continue">Үргэлжлүүлэн унших</span>
          </SectionTitle>
          <ul className="space-y-4">
            {continueItems.map((c) => (
              <li key={c.story.slug}>
                <Link href={`/s/${c.story.slug}/${c.chapter.number}`} className="group flex items-center gap-4">
                  <Cover title={c.story.title} genre={c.story.genre_info?.art ?? "other"} src={c.story.cover_url} className="w-12 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-lg font-semibold group-hover:underline group-hover:underline-offset-4">{c.story.title}</p>
                    <p className="text-sm text-muted">
                      Бүлэг {c.chapter.number} · {c.chapter.title}
                    </p>
                    <div className="mt-2 h-0.5 w-full rounded-full bg-line" aria-hidden>
                      <div className="h-0.5 rounded-full bg-ink" style={{ width: `${Math.round(c.scroll_pct)}%` }} />
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="stories">
        <SectionTitle
          action={
            <Link href="/library" className="text-sm text-ink underline underline-offset-4">
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

      {newChapters.length > 0 ? (
        <section aria-labelledby="new">
          <SectionTitle>
            <span id="new">Шинэ бүлгүүд</span>
          </SectionTitle>
          <ul className="divide-y divide-line">
            {newChapters.map((c) => (
              <li key={c.id}>
                <Link href={`/s/${c.story.slug}/${c.number}`} className="group flex min-h-14 items-baseline justify-between gap-4 py-3">
                  <span className="min-w-0">
                    <span className="block truncate font-display group-hover:underline group-hover:underline-offset-4">
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
          {genres.map((g) => (
            <li key={g.slug}>
              <Link
                href={`/library?genre=${g.slug}`}
                className="inline-flex min-h-11 items-center rounded-full border border-ink/80 px-5 text-sm hover:bg-ink hover:text-paper"
              >
                {g.label}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
