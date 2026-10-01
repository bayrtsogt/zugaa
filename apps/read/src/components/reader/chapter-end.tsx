import Link from "next/link";
import { buttonClass } from "@zugaa/ui";
import type { ChapterView } from "@/lib/content";

export function ChapterEnd({ chapter }: { chapter: ChapterView }) {
  const base = `/s/${chapter.story_slug}`;
  const choices = chapter.choices ?? [];

  if (choices.length > 0) {
    return (
      <nav aria-labelledby="choices-title" className="space-y-3">
        <h2 id="choices-title" className="text-sm font-medium text-muted">
          Та юу хийх вэ?
        </h2>
        <ul className="space-y-2">
          {choices.map((c) => (
            <li key={`${c.target_number}-${c.label}`}>
              <Link href={`${base}/${c.target_number}`} className={buttonClass("secondary", "md", "w-full justify-start text-left font-serif")}>
                {c.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    );
  }

  if (chapter.continues_later && !chapter.is_ending) {
    return (
      <div className="space-y-4 text-center">
        <p className="font-serif text-xl">Үргэлжлэл удахгүй гарна</p>
        <p className="text-sm text-muted">Дараагийн бүлгүүд бичигдэж байна. Таны уншсан газар хадгалагдсан.</p>
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
        <p className="font-serif text-xl">Төгсгөл</p>
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
