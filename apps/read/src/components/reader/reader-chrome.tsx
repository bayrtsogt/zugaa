"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Icon, cx } from "@zugaa/ui";
import { SettingsSheet } from "./settings-sheet";

type Props = {
  backHref: string;
  storyTitle: string;
  chapterLabel: string;
  chapterId: string;
  /** Save progress only for signed-in readers of open chapters. */
  saveProgress: boolean;
  initialPct: number;
  children: React.ReactNode;
};

const SAVE_DEBOUNCE_MS = 2000;

function currentPct(): number {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  if (max <= 0) return 100;
  return Math.min(100, Math.max(0, (window.scrollY / max) * 100));
}

function send(chapterId: string, pct: number, keepalive = false) {
  return fetch("/api/progress", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chapterId, pct: Math.round(pct * 100) / 100 }),
    keepalive,
  }).catch(() => {});
}

export function ReaderChrome({ backHref, storyTitle, chapterLabel, chapterId, saveProgress, initialPct, children }: Props) {
  const [hidden, setHidden] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);
  const lastY = useRef(0);
  const lastSaved = useRef(-1);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Restore position once, after the server-rendered text is in place.
  useEffect(() => {
    if (initialPct > 0 && initialPct < 99 && !window.location.hash) {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      window.scrollTo({ top: (max * initialPct) / 100, behavior: "instant" as ScrollBehavior });
    }
    lastY.current = window.scrollY;
  }, [initialPct]);

  useEffect(() => {
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const y = window.scrollY;
        const pct = currentPct();
        if (barRef.current) barRef.current.style.transform = `scaleX(${pct / 100})`;
        if (y > lastY.current + 6 && y > 64) setHidden(true);
        else if (y < lastY.current - 6 || y < 64) setHidden(false);
        lastY.current = y;

        if (saveProgress) {
          clearTimeout(timer.current);
          timer.current = setTimeout(() => {
            if (Math.abs(pct - lastSaved.current) >= 1) {
              lastSaved.current = pct;
              void send(chapterId, pct);
            }
          }, SAVE_DEBOUNCE_MS);
        }
      });
    };
    const onHide = () => {
      if (!saveProgress || document.visibilityState !== "hidden") return;
      const pct = currentPct();
      if (Math.abs(pct - lastSaved.current) >= 1) {
        lastSaved.current = pct;
        void send(chapterId, pct, true);
      }
    };
    onScroll();
    if (saveProgress && lastSaved.current < 0) {
      // Record that this chapter was opened, even before scrolling.
      lastSaved.current = initialPct;
      void send(chapterId, initialPct);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("visibilitychange", onHide);
      cancelAnimationFrame(frame);
      clearTimeout(timer.current);
    };
  }, [chapterId, saveProgress, initialPct]);

  return (
    <>
      <div className="fixed inset-x-0 top-0 z-40 h-0.5" aria-hidden>
        <div ref={barRef} className="h-full origin-left bg-accent" style={{ transform: "scaleX(0)" }} />
      </div>
      <header
        className={cx(
          "fixed inset-x-0 top-0 z-30 border-b border-line bg-paper transition-transform duration-[var(--duration-base)] ease-[var(--ease-out)]",
          hidden && !settingsOpen && "-translate-y-full",
        )}
      >
        <div className="mx-auto flex h-14 max-w-page items-center gap-1 px-2">
          <Link href={backHref} className="flex min-h-11 min-w-11 items-center justify-center text-muted hover:text-ink" aria-label="Өгүүллэг рүү буцах">
            <Icon.Back />
          </Link>
          <div className="min-w-0 flex-1 text-center">
            <p className="truncate text-sm text-ink">{storyTitle}</p>
            <p className="truncate text-xs text-muted">{chapterLabel}</p>
          </div>
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="flex min-h-11 min-w-11 items-center justify-center text-muted hover:text-ink"
            aria-label="Унших тохиргоо"
            aria-haspopup="dialog"
            aria-expanded={settingsOpen}
          >
            <Icon.Type />
          </button>
        </div>
      </header>
      <div className="pt-14">{children}</div>
      <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}
