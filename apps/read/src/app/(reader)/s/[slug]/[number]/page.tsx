import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getUser } from "@/lib/auth";
import { getChapter, getProgress } from "@/lib/content";
import { renderMarkdown } from "@/lib/markdown";
import { ReaderChrome } from "@/components/reader/reader-chrome";
import { LockPanel } from "@/components/reader/lock-panel";
import { GatePanel } from "@/components/reader/gate-panel";
import { ChapterEnd } from "@/components/reader/chapter-end";
import { isFollowing } from "@/lib/follows";

type Params = { params: Promise<{ slug: string; number: string }> };

function parseNumber(raw: string): number | null {
  return /^[1-9][0-9]{0,4}$/.test(raw) ? Number(raw) : null;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug, number } = await params;
  const n = parseNumber(number);
  const chapter = n ? await getChapter(slug, n) : null;
  if (!chapter) return { title: "Олдсонгүй" };
  // Metadata never carries chapter text.
  return {
    title: `${chapter.number}. ${chapter.title} — ${chapter.story_title}`,
    description: `«${chapter.story_title}» өгүүллэгийн ${chapter.number}-р бүлэг. Зугаа дээр уншаарай.`,
    alternates: { canonical: `/s/${slug}/${chapter.number}` },
    robots: chapter.locked || chapter.gate ? { index: false } : undefined,
    openGraph: chapter.image_url && !chapter.gate ? { images: [{ url: chapter.image_url }] } : undefined,
  };
}

export default async function ReaderPage({ params }: Params) {
  const { slug, number } = await params;
  const n = parseNumber(number);
  if (!n) notFound();
  const [chapter, user] = await Promise.all([getChapter(slug, n), getUser()]);
  if (!chapter) notFound();

  const path = `/s/${slug}/${chapter.number}`;
  const open = !chapter.locked && !chapter.gate;
  const [progress, following] = await Promise.all([
    user && open ? getProgress(user.id, chapter.story_id) : null,
    user && open && chapter.continues_later ? isFollowing(user.id, chapter.story_id) : false,
  ]);
  const initialPct = progress?.chapter_id === chapter.id ? Number(progress.scroll_pct) : 0;
  const html = chapter.content ? renderMarkdown(chapter.content) : "";

  return (
    <ReaderChrome
      backHref={`/s/${slug}`}
      storyTitle={chapter.story_title}
      chapterLabel={`Бүлэг ${chapter.number}`}
      chapterId={chapter.id}
      saveProgress={Boolean(user) && open}
      initialPct={initialPct}
    >
      <main id="main" className="mx-auto px-5 pb-24 pt-10 sm:px-8" style={{ maxWidth: "calc(var(--zg-read-measure) + 4rem)" }}>
        <article className="mx-auto" style={{ maxWidth: "var(--zg-read-measure)" }}>
          <header className="mb-8 space-y-2">
            <p className="text-sm text-muted">Бүлэг {chapter.number}</p>
            <h1 className="font-display text-2xl leading-tight sm:text-3xl">{chapter.title}</h1>
          </header>

          {chapter.image_url && !chapter.gate ? (
            <figure className="relative -mx-5 mb-8 aspect-[3/2] overflow-hidden bg-line sm:mx-0 sm:rounded-md">
              {/* eslint-disable-next-line @next/next/no-img-element -- storage image in a fixed aspect box (no layout shift, scroll restore stays exact) */}
              <img src={chapter.image_url} alt="" fetchPriority="high" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
            </figure>
          ) : null}

          {chapter.gate ? (
            <GatePanel gate={chapter.gate} path={path} storyHref={`/s/${slug}`} />
          ) : (
            <div className="relative">
              <div className="prose-read" dangerouslySetInnerHTML={{ __html: html }} />
              {chapter.locked ? (
                <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-linear-to-b from-transparent to-paper" />
              ) : null}
            </div>
          )}

          {chapter.gate ? null : chapter.locked ? (
            <div className="mt-6">
              <p className="sr-only">Үргэлжлэлийг унших бол бүлгийг нээнэ үү.</p>
              <LockPanel chapter={chapter} signedIn={Boolean(user)} path={path} />
            </div>
          ) : (
            <footer className="mt-12 border-t border-line pt-8">
              <ChapterEnd chapter={chapter} following={following} />
            </footer>
          )}
        </article>
      </main>
    </ReaderChrome>
  );
}
