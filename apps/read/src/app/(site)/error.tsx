"use client";
import { buttonClass } from "@zugaa/ui";

export default function SiteError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="space-y-4 py-10">
      <h1 className="font-serif text-2xl">Алдаа гарлаа</h1>
      <p className="text-muted">Мэдээллийг ачаалж чадсангүй. Дахин оролдоно уу.</p>
      <button type="button" onClick={reset} className={buttonClass("secondary", "md")}>
        Дахин оролдох
      </button>
    </div>
  );
}
