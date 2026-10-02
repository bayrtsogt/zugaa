"use client";
import Link from "next/link";
import { useActionState, useState } from "react";
import { Notice, cx, fieldClass } from "@zugaa/ui";
import { bulkStories, type BulkResult } from "../actions";

type Row = { id: string; title: string; status: string; meta: string };

export function StoryTable({ rows }: { rows: Row[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [state, action, pending] = useActionState<BulkResult, FormData>(bulkStories, {});
  const [confirmText, setConfirmText] = useState("");
  const all = rows.length > 0 && selected.size === rows.length;
  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <form action={action} className="space-y-4">
      {[...selected].map((id) => (
        <input key={id} type="hidden" name="ids" value={id} />
      ))}
      {state.ok ? <Notice tone="ok">{state.ok}</Notice> : null}
      {state.error ? <Notice tone="accent">{state.error}</Notice> : null}

      <div className="flex flex-wrap items-center gap-2 border-y border-line py-3">
        <label className="inline-flex min-h-11 items-center gap-2 pr-2 text-sm">
          <input
            type="checkbox"
            checked={all}
            onChange={() => setSelected(all ? new Set() : new Set(rows.map((r) => r.id)))}
            className="h-5 w-5 accent-[var(--zg-accent)]"
          />
          Бүгдийг сонгох
        </label>
        <span className="text-sm text-muted">{selected.size} сонгосон</span>
        <div className="ml-auto flex flex-wrap gap-2">
          <button type="submit" name="bulk" value="publish" disabled={pending || !selected.size} className="min-h-11 rounded-full border border-field px-4 text-sm disabled:opacity-50">
            Нийтлэх
          </button>
          <button type="submit" name="bulk" value="hide" disabled={pending || !selected.size} className="min-h-11 rounded-full border border-field px-4 text-sm disabled:opacity-50">
            Нуух (ноорог)
          </button>
        </div>
      </div>

      <ul className="divide-y divide-line border-b border-line">
        {rows.map((s) => (
          <li key={s.id} className="flex items-center gap-3">
            <input
              type="checkbox"
              aria-label={`${s.title} сонгох`}
              checked={selected.has(s.id)}
              onChange={() => toggle(s.id)}
              className="h-5 w-5 shrink-0 accent-[var(--zg-accent)]"
            />
            <Link href={`/admin/stories/${s.id}`} className="flex min-h-14 flex-1 items-center justify-between gap-4 py-3 hover:text-accent">
              <span className="min-w-0">
                <span className="block truncate font-display text-lg">{s.title}</span>
                <span className="block text-sm text-muted">{s.meta}</span>
              </span>
              <span className={s.status === "published" ? "text-sm text-ok" : "text-sm text-muted"}>
                {s.status === "published" ? "Нийтлэгдсэн" : "Ноорог"}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {selected.size > 0 ? (
        <section className="space-y-2 rounded-sm border border-accent/40 p-4">
          <p className="text-sm">
            <strong>{selected.size}</strong> өгүүллэгийг бүх бүлэг, худалдан авалт, уншсан түүхтэй нь{" "}
            <strong>бүрмөсөн устгана</strong>. Буцаах боломжгүй. Түр нуух бол «Нуух» товчийг ашиглана уу.
          </p>
          <div className="flex flex-wrap gap-2">
            <input
              name="confirm"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="УСТГАХ гэж бичнэ үү"
              aria-label="Баталгаажуулах"
              className={cx(fieldClass, "min-h-11 max-w-56 text-sm")}
            />
            <button
              type="submit"
              name="bulk"
              value="delete"
              disabled={pending || confirmText !== "УСТГАХ"}
              className="min-h-11 rounded-full bg-fill px-5 text-sm text-fill-ink disabled:opacity-50"
            >
              {pending ? "Устгаж байна…" : `${selected.size} өгүүллэг устгах`}
            </button>
          </div>
        </section>
      ) : null}
    </form>
  );
}
