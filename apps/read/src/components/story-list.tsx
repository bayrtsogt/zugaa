import Link from "next/link";
import { Cover } from "@zugaa/ui";
import type { StoryCard } from "@/lib/content";
import { ageLabel } from "@/lib/labels";

export function StoryMeta({ story }: { story: Pick<StoryCard, "genre" | "age_rating" | "genre_info"> }) {
  return (
    <span className="text-sm text-muted">
      {story.genre_info?.label ?? story.genre}
      {story.age_rating !== "all" ? (
        <>
          <span aria-hidden> · </span>
          <span className={story.age_rating === "18" ? "text-accent" : undefined}>{ageLabel(story.age_rating)}</span>
        </>
      ) : null}
    </span>
  );
}

/** Airy list: line art on the left, bold serif title, genre, three lines of blurb. */
export function StoryList({ stories, priority = 0 }: { stories: StoryCard[]; priority?: number }) {
  return (
    <ul className="space-y-7">
      {stories.map((s, i) => (
        <li key={s.id}>
          <Link href={`/s/${s.slug}`} className="group flex items-start gap-5">
            <Cover title={s.title} genre={s.genre_info?.art ?? "other"} src={s.cover_url} className="w-20 shrink-0 sm:w-24" priority={i < priority} />
            <div className="min-w-0 flex-1 pt-1">
              <h3 className="font-serif text-lg font-semibold leading-snug text-ink group-hover:underline group-hover:underline-offset-4">
                {s.title}
              </h3>
              <StoryMeta story={s} />
              <p className="mt-1.5 line-clamp-3 font-serif text-sm leading-relaxed text-muted">{s.description}</p>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
