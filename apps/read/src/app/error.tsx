"use client";
import Link from "next/link";
import { useEffect } from "react";
import { buttonClass } from "@zugaa/ui";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main id="main" className="mx-auto max-w-page space-y-6 px-4 py-20">
      <h1 className="font-display text-3xl">Алдаа гарлаа</h1>
      <p className="text-muted">Түр зуурын саатал байж магадгүй. Дахин оролдоно уу. Интернэт холболтоо шалгана уу.</p>
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={reset} className={buttonClass("primary", "md")}>
          Дахин оролдох
        </button>
        <Link href="/" className={buttonClass("secondary", "md")}>
          Нүүр хуудас
        </Link>
      </div>
      {error.digest ? <p className="text-xs text-muted">Код: {error.digest}</p> : null}
    </main>
  );
}
