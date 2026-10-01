import Link from "next/link";
import { Cover } from "@zugaa/ui";
import type { StoryCard } from "@/lib/content";
import { ageLabel, genreLabel } from "@/lib/labels";

export function StoryMeta({ story }: { story: Pick<StoryCard, "genre" | "age_rating"> }) {
  return (
    <span className="text-sm text-muted">
      {genreLabel(story.genre)}
      {story.age_rating !== "all" ? (
        <>
          <span aria-hidden> · </span>
          <span className={story.age_rating === "18" ? "text-accent" : undefined}>{ageLabel(story.age_rating)}</span>
        </>
      ) : null}
    </span>
  );
}

export function StoryList({ stories, priority = 0 }: { stories: StoryCard[]; priority?: number }) {
  return (
    <ul className="divide-y divide-line border-y border-line">
      {stories.map((s, i) => (
        <li key={s.id}>
          <Link href={`/s/${s.slug}`} className="group flex gap-4 py-4">
            <Cover title={s.title} color={s.cover_color} src={s.cover_url} size="sm" className="w-16 shrink-0" priority={i < priority} />
            <div className="min-w-0 flex-1">
              <h3 className="font-serif text-lg leading-snug text-ink group-hover:text-accent">{s.title}</h3>
              <StoryMeta story={s} />
              <p className="mt-1 line-clamp-2 text-sm text-muted">{s.description}</p>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
