"use client";
import { useActionState, useMemo, useState } from "react";
import { Button, Field, GenreArt, Notice, cx, fieldClass } from "@zugaa/ui";
import { renderMarkdown } from "@/lib/markdown";
import { slugify } from "@/lib/slug";
import { adjustCoins, decidePayment, deleteGenre, saveChapter, saveGenre, saveStory, type AdminState } from "./actions";

function Feedback({ state }: { state: AdminState }) {
  if (state.error) return <Notice tone="accent">{state.error}</Notice>;
  if (state.ok) return <Notice tone="ok">{state.ok}</Notice>;
  return null;
}

/* ------------------------------------------------------------------ story */

export type StoryFormValues = {
  id?: string;
  title: string;
  slug: string;
  description: string;
  cover_url: string | null;
  cover_color: string;
  genre: string;
  age_rating: string;
  price_coins: number | null;
  wait_free_hours: number | null;
};

export function StoryForm({ story, genres }: { story?: StoryFormValues; genres: Array<{ slug: string; label: string }> }) {
  const [state, action, pending] = useActionState(saveStory, {});
  const [title, setTitle] = useState(story?.title ?? "");
  const [slug, setSlug] = useState(story?.slug ?? "");
  return (
    <form action={action} className="space-y-5">
      {story?.id ? <input type="hidden" name="id" value={story.id} /> : null}
      <Field label="Гарчиг" htmlFor="title">
        <input id="title" name="title" required className={fieldClass} value={title} onChange={(e) => setTitle(e.target.value)} />
      </Field>
      <Field label="Slug (URL)" htmlFor="slug" hint={`/s/${slug || slugify(title) || "…"}`}>
        <input id="slug" name="slug" className={fieldClass} value={slug} placeholder={slugify(title)} onChange={(e) => setSlug(e.target.value)} />
      </Field>
      <Field label="Тайлбар" htmlFor="description">
        <textarea id="description" name="description" rows={4} defaultValue={story?.description} className={cx(fieldClass, "py-2")} />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Төрөл" htmlFor="genre">
          <select id="genre" name="genre" defaultValue={story?.genre ?? genres[0]?.slug} className={fieldClass}>
            {genres.map((g) => (
              <option key={g.slug} value={g.slug}>
                {g.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Насны ангилал" htmlFor="age_rating">
          <select id="age_rating" name="age_rating" defaultValue={story?.age_rating ?? "all"} className={fieldClass}>
            <option value="all">Бүх нас</option>
            <option value="16">16+</option>
            <option value="18">18+</option>
          </select>
        </Field>
        <Field label="Бүтэн өгүүллэгийн үнэ (coin)" htmlFor="price_coins" hint="Хоосон бол бүтнээр нь зарахгүй">
          <input id="price_coins" name="price_coins" inputMode="numeric" defaultValue={story?.price_coins ?? ""} className={fieldClass} />
        </Field>
        <Field label="Үнэгүй хүлээх цаг" htmlFor="wait_free_hours" hint="Хоосон бол хүлээж унших боломжгүй">
          <input id="wait_free_hours" name="wait_free_hours" inputMode="numeric" defaultValue={story?.wait_free_hours ?? ""} className={fieldClass} />
        </Field>
        <Field label="Хавтасны зураг (https://…)" htmlFor="cover_url" hint="Хоосон бол өнгө + гарчиг">
          <input id="cover_url" name="cover_url" type="url" defaultValue={story?.cover_url ?? ""} className={fieldClass} />
        </Field>
        <Field label="Хавтасны өнгө" htmlFor="cover_color">
          <input id="cover_color" name="cover_color" type="color" defaultValue={story?.cover_color ?? "#3b2a2a"} className={cx(fieldClass, "p-1")} />
        </Field>
      </div>
      <Feedback state={state} />
      <Button type="submit" disabled={pending}>
        {pending ? "Хадгалж байна…" : "Хадгалах"}
      </Button>
    </form>
  );
}

/* ---------------------------------------------------------------- chapter */

export type ChapterFormValues = {
  id?: string;
  story_id: string;
  number: number;
  title: string;
  content: string;
  is_free: boolean;
  is_ending: boolean;
  price_coins: number;
  published: boolean;
  choices: Array<{ label: string; target_number: number }>;
};

export function ChapterForm({ chapter, numbers }: { chapter: ChapterFormValues; numbers: number[] }) {
  const [state, action, pending] = useActionState(saveChapter, {});
  const [content, setContent] = useState(chapter.content);
  const [tab, setTab] = useState<"edit" | "preview">("edit");
  const [choices, setChoices] = useState(chapter.choices);
  const html = useMemo(() => (tab === "preview" ? renderMarkdown(content) : ""), [content, tab]);

  return (
    <form action={action} className="space-y-5">
      {chapter.id ? <input type="hidden" name="id" value={chapter.id} /> : null}
      <input type="hidden" name="story_id" value={chapter.story_id} />
      <div className="grid gap-5 sm:grid-cols-[8rem_1fr_8rem]">
        <Field label="Дугаар" htmlFor="number">
          <input id="number" name="number" inputMode="numeric" required defaultValue={chapter.number} className={fieldClass} />
        </Field>
        <Field label="Гарчиг" htmlFor="title">
          <input id="title" name="title" required defaultValue={chapter.title} className={fieldClass} />
        </Field>
        <Field label="Үнэ (coin)" htmlFor="price_coins">
          <input id="price_coins" name="price_coins" inputMode="numeric" required defaultValue={chapter.price_coins} className={fieldClass} />
        </Field>
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        {[
          ["is_free", "Үнэгүй", chapter.is_free],
          ["is_ending", "Төгсгөлийн бүлэг", chapter.is_ending],
          ["published", "Нийтлэгдсэн", chapter.published],
        ].map(([name, label, checked]) => (
          <label key={String(name)} className="inline-flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" name={String(name)} defaultChecked={Boolean(checked)} className="h-5 w-5 accent-[var(--zg-accent)]" />
            {String(label)}
          </label>
        ))}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium" id="content-label">
            Агуулга (Markdown)
          </span>
          <div role="tablist" aria-label="Засварлагч" className="flex gap-1">
            {(["edit", "preview"] as const).map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
                className={cx("min-h-11 px-3 text-sm", tab === t ? "text-accent underline underline-offset-4" : "text-muted")}
              >
                {t === "edit" ? "Засах" : "Харах"}
              </button>
            ))}
          </div>
        </div>
        <textarea
          name="content"
          aria-labelledby="content-label"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={24}
          className={cx(fieldClass, "py-3 font-mono text-sm leading-relaxed", tab !== "edit" && "hidden")}
        />
        {tab === "preview" ? (
          <div className="rounded-sm border border-line bg-surface px-5 py-6">
            <div className="prose-read mx-auto" dangerouslySetInnerHTML={{ __html: html }} />
          </div>
        ) : null}
        <p className="text-sm text-muted">
          {content.length.toLocaleString("en-US")} тэмдэгт · Түгжээтэй үед эхний ~600 тэмдэгт (40%-аас ихгүй) харагдана. *налуу*, **тод**, хоосон мөрөөр догол мөр.
        </p>
      </div>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">Сонголт (салаалсан өгүүллэг)</legend>
        {choices.length === 0 ? <p className="text-sm text-muted">Сонголтгүй бол «Дараагийн бүлэг» харагдана.</p> : null}
        {choices.map((c, i) => (
          <div key={i} className="flex gap-2">
            <input
              name="choice_label"
              aria-label={`Сонголт ${i + 1}`}
              value={c.label}
              onChange={(e) => setChoices(choices.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
              placeholder="Хаалгыг онгойлгох"
              className={fieldClass}
            />
            <select
              name="choice_target"
              aria-label={`Сонголт ${i + 1}: очих бүлэг`}
              value={c.target_number}
              onChange={(e) => setChoices(choices.map((x, j) => (j === i ? { ...x, target_number: Number(e.target.value) } : x)))}
              className={cx(fieldClass, "w-28")}
            >
              {numbers.map((n) => (
                <option key={n} value={n}>
                  → {n}
                </option>
              ))}
            </select>
            <button type="button" onClick={() => setChoices(choices.filter((_, j) => j !== i))} className="min-h-11 px-2 text-sm text-accent">
              Устгах
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setChoices([...choices, { label: "", target_number: numbers[0] ?? 1 }])}
          className="min-h-11 text-sm text-accent underline-offset-4 hover:underline"
          disabled={numbers.length === 0}
        >
          + Сонголт нэмэх
        </button>
      </fieldset>

      <Feedback state={state} />
      <Button type="submit" disabled={pending}>
        {pending ? "Хадгалж байна…" : "Хадгалах"}
      </Button>
    </form>
  );
}

/* --------------------------------------------------------------- payments */

export function DecideForm({ id }: { id: string }) {
  const [state, action, pending] = useActionState(decidePayment, {});
  if (state.ok) return <Feedback state={state} />;
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      <div className="flex flex-wrap gap-2">
        <button type="submit" name="decision" value="approve" disabled={pending} className="min-h-11 rounded-md bg-fill px-4 text-sm text-fill-ink">
          Батлах
        </button>
        <input name="reason" placeholder="Татгалзах шалтгаан (заавал биш)" aria-label="Татгалзах шалтгаан" className={cx(fieldClass, "min-h-11 flex-1 text-sm")} />
        <button type="submit" name="decision" value="reject" disabled={pending} className="min-h-11 rounded-md border border-field px-4 text-sm">
          Татгалзах
        </button>
      </div>
      <Feedback state={state} />
    </form>
  );
}

/* ------------------------------------------------------------------ users */

export function AdjustForm({ userId }: { userId: string }) {
  const [state, action, pending] = useActionState(adjustCoins, {});
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="user_id" value={userId} />
      <div className="flex flex-wrap gap-2">
        <input name="delta" inputMode="numeric" placeholder="+100 / -40" aria-label="Coin өөрчлөлт" required className={cx(fieldClass, "min-h-11 w-28 text-sm")} />
        <input name="reason" placeholder="Шалтгаан" aria-label="Шалтгаан" required className={cx(fieldClass, "min-h-11 flex-1 text-sm")} />
        <button type="submit" disabled={pending} className="min-h-11 rounded-md border border-field px-4 text-sm">
          Хадгалах
        </button>
      </div>
      <Feedback state={state} />
    </form>
  );
}

/* ----------------------------------------------------------------- genres */

const ART_OPTIONS = [
  { value: "horror", label: "Лаа" },
  { value: "thriller", label: "Гав" },
  { value: "mystery", label: "Хурууны хээ" },
  { value: "romance", label: "Захидал" },
  { value: "other", label: "Нээлттэй ном" },
];

export function GenreForm({ genre }: { genre?: { slug: string; label: string; art: string; position: number; stories: number } }) {
  const [state, action, pending] = useActionState(saveGenre, {});
  const [del, delAction, deleting] = useActionState(deleteGenre, {});
  const [art, setArt] = useState(genre?.art ?? "other");
  const [label, setLabel] = useState(genre?.label ?? "");
  const id = genre?.slug ?? "new";
  return (
    <div className="space-y-2">
      <form action={action} className="flex flex-wrap items-end gap-3">
        {genre ? <input type="hidden" name="original" value={genre.slug} /> : null}
        <GenreArt genre={art} className="h-14 w-14 shrink-0 text-ink" />
        <label className="min-w-36 flex-1 space-y-1 text-sm">
          <span className="block text-muted">Нэр</span>
          <input name="label" required maxLength={40} value={label} onChange={(e) => setLabel(e.target.value)} className={cx(fieldClass, "min-h-11")} aria-label={`${id} нэр`} />
        </label>
        <label className="w-40 space-y-1 text-sm">
          <span className="block text-muted">Slug (URL)</span>
          <input name="slug" defaultValue={genre?.slug} placeholder={slugify(label) || "jishee"} className={cx(fieldClass, "min-h-11")} aria-label={`${id} slug`} />
        </label>
        <label className="w-40 space-y-1 text-sm">
          <span className="block text-muted">Зураг</span>
          <select name="art" value={art} onChange={(e) => setArt(e.target.value)} className={cx(fieldClass, "min-h-11")} aria-label={`${id} зураг`}>
            {ART_OPTIONS.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
        </label>
        <label className="w-24 space-y-1 text-sm">
          <span className="block text-muted">Дараалал</span>
          <input name="position" inputMode="numeric" defaultValue={genre?.position ?? 50} className={cx(fieldClass, "min-h-11")} aria-label={`${id} дараалал`} />
        </label>
        <Button type="submit" variant={genre ? "secondary" : "primary"} size="sm" disabled={pending}>
          {genre ? "Хадгалах" : "Нэмэх"}
        </Button>
      </form>
      {genre ? (
        <form action={delAction} className="flex items-center gap-3 text-sm text-muted">
          <input type="hidden" name="slug" value={genre.slug} />
          <span>{genre.stories} өгүүллэг</span>
          <button type="submit" disabled={deleting} className="min-h-11 text-accent underline-offset-4 hover:underline">
            Устгах
          </button>
        </form>
      ) : null}
      <Feedback state={state} />
      <Feedback state={del} />
    </div>
  );
}
