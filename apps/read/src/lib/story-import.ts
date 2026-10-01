/**
 * Story JSON import: parsing and validation. Pure TypeScript (no server
 * imports) so the admin page can check files instantly in the browser and the
 * server action can re-check before writing.
 */
import { slugify } from "@/lib/slug";

/** Built-in genres; the admin can add more (pass the live list to the validators). */
export const DEFAULT_GENRES = ["horror", "thriller", "mystery", "romance", "other"];
export const AGE_VALUES = ["all", "16", "18"] as const;

export type ImportChoice = { label: string; goto: number };
export type ImportChapter = {
  number: number;
  title: string;
  content: string;
  free: boolean;
  price_coins: number;
  ending: boolean;
  choices: ImportChoice[];
};
export type ImportStory = {
  slug: string;
  title: string;
  description: string;
  genre: string;
  age_rating: (typeof AGE_VALUES)[number];
  price_coins: number | null;
  wait_free_hours: number | null;
  cover_url: string | null;
  chapters: ImportChapter[];
};

export type StoryReport = {
  index: number;
  title: string;
  slug: string;
  story: ImportStory | null;
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
  const base = { index, title: "", slug: "", story: null, errors, warnings, stats: { chapters: 0, free: 0, endings: 0, choices: 0, branching: false } };
  if (!isObj(raw)) {
    errors.push("Өгүүллэг нь JSON объект байх ёстой.");
    return base;
  }

  const title = str(raw.title);
  if (!title) errors.push("«title» (гарчиг) хоосон байна.");
  if (title.length > 200) errors.push("Гарчиг 200 тэмдэгтээс урт байна.");
  const slug = slugify(str(raw.slug) || title);
  if (!slug) errors.push("«slug» үүсгэж чадсангүй. Латин үсгээр «slug» өгнө үү.");

  const description = str(raw.description);
  if (!description) warnings.push("Тайлбар («description») хоосон байна.");

  const genre = str(raw.genre) || "other";
  if (!genres.includes(genre)) errors.push(`«genre» «${genre}» байхгүй. Боломжит: ${genres.join(", ")}. Шинэ төрлийг Админ → Төрөл хэсэгт нэмнэ.`);
  const age = (str(raw.age_rating) || "all") as ImportStory["age_rating"];
  if (!AGE_VALUES.includes(age)) errors.push("«age_rating» нь all, 16, 18-ын нэг байна.");

  const price = raw.price_coins == null ? null : posInt(raw.price_coins);
  if (raw.price_coins != null && price == null) errors.push("«price_coins» эерэг бүхэл тоо эсвэл null байна.");
  const wait = raw.wait_free_hours == null ? null : posInt(raw.wait_free_hours);
  if (raw.wait_free_hours != null && wait == null) errors.push("«wait_free_hours» эерэг бүхэл тоо эсвэл null байна.");
  const cover = str(raw.cover_url) || null;
  if (cover && !/^https:\/\//.test(cover)) errors.push("«cover_url» нь https:// хаяг байна.");

  const chaptersRaw = Array.isArray(raw.chapters) ? raw.chapters : null;
  if (!chaptersRaw || chaptersRaw.length === 0) {
    errors.push("«chapters» хоосон байна.");
    return { ...base, title, slug };
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
      if (label && target) choices.push({ label, goto: target });
    });
    chapters.push({
      number,
      title: ctitle,
      content,
      free: c.free === true,
      price_coins: cprice ?? 40,
      ending: c.ending === true,
      choices,
    });
  });

  chapters.sort((a, b) => a.number - b.number);
  const numbers = new Set(chapters.map((c) => c.number));
  const branching = chapters.some((c) => c.choices.length > 0);

  for (const c of chapters) {
    for (const ch of c.choices) {
      if (!numbers.has(ch.goto)) errors.push(`${c.number}-р бүлгийн «${ch.label}» сонголт байхгүй ${ch.goto}-р бүлэг рүү заасан.`);
    }
    if (c.ending && c.choices.length > 0) errors.push(`${c.number}-р бүлэг төгсгөл («ending») мөртөө сонголттой байна.`);
    if (branching && !c.ending && c.choices.length === 0) {
      const next = chapters.find((x) => x.number > c.number);
      warnings.push(
        next
          ? `${c.number}-р бүлэгт сонголт ч, «ending» ч алга — «Дараагийн бүлэг» нь ${next.number}-р бүлэг рүү шилжинэ.`
          : `${c.number}-р бүлэг сүүлийнх ч «ending» гэж тэмдэглээгүй.`,
      );
    }
  }

  if (branching && chapters[0]) {
    // Reachability from the first chapter (choices + implicit "next" for linear chapters).
    const reach = new Set<number>([chapters[0].number]);
    const queue = [chapters[0]];
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
  if (free === 0) warnings.push("Үнэгүй бүлэг алга. Эхний 1–2 бүлгийг «free»: true болговол уншигч татагдана.");
  if (free === chapters.length) warnings.push("Бүх бүлэг үнэгүй байна.");
  if (age === "all" && /(\bсекс\b|бэлгийн|нүцгэн)/i.test(chapters.map((c) => c.content).join(" "))) {
    warnings.push("«all» ангилалтай ч насанд хүрэгчдийн агуулга байж магадгүй. «age_rating»-ийг шалгана уу.");
  }

  const story: ImportStory = {
    slug,
    title,
    description,
    genre,
    age_rating: age,
    price_coins: price,
    wait_free_hours: wait,
    cover_url: cover,
    chapters,
  };
  return {
    index,
    title,
    slug,
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

export function validateImport(text: string, genres: string[] = DEFAULT_GENRES): { reports: StoryReport[]; error?: string } {
  const { items, error } = parseImport(text);
  if (error) return { reports: [], error };
  const reports = items.map((it, i) => validateStory(it, i, genres));
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
