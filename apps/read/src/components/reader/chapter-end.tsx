import Link from "next/link";
import { buttonClass } from "@zugaa/ui";
import type { ChapterView } from "@/lib/content";
import { FollowButton } from "@/components/follow-button";

export function ChapterEnd({ chapter, following }: { chapter: ChapterView; following: boolean }) {
  const base = `/s/${chapter.story_slug}`;
  const choices = chapter.choices ?? [];

  if (choices.length > 0) {
    const pictured = choices.some((c) => c.image_url);
    return (
      <nav aria-labelledby="choices-title" className="space-y-3">
        <h2 id="choices-title" className="text-sm font-medium text-muted">
          Та юу хийх вэ?
        </h2>
        {pictured ? (
          <ul className="grid grid-cols-2 gap-3">
            {choices.map((c) => (
              <li key={`${c.target_number}-${c.label}`}>
                <Link
                  href={`${base}/${c.target_number}`}
                  className="group block overflow-hidden rounded-md border border-field bg-surface transition-colors hover:border-ink focus-visible:border-ink"
                >
                  <span className="relative block aspect-[4/3] bg-line">
                    {c.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element -- storage images, fixed aspect box
                      <img src={c.image_url} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
                    ) : null}
                  </span>
                  <span className="block px-3 py-3 font-display text-lg leading-snug">{c.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <ul className="space-y-2">
            {choices.map((c) => (
              <li key={`${c.target_number}-${c.label}`}>
                <Link href={`${base}/${c.target_number}`} className={buttonClass("secondary", "md", "w-full justify-start text-left font-display")}>
                  {c.label}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </nav>
    );
  }

  if (chapter.continues_later && !chapter.is_ending) {
    return (
      <div className="space-y-4 text-center">
        <p className="font-display text-xl">Үргэлжлэл удахгүй гарна</p>
        <p className="text-sm text-muted">
          Дараагийн бүлгүүд бичигдэж байна. Таны уншсан газар хадгалагдсан.
          {following ? " Шинэ бүлэг гармагц танд мэдэгдэнэ." : ""}
        </p>
        <FollowButton storyId={chapter.story_id} following={following} path={`${base}/${chapter.number}`} className="mx-auto max-w-xs" />
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Link href={base} className={buttonClass("secondary", "md")}>
            Өгүүллэгийн хуудас
          </Link>
          <Link href="/library" className={buttonClass("quiet", "md")}>
            Өөр өгүүллэг унших
          </Link>
        </div>
      </div>
    );
  }

  if (chapter.is_ending || chapter.next_number == null) {
    return (
      <div className="space-y-4 text-center">
        <p className="font-display text-xl">Төгсгөл</p>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Link href={base} className={buttonClass("secondary", "md")}>
            Өгүүллэгийн хуудас
          </Link>
          <Link href="/library" className={buttonClass("quiet", "md")}>
            Өөр өгүүллэг унших
          </Link>
        </div>
      </div>
    );
  }

  return (
    <nav aria-label="Бүлэг хооронд" className="flex flex-col gap-2">
      <Link href={`${base}/${chapter.next_number}`} className={buttonClass("primary", "md", "w-full")}>
        Дараагийн бүлэг
      </Link>
      {chapter.prev_number != null ? (
        <Link href={`${base}/${chapter.prev_number}`} className={buttonClass("quiet", "sm", "self-center")}>
          Өмнөх бүлэг
        </Link>
      ) : null}
    </nav>
  );
}
