/*
 * Line-art illustrations (ink on paper, currentColor) used where a story has no
 * cover image, plus the small doodles of the welcome panel. Pure SVG: crisp at
 * any size, theme-aware, no network requests.
 */
import type { ReactNode } from "react";
import { cx } from "./index";

type Props = { className?: string };

function Art({ className, children, viewBox = "0 0 120 120" }: Props & { children: ReactNode; viewBox?: string }) {
  return (
    <svg
      viewBox={viewBox}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cx("block", className)}
      aria-hidden
    >
      {children}
    </svg>
  );
}

/** Mystery: a fingerprint of broken whorls. */
export function Fingerprint({ className }: Props) {
  return (
    <Art className={className}>
      <path d="M60 60c0-3 2-5 4-4" />
      <path d="M52 62c-1-8 4-13 10-12s9 6 8 13c-1 8-4 14-9 19" />
      <path d="M45 66c-3-13 4-23 15-24 11-1 18 8 17 20-1 11-5 20-12 28" />
      <path d="M40 76c-6-18 1-37 19-41 15-3 27 7 28 24 1 9-1 18-5 26" />
      <path d="M35 86c-9-20-6-46 15-57" />
      <path d="M56 26c19-4 36 8 39 27 2 13-1 25-6 35" />
      <path d="M31 96c-11-16-15-40-4-60" />
      <path d="M35 28c14-14 40-16 55-3" />
      <path d="M96 38c5 10 7 22 5 34" />
      <path d="M52 92c3-5 5-10 6-16" />
      <path d="M46 98c4-5 7-11 8-18" />
      <path d="M68 96c3-5 6-11 7-18" />
      <path d="M60 104c4-4 7-9 9-15" />
      <path d="M40 104c-4-4-7-9-9-14" />
      <path d="M24 46c-2 6-3 12-3 19" />
    </Art>
  );
}

/** Thriller: handcuffs. */
export function Handcuffs({ className }: Props) {
  return (
    <Art className={className}>
      <circle cx="36" cy="72" r="20" />
      <circle cx="36" cy="72" r="13" />
      <path d="M50 58l6-6M22 58l-4-6" />
      <rect x="27" y="44" width="18" height="10" rx="2" />
      <path d="M31 49h10" />
      <circle cx="86" cy="54" r="20" />
      <circle cx="86" cy="54" r="13" />
      <rect x="77" y="26" width="18" height="10" rx="2" />
      <path d="M81 31h10" />
      <path d="M53 50c3-2 6-3 9-2" />
      <ellipse cx="62" cy="47" rx="4" ry="2.5" transform="rotate(-20 62 47)" />
      <ellipse cx="68" cy="43" rx="4" ry="2.5" transform="rotate(20 68 43)" />
      <path d="M71 41c2-1 4-2 6-2" />
      <path d="M24 82c2 4 6 7 10 8M74 64c2 4 6 7 10 8" />
      <path d="M44 87l3 2M94 69l3 2" />
    </Art>
  );
}

/** Horror: a candle on a holder, with dripping wax. */
export function Candle({ className }: Props) {
  return (
    <Art className={className}>
      <path d="M60 14c-6 8-7 14-4 19 2 3 6 3 8 0 3-5 1-11-4-19z" />
      <path d="M60 24c-2 3-2 6 0 8" />
      <path d="M60 33v6" />
      <path d="M48 40h24v44H48z" />
      <path d="M48 40c3 5 6 5 8 0M56 40c1 8 4 9 6 2M66 40c1 5 3 6 6 3" />
      <path d="M52 50v26M56 48v30M67 50v28" opacity="0.55" />
      <path d="M38 84h44c0 5-4 8-9 8H47c-5 0-9-3-9-8z" />
      <path d="M44 92c-6 2-10 6-10 10h52c0-4-4-8-10-10" />
      <path d="M82 88c8 0 12 4 12 9s-4 8-9 8" />
      <path d="M30 106h60" />
      <path d="M40 98h40" opacity="0.55" />
    </Art>
  );
}

/** Romance: a sealed letter. */
export function Letter({ className }: Props) {
  return (
    <Art className={className}>
      <rect x="18" y="34" width="84" height="56" rx="2" />
      <path d="M18 36l42 30 42-30" />
      <path d="M18 88l30-24M102 88L72 64" />
      <circle cx="60" cy="66" r="9" />
      <path d="M60 71c-4-3-6-5-6-7a3 3 0 0 1 6-1 3 3 0 0 1 6 1c0 2-2 4-6 7z" />
      <path d="M26 82h12M26 78h8" opacity="0.55" />
    </Art>
  );
}

/** Other: an open book. */
export function OpenBook({ className }: Props) {
  return (
    <Art className={className}>
      <path d="M60 36c-10-7-26-9-42-6v58c16-3 32-1 42 6 10-7 26-9 42-6V30c-16-3-32-1-42 6z" />
      <path d="M60 36v58" />
      <path d="M26 44c9-1 18 0 26 4M26 54c9-1 18 0 26 4M26 64c9-1 18 0 26 4M26 74c9-1 18 0 26 4" opacity="0.6" />
      <path d="M68 48c8-4 17-5 26-4M68 58c8-4 17-5 26-4M68 68c8-4 17-5 26-4M68 78c8-4 17-5 26-4" opacity="0.6" />
      <path d="M54 30l6 4 6-4" />
    </Art>
  );
}

const BY_GENRE = {
  mystery: Fingerprint,
  thriller: Handcuffs,
  horror: Candle,
  romance: Letter,
  other: OpenBook,
} as const;

export function GenreArt({ genre, className }: { genre: string; className?: string }) {
  const C = BY_GENRE[genre as keyof typeof BY_GENRE] ?? OpenBook;
  return <C className={className} />;
}

/** Hand-drawn curling arrow pointing down-left. */
export function DrawnArrow({ className }: Props) {
  return (
    <Art className={className} viewBox="0 0 120 90">
      <path d="M108 8c-4 16-14 26-28 26-10 0-14-8-8-13 7-6 18 1 16 14-2 18-26 34-62 40" strokeWidth={2} />
      <path d="M38 66l-12 9 15 4" strokeWidth={2} />
    </Art>
  );
}

/** Welcome-panel doodles: speech bubbles holding a book, glasses, a pen. */
export function WelcomeDoodles({ className }: Props) {
  return (
    <Art className={className} viewBox="0 0 320 200">
      {/* bubble with open book */}
      <path d="M150 22c40-12 92-4 98 22 5 22-24 40-62 41-12 0-22-1-31-4l-22 12 8-17c-14-7-21-17-18-28 2-10 12-20 27-26z" />
      <path d="M168 50c8-5 18-6 27-2v24c-9-4-19-3-27 2zM195 48c9-4 19-3 27 2v24c-8-5-18-6-27-2" />
      {/* bubble with notebook + pen */}
      <path d="M30 70c4-26 52-34 76-18 20 13 12 40-16 46-12 3-26 2-36-2l-18 10 6-15c-9-5-13-12-12-21z" />
      <path d="M52 62h28v26H52zM56 68h18M56 74h18M56 80h12" />
      <path d="M86 58l8 26-3 4-4-3-8-26z" />
      {/* bubble with glasses */}
      <path d="M200 112c28-10 74-4 80 18 5 20-30 32-60 28l-18 12 4-16c-16-6-24-16-20-26 2-7 7-12 14-16z" />
      <circle cx="226" cy="134" r="9" />
      <circle cx="254" cy="134" r="9" />
      <path d="M235 134h10M217 132l-6-4M263 132l6-4" />
      {/* question / exclamation marks */}
      <path d="M40 130c0-8 14-8 14 0 0 6-7 6-7 13" />
      <circle cx="47" cy="152" r="1.5" fill="currentColor" />
      <path d="M288 50c0-8 14-8 14 0 0 6-7 6-7 13" />
      <circle cx="295" cy="72" r="1.5" fill="currentColor" />
      <path d="M120 150v18" />
      <circle cx="120" cy="176" r="1.5" fill="currentColor" />
      {/* small swirl */}
      <path d="M150 140c10-8 22-4 20 6-2 8-14 8-14 0 0-10 16-14 26-6" />
    </Art>
  );
}
