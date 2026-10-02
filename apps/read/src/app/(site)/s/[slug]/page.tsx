import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Cover, Icon, SectionTitle, buttonClass } from "@zugaa/ui";
import { formatCoins } from "@zugaa/wallet";
import { getUser } from "@/lib/auth";
import { getProgress, getStory, getStoryChapters } from "@/lib/content";
import { StoryMeta } from "@/components/story-list";
import { FollowButton } from "@/components/follow-button";
import { isFollowing } from "@/lib/follows";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const story = await getStory(slug);
  if (!story) return { title: "Олдсонгүй" };
  const description = story.description.slice(0, 180);
  return {
    title: story.title,
    description,
    alternates: { canonical: `/s/${story.slug}` },
    openGraph: {
      title: story.title,
      description,
      type: "book",
      url: `/s/${story.slug}`,
      images: story.cover_url ? [{ url: story.cover_url }] : undefined,
    },
    robots: story.status === "published" ? undefined : { index: false },
  };
}

export default async function StoryPage({ params }: Params) {
  const { slug } = await params;
  const story = await getStory(slug);
  if (!story) notFound();

  const user = await getUser();
  const [chapters, progress, following] = await Promise.all([
    getStoryChapters(story.id),
    user ? getProgress(user.id, story.id) : Promise.resolve(null),
    user ? isFollowing(user.id, story.id) : Promise.resolve(false),
  ]);

  const first = chapters[0];
  const resume = progress ? chapters.find((c) => c.id === progress.chapter_id) : undefined;
  const lockedCount = chapters.filter((c) => !c.has_access).length;

  return (
    <article className="space-y-8">
      {story.status !== "published" ? (
        <p className="text-sm text-accent">Ноорог — зөвхөн админд харагдана.</p>
      ) : null}

      <header className="flex gap-5">
        <Cover title={story.title} genre={story.genre_info?.art ?? "other"} src={story.cover_url} className="w-28 shrink-0 sm:w-36" priority />
        <div className="min-w-0 space-y-2 pt-1">
          <h1 className="font-display text-3xl font-bold leading-tight tracking-tight sm:text-4xl">{story.title}</h1>
          <StoryMeta story={story} />
          <p className="text-sm text-muted">
            {chapters.length} бүлэг
            {story.wait_free_hours ? ` · ${story.wait_free_hours} цаг тутамд нэг бүлэг үнэгүй` : ""}
          </p>
          {story.ongoing ? <p className="text-sm font-medium text-accent">Үргэлжилж байна · шинэ бүлэг нэмэгдэнэ</p> : null}
        </div>
      </header>

      <p className="text-lg leading-relaxed">{story.description}</p>

      {story.age_rating === "18" ? (
        <p className="text-sm text-muted">18 наснаас дээш уншигчдад. Эхлэхийн өмнө төрсөн оноо нэг удаа асууна.</p>
      ) : null}

      {first ? (
        <div className="flex flex-wrap gap-3">
          {resume ? (
            <>
              <Link href={`/s/${story.slug}/${resume.number}`} className={buttonClass("primary", "md", "flex-1 sm:flex-none")}>
                Үргэлжлүүлэх · {resume.number}-р бүлэг
              </Link>
              <Link href={`/s/${story.slug}/${first.number}`} className={buttonClass("secondary", "md")}>
                Эхнээс
              </Link>
            </>
          ) : (
            <Link href={`/s/${story.slug}/${first.number}`} className={buttonClass("primary", "md", "flex-1 sm:flex-none")}>
              Унших
            </Link>
          )}
        </div>
      ) : null}

      {story.status === "published" ? (
        <FollowButton storyId={story.id} following={following} path={`/s/${story.slug}`} className="sm:max-w-xs" />
      ) : null}

      <section aria-labelledby="chapters">
        <SectionTitle
          action={
            lockedCount > 0 && story.price_coins ? (
              <span className="text-sm text-muted">Бүтэн өгүүллэг {formatCoins(story.price_coins)}</span>
            ) : undefined
          }
        >
          <span id="chapters">Бүлгүүд</span>
        </SectionTitle>
        {chapters.length === 0 ? (
          <p className="text-muted">Бүлэг удахгүй нэмэгдэнэ.</p>
        ) : (
          <ol className="divide-y divide-line border-y border-line">
            {chapters.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/s/${story.slug}/${c.number}`}
                  className="group flex min-h-14 items-center justify-between gap-4 py-3"
                >
                  <span className="min-w-0">
                    <span className="mr-2 tabular-nums text-muted">{c.number}.</span>
                    <span className="group-hover:text-accent">{c.title}</span>
                    {c.id === resume?.id ? <span className="ml-2 text-sm text-accent">· уншиж байгаа</span> : null}
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5 text-sm text-muted">
                    {c.is_free ? (
                      "Үнэгүй"
                    ) : c.has_access ? null : (
                      <>
                        <span>{formatCoins(c.price_coins)}</span>
                        <Icon.Lock className="h-4 w-4 text-accent" title="Түгжээтэй" />
                      </>
                    )}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </section>
    </article>
  );
}
