"use client";
import Link from "next/link";
import { useMemo, useRef, useState, useTransition } from "react";
import { Button, Notice, cx, fieldClass } from "@zugaa/ui";
import { validateImport } from "@/lib/story-import";
import { checkImport, importStories, type CheckResult, type ImportResult } from "./actions";

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  a.click();
  URL.revokeObjectURL(url);
}

/** Merges several JSON files/snippets into one array of stories. */
function mergeTexts(texts: string[]): string {
  const items: unknown[] = [];
  for (const t of texts) {
    const parsed = JSON.parse(t) as unknown;
    if (Array.isArray(parsed)) items.push(...parsed);
    else if (parsed && typeof parsed === "object" && Array.isArray((parsed as { stories?: unknown[] }).stories)) {
      items.push(...(parsed as { stories: unknown[] }).stories);
    } else items.push(parsed);
  }
  return JSON.stringify(items.length === 1 ? items[0] : items, null, 2);
}

export function ImportClient({
  template,
  prompt,
  continuePrompt,
  genres,
}: {
  template: string;
  prompt: string;
  continuePrompt: string;
  genres: string[];
}) {
  const [text, setText] = useState("");
  const [publish, setPublish] = useState(false);
  const [check, setCheck] = useState<CheckResult | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [copied, setCopied] = useState<"" | "main" | "next">("");
  const [pending, start] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);

  // Instant, local check while typing (the server re-checks on «Шалгах»).
  const local = useMemo(() => (text.trim() ? validateImport(text, genres) : null), [text, genres]);
  const reports = check?.reports ?? local?.reports ?? [];
  const parseError = check?.error ?? local?.error;
  const valid = reports.filter((r) => r.story).length;

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setFileError(null);
    try {
      const texts = await Promise.all(Array.from(files).map((f) => f.text()));
      const merged = mergeTexts(text.trim() ? [text, ...texts] : texts);
      setText(merged);
      setCheck(null);
      setResult(null);
    } catch {
      setFileError("Файлын аль нэг нь хүчинтэй JSON биш байна.");
    }
    if (fileInput.current) fileInput.current.value = "";
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" onClick={() => download("zugaa-story-template.json", template)}>
          Загвар татах
        </Button>
        {(
          [
            ["main", prompt, "AI prompt хуулах"],
            ["next", continuePrompt, "Үргэлжлэлийн prompt хуулах"],
          ] as const
        ).map(([key, value, label]) => (
          <Button
            key={key}
            variant="secondary"
            size="sm"
            onClick={async () => {
              await navigator.clipboard.writeText(value).catch(() => {});
              setCopied(key);
              setTimeout(() => setCopied(""), 1500);
            }}
          >
            {copied === key ? "Хуулсан" : label}
          </Button>
        ))}
        <Button variant="secondary" size="sm" onClick={() => setText(template)}>
          Загварыг буулгах
        </Button>
      </section>

      <details className="rounded-sm border border-line px-4 py-3">
        <summary className="min-h-11 cursor-pointer content-center text-sm font-medium">Бичих зарчим ба AI prompt</summary>
        <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap font-sans text-sm leading-relaxed text-muted">{prompt}</pre>
        <p className="mt-4 text-sm font-medium">Үргэлжлэлийн prompt (дараагийн бүлгүүд)</p>
        <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap font-sans text-sm leading-relaxed text-muted">{continuePrompt}</pre>
      </details>

      <p className="text-sm text-muted">
        Бүлэг бүлгээр оруулж болно: эхний ээлжинд бүтэн мэдээлэлтэй JSON, дараагийнхад зөвхөн{" "}
        <code className="font-mono">{`{"slug": "...", "chapters": [...]}`}</code>. Ижил дугаартай бүлэг засагдаж, шинэ нь нэмэгдэнэ. Бичигдээгүй бүлэг рүү
        заасан сонголт тэр бүлэг орох хүртэл нуугдана. Засахын тулд өгүүллэгийн хуудаснаас «JSON татах»-аар бүрэн JSON авч болно.
      </p>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label htmlFor="json" className="text-sm font-medium">
            JSON
          </label>
          <label className="inline-flex min-h-11 cursor-pointer items-center rounded-full border border-field px-4 text-sm hover:bg-surface">
            .json файл сонгох (олон файл болно)
            <input ref={fileInput} type="file" accept=".json,application/json" multiple className="sr-only" onChange={(e) => onFiles(e.target.files)} />
          </label>
        </div>
        <textarea
          id="json"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setCheck(null);
            setResult(null);
          }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            void onFiles(e.dataTransfer.files);
          }}
          rows={14}
          spellCheck={false}
          placeholder='{"title": "...", "chapters": [...]}  — эсвэл файлаа энд чирж оруулна'
          className={cx(fieldClass, "py-3 font-mono text-sm leading-relaxed")}
        />
        {fileError ? <Notice tone="accent">{fileError}</Notice> : null}
        {parseError ? <Notice tone="accent">{parseError}</Notice> : null}
      </section>

      {reports.length > 0 ? (
        <section className="space-y-3" aria-live="polite">
          <h2 className="text-sm font-medium">
            {reports.length} өгүүллэг · {valid} нь оруулахад бэлэн
          </h2>
          <ul className="divide-y divide-line border-y border-line">
            {reports.map((r) => {
              const exists = check?.existing.includes(r.slug);
              return (
                <li key={r.index} className="space-y-2 py-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-display text-lg">{r.title || r.slug || `#${r.index + 1}`}</span>
                    <span className={cx("text-sm", r.errors.length ? "text-accent" : "text-ok")}>
                      {r.errors.length ? `${r.errors.length} алдаа` : "Бэлэн"}
                      {check && !r.errors.length ? (exists ? (r.partial ? " · бүлэг нэмэгдэнэ" : " · шинэчлэгдэнэ") : " · шинэ") : ""}
                    </span>
                  </div>
                  <p className="text-sm text-muted">
                    /s/{r.slug || "?"} · {r.stats.chapters} бүлэг
                    {r.stats.chapters ? ` (${r.story?.chapters[0]?.number ?? ""}–${r.story?.chapters.at(-1)?.number ?? ""})` : ""} ·{" "}
                    {r.stats.free} үнэгүй
                    {r.stats.branching ? ` · ${r.stats.choices} сонголт · ${r.stats.endings} төгсгөл` : " · шугаман"}
                  </p>
                  {r.errors.length ? (
                    <ul className="list-disc space-y-0.5 pl-5 text-sm text-accent">
                      {r.errors.slice(0, 12).map((e) => (
                        <li key={e}>{e}</li>
                      ))}
                    </ul>
                  ) : null}
                  {r.warnings.length ? (
                    <ul className="list-disc space-y-0.5 pl-5 text-sm text-muted">
                      {r.warnings.slice(0, 8).map((w) => (
                        <li key={w}>{w}</li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <section className="flex flex-wrap items-center gap-3">
        <label className="inline-flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" checked={publish} onChange={(e) => setPublish(e.target.checked)} className="h-5 w-5 accent-[var(--zg-accent)]" />
          Шууд нийтлэх (үгүй бол шинэ бүлгүүд ноорог болж орно)
        </label>
        <div className="flex gap-2">
          <Button variant="secondary" disabled={pending || !text.trim()} onClick={() => start(async () => setCheck(await checkImport(text)))}>
            Шалгах
          </Button>
          <Button
            disabled={pending || !check || valid === 0}
            onClick={() =>
              start(async () => {
                const res = await importStories(text, publish);
                setResult(res);
              })
            }
          >
            {pending ? "Түр хүлээнэ үү…" : `Оруулах (${check ? valid : 0})`}
          </Button>
        </div>
      </section>

      {result ? (
        <section className="space-y-2" role="status">
          {result.error ? <Notice tone="accent">{result.error}</Notice> : null}
          <ul className="space-y-1 text-sm">
            {result.results.map((r) => (
              <li key={r.slug + r.title} className={r.ok ? "text-ok" : "text-accent"}>
                {r.ok ? (
                  <>
                    {r.created ? "Нэмэгдлээ" : "Шинэчлэгдлээ"}: {r.title} — {r.chapters} бүлэг, {r.choices} сонголт
                    {r.placeholders ? `, ${r.placeholders} бичигдээгүй бүлэг хүлээгдэж байна` : ""} ·{" "}
                    <Link href={`/s/${r.slug}`} className="underline">
                      харах
                    </Link>
                  </>
                ) : (
                  <>
                    Алдаа: {r.title || r.slug} — {r.message}
                  </>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
