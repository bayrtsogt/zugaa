/**
 * Story JSON import: parsing and validation. Pure TypeScript (no server
 * imports) so the admin page can check files instantly in the browser and the
 * server action can re-check before writing.
 */
import { slugify } from "@/lib/slug";
import { isImageUrl } from "@/lib/image-url";

/** Built-in genres; the admin can add more (pass the live list to the validators). */
export const DEFAULT_GENRES = ["horror", "thriller", "mystery", "romance", "other"];
export const AGE_VALUES = ["all", "16", "18"] as const;

export type ImportChoice = { label: string; goto: number; image_url?: string | null };
export type ImportChapter = {
  number: number;
  title: string;
  content: string;
  free: boolean;
  price_coins: number;
  ending: boolean;
  /** Only sent when present in the JSON (re-imports keep admin-uploaded images). */
  image_url?: string | null;
  choices: ImportChoice[];
};
/**
 * Story-level fields other than slug/chapters are only sent when present in
 * the JSON, so a later batch ({ slug, chapters }) never overwrites them.
 */
export type ImportStory = {
  slug: string;
  title?: string;
  description?: string;
  genre?: string;
  age_rating?: (typeof AGE_VALUES)[number];
  price_coins?: number | null;
  wait_free_hours?: number | null;
  cover_url?: string | null;
  ongoing?: boolean;
  chapters: ImportChapter[];
};

export type StoryReport = {
  index: number;
  title: string;
  slug: string;
  story: ImportStory | null;
  /** No title: a batch of chapters merged into an existing story (by slug). */
  partial: boolean;
  /** Choice targets not in this file (already imported or a later batch). */
  external: number[];
  errors: string[];
  warnings: string[];
  stats: { chapters: number; free: number; endings: number; choices: number; branching: boolean };
};

const MAX_STORIES = 50;
const MAX_CHAPTERS = 200;
const MAX_CONTENT = 60_000;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const posInt = (v: unknown) => (typeof v === "number" && Number.isInteger(v) && v > 0 ? v : null);

/** Accepts one story, an array of stories, or { "stories": [...] }. */
export function parseImport(text: string): { items: unknown[]; error?: string } {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    return { items: [], error: `JSON буруу байна: ${msg}` };
  }
  const items = Array.isArray(data) ? data : isObj(data) && Array.isArray(data.stories) ? data.stories : [data];
  if (items.length === 0) return { items: [], error: "Өгүүллэг олдсонгүй." };
  if (items.length > MAX_STORIES) return { items: [], error: `Нэг удаад ${MAX_STORIES}-аас ихгүй өгүүллэг оруулна.` };
  return { items };
}

export function validateStory(raw: unknown, index: number, genres: string[] = DEFAULT_GENRES): StoryReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  const base = { index, title: "", slug: "", story: null, partial: false, external: [] as number[], errors, warnings, stats: { chapters: 0, free: 0, endings: 0, choices: 0, branching: false } };
  if (!isObj(raw)) {
    errors.push("Өгүүллэг нь JSON объект байх ёстой.");
    return base;
  }

  const has = (k: string) => k in raw;
  const title = str(raw.title);
  const partial = !title;
  if (title.length > 200) errors.push("Гарчиг 200 тэмдэгтээс урт байна.");
  const slug = slugify(str(raw.slug) || title);
  if (!slug) errors.push(partial ? "«title» эсвэл «slug» заавал. Үргэлжлэлийн бүлгүүдэд өгүүллэгийн «slug»-ийг өгнө." : "«slug» үүсгэж чадсангүй. Латин үсгээр «slug» өгнө үү.");
  else if (partial) warnings.push(`Гарчиггүй тул «${slug}» өгүүллэгт бүлгүүдийг нэмж/засна (бусад мэдээлэл хэвээр).`);

  const description = str(raw.description);
  if (!partial && !description) warnings.push("Тайлбар («description») хоосон байна.");

  const genre = str(raw.genre) || (partial ? "" : "other");
  if (genre && !genres.includes(genre)) errors.push(`«genre» «${genre}» байхгүй. Боломжит: ${genres.join(", ")}. Шинэ төрлийг Админ → Төрөл хэсэгт нэмнэ.`);
  const age = (str(raw.age_rating) || (partial ? "" : "all")) as ImportStory["age_rating"] | "";
  if (age && !AGE_VALUES.includes(age)) errors.push("«age_rating» нь all, 16, 18-ын нэг байна.");

  const price = raw.price_coins == null ? null : posInt(raw.price_coins);
  if (raw.price_coins != null && price == null) errors.push("«price_coins» эерэг бүхэл тоо эсвэл null байна.");
  const wait = raw.wait_free_hours == null ? null : posInt(raw.wait_free_hours);
  if (raw.wait_free_hours != null && wait == null) errors.push("«wait_free_hours» эерэг бүхэл тоо эсвэл null байна.");
  const cover = str(raw.cover_url) || null;
  if (cover && !isImageUrl(cover)) errors.push("«cover_url» нь https:// хаяг байна.");
  if (raw.ongoing != null && typeof raw.ongoing !== "boolean") errors.push("«ongoing» нь true эсвэл false байна.");

  const chaptersRaw = Array.isArray(raw.chapters) ? raw.chapters : null;
  if (!chaptersRaw || chaptersRaw.length === 0) {
    errors.push("«chapters» хоосон байна.");
    return { ...base, title, slug, partial };
  }
  if (chaptersRaw.length > MAX_CHAPTERS) errors.push(`Бүлэг ${MAX_CHAPTERS}-аас олон байна.`);

  const chapters: ImportChapter[] = [];
  const seen = new Set<number>();
  chaptersRaw.forEach((c, i) => {
    const where = `Бүлэг #${i + 1}`;
    if (!isObj(c)) {
      errors.push(`${where}: объект биш байна.`);
      return;
    }
    const number = posInt(c.number) ?? i + 1;
    if (c.number != null && posInt(c.number) == null) errors.push(`${where}: «number» эерэг бүхэл тоо байна.`);
    if (seen.has(number)) errors.push(`${number}-р бүлэг давхардсан байна.`);
    seen.add(number);
    const ctitle = str(c.title);
    if (!ctitle) errors.push(`${number}-р бүлэг: гарчиг хоосон.`);
    const content = typeof c.content === "string" ? c.content.replace(/\r\n/g, "\n").trim() : "";
    if (!content) errors.push(`${number}-р бүлэг: агуулга хоосон.`);
    if (content.length > MAX_CONTENT) errors.push(`${number}-р бүлэг: агуулга ${MAX_CONTENT} тэмдэгтээс урт.`);
    if (content && content.length < 800) warnings.push(`${number}-р бүлэг богино (${content.length} тэмдэгт). 1,200-аас дээш байвал сайн.`);
    if (/<\s*(script|iframe|img|style)/i.test(content)) warnings.push(`${number}-р бүлэг: HTML таг байна, текст болж харагдана.`);
    const cprice = c.price_coins == null ? 40 : posInt(c.price_coins);
    if (cprice == null) errors.push(`${number}-р бүлэг: «price_coins» эерэг бүхэл тоо байна.`);
    const choices: ImportChoice[] = [];
    if (c.choices != null && !Array.isArray(c.choices)) errors.push(`${number}-р бүлэг: «choices» массив байна.`);
    (Array.isArray(c.choices) ? c.choices : []).forEach((ch, j) => {
      const label = isObj(ch) ? str(ch.label) : "";
      const target = isObj(ch) ? posInt(ch.goto) : null;
      if (!label) errors.push(`${number}-р бүлэг, сонголт ${j + 1}: «label» хоосон.`);
      if (label.length > 120) warnings.push(`${number}-р бүлэг, сонголт ${j + 1}: шошго урт байна.`);
      if (target == null) errors.push(`${number}-р бүлэг, сонголт ${j + 1}: «goto» бүлгийн дугаар байна.`);
      if (target === number) errors.push(`${number}-р бүлэг: сонголт өөр рүүгээ заасан.`);
      const cimg = isObj(ch) && "image_url" in ch ? str(ch.image_url) || null : undefined;
      if (cimg && !isImageUrl(cimg)) errors.push(`${number}-р бүлэг, сонголт ${j + 1}: «image_url» нь https:// хаяг байна.`);
      if (label && target) choices.push(cimg === undefined ? { label, goto: target } : { label, goto: target, image_url: cimg });
    });
    const img = "image_url" in c ? str(c.image_url) || null : undefined;
    if (img && !isImageUrl(img)) errors.push(`${number}-р бүлэг: «image_url» нь https:// хаяг байна.`);
    chapters.push({
      number,
      title: ctitle,
      content,
      free: c.free === true,
      price_coins: cprice ?? 40,
      ending: c.ending === true,
      ...(img === undefined ? {} : { image_url: img }),
      choices,
    });
  });

  chapters.sort((a, b) => a.number - b.number);
  const numbers = new Set(chapters.map((c) => c.number));
  const branching = chapters.some((c) => c.choices.length > 0);

  const external = new Set<number>();
  for (const c of chapters) {
    for (const ch of c.choices) {
      if (!numbers.has(ch.goto)) external.add(ch.goto);
    }
    if (c.ending && c.choices.length > 0) errors.push(`${c.number}-р бүлэг төгсгөл («ending») мөртөө сонголттой байна.`);
    if (branching && !c.ending && c.choices.length === 0) {
      const next = chapters.find((x) => x.number > c.number);
      if (next) warnings.push(`${c.number}-р бүлэгт сонголт ч, «ending» ч алга — «Дараагийн бүлэг» нь ${next.number}-р бүлэг рүү шилжинэ.`);
      else if (!partial && external.size === 0) warnings.push(`${c.number}-р бүлэг сүүлийнх ч «ending» гэж тэмдэглээгүй.`);
    }
  }
  if (external.size) {
    warnings.push(
      `Энэ файлд байхгүй бүлэг рүү заасан сонголт: ${[...external].sort((a, b) => a - b).join(", ")}. ` +
        "Өмнө оруулсан бол шууд холбогдоно; үгүй бол тэр бүлгийг дараагийн ээлжинд оруулах хүртэл сонголт нуугдаж, уншигчид «Үргэлжлэл удахгүй» харагдана.",
    );
  }

  // Reachability only makes sense for a complete story in one file.
  const first = chapters[0];
  if (branching && first?.number === 1 && !partial && external.size === 0) {
    // Reachability from the first chapter (choices + implicit "next" for linear chapters).
    const reach = new Set<number>([first.number]);
    const queue = [first];
    while (queue.length) {
      const c = queue.shift()!;
      const nexts = c.choices.length ? c.choices.map((x) => x.goto) : c.ending ? [] : [chapters.find((x) => x.number > c.number)?.number];
      for (const n of nexts) {
        if (n != null && !reach.has(n)) {
          reach.add(n);
          const nc = chapters.find((x) => x.number === n);
          if (nc) queue.push(nc);
        }
      }
    }
    const unreachable = chapters.filter((c) => !reach.has(c.number)).map((c) => c.number);
    if (unreachable.length) warnings.push(`Эхний бүлгээс хүрэх боломжгүй бүлэг: ${unreachable.join(", ")}.`);
  }

  const free = chapters.filter((c) => c.free).length;
  if (free === 0 && !partial) warnings.push("Үнэгүй бүлэг алга. Эхний 1–2 бүлгийг «free»: true болговол уншигч татагдана.");
  if (free === chapters.length && !partial) warnings.push("Бүх бүлэг үнэгүй байна.");
  if (age === "all" && /(\bсекс\b|бэлгийн|нүцгэн)/i.test(chapters.map((c) => c.content).join(" "))) {
    warnings.push("«all» ангилалтай ч насанд хүрэгчдийн агуулга байж магадгүй. «age_rating»-ийг шалгана уу.");
  }

  const story: ImportStory = { slug, chapters };
  if (title) story.title = title;
  if (!partial || has("description")) story.description = description;
  if (genre) story.genre = genre;
  if (age) story.age_rating = age;
  if (!partial || has("price_coins")) story.price_coins = price;
  if (!partial || has("wait_free_hours")) story.wait_free_hours = wait;
  if (!partial || has("cover_url")) story.cover_url = cover;
  if (typeof raw.ongoing === "boolean") story.ongoing = raw.ongoing;
  return {
    index,
    title,
    slug,
    partial,
    external: [...external].sort((a, b) => a - b),
    story: errors.length ? null : story,
    errors,
    warnings,
    stats: {
      chapters: chapters.length,
      free,
      endings: chapters.filter((c) => c.ending).length,
      choices: chapters.reduce((n, c) => n + c.choices.length, 0),
      branching,
    },
  };
}

/**
 * Several batches of one story (same slug, e.g. chapters 1–3 and 4–6 pasted or
 * uploaded together) become one story: story fields from the first batch that
 * has them, chapters merged by number (a later batch wins).
 */
function mergeSameSlug(items: unknown[]): { items: unknown[]; merged: Map<unknown, number> } {
  const out: unknown[] = [];
  const byKey = new Map<string, Record<string, unknown>>();
  const merged = new Map<unknown, number>();
  for (const it of items) {
    const key = isObj(it) ? slugify(str(it.slug) || str(it.title)) : "";
    const prev = key ? byKey.get(key) : undefined;
    if (!isObj(it) || !key || !prev || !Array.isArray(it.chapters) || !Array.isArray(prev.chapters)) {
      if (isObj(it) && key && !prev) {
        const copy = { ...it };
        byKey.set(key, copy);
        out.push(copy);
      } else out.push(it);
      continue;
    }
    for (const [k, v] of Object.entries(it)) {
      if (k === "chapters") continue;
      if (!(k in prev) || prev[k] == null || prev[k] === "") prev[k] = v;
    }
    const chapters = new Map<unknown, unknown>();
    for (const c of [...prev.chapters, ...it.chapters]) chapters.set(isObj(c) && c.number != null ? c.number : Symbol(), c);
    prev.chapters = [...chapters.values()];
    merged.set(prev, (merged.get(prev) ?? 1) + 1);
  }
  return { items: out, merged };
}

export function validateImport(text: string, genres: string[] = DEFAULT_GENRES): { reports: StoryReport[]; error?: string } {
  const parsed = parseImport(text);
  if (parsed.error) return { reports: [], error: parsed.error };
  const { items, merged } = mergeSameSlug(parsed.items);
  const reports = items.map((it, i) => {
    const r = validateStory(it, i, genres);
    const n = merged.get(it);
    if (n) r.warnings.unshift(`Нэг өгүүллэгийн ${n} хэсгийг (ижил slug) нэгтгэлээ.`);
    return r;
  });
  const slugs = new Map<string, number>();
  for (const r of reports) {
    if (!r.slug) continue;
    if (slugs.has(r.slug)) {
      r.errors.push(`«${r.slug}» slug энэ файлд давхардсан байна.`);
      r.story = null;
    }
    slugs.set(r.slug, r.index);
  }
  return { reports };
}
