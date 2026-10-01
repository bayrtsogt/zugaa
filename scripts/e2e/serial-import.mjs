// Serial (batch) import: chapters 1–3 first, later batches with only { slug, chapters } merge in,
// choices to unwritten chapters stay hidden ("continues later"), export round-trips.
import { launch, login, assert, sql, BASE } from "./lib.mjs";

const SLUG = "tsuvral-turshilt";
const long = (s) => (s + " ").repeat(60);
const batch1 = {
  slug: SLUG,
  title: "Цуврал туршилт",
  description: "Анхны тайлбар",
  genre: "mystery",
  age_rating: "all",
  chapters: [
    { number: 1, title: "Нэг", free: true, content: long("Эхний бүлэг.") },
    { number: 2, title: "Хоёр", free: true, content: long("Хоёр дахь бүлэг.") },
    {
      number: 3,
      title: "Гурав",
      free: true,
      content: long("Шийдвэрийн бүлэг."),
      choices: [
        { label: "Зүүн тийш явах", goto: 4 },
        { label: "Баруун тийш явах", goto: 5 },
      ],
    },
  ],
};
const batch2 = {
  slug: SLUG,
  chapters: [
    { number: 4, title: "Зүүн", free: true, ending: true, content: long("Зүүн замын төгсгөл.") + "\n\n**Төгсгөл.**" },
    { number: 5, title: "Баруун", free: true, ending: true, content: long("Баруун замын төгсгөл.") + "\n\n**Төгсгөл.**" },
  ],
};

sql(`delete from stories where slug in ('${SLUG}', 'neg-dor-tsuvral')`);
const browser = await launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const email = `serial-${Date.now()}@test.mn`;
await login(page, email, "/");
sql(`update profiles set is_admin = true where id = (select id from auth.users where email = '${email}')`);

async function importText(text, expectStatus) {
  await page.goto(`${BASE}/admin/import`);
  await page.fill("#json", text);
  await page.click("button:has-text('Шалгах')");
  await page.waitForSelector(`text=${expectStatus}`);
  await page.check("text=Шууд нийтлэх");
  await page.click("button:has-text('Оруулах (1)')");
  await page.waitForSelector("text=харах");
  return page.textContent("main");
}

// A chapters-only batch for a story that does not exist yet is refused.
await page.goto(`${BASE}/admin/import`);
await page.fill("#json", JSON.stringify(batch2));
await page.click("button:has-text('Шалгах')");
await page.waitForSelector("text=өгүүллэг байхгүй");
assert(true, "batch without title for unknown slug is an error");

// Batch 1: choices point at chapters 4 and 5 that are not written yet.
let out = await importText(JSON.stringify(batch1), "Бэлэн · шинэ");
assert(out.includes("2 бичигдээгүй бүлэг хүлээгдэж байна"), "placeholders reported");
assert(sql(`select count(*) from chapters c join stories s on s.id = c.story_id where s.slug = '${SLUG}' and c.published_at is null`) === "2", "placeholders are hidden drafts");

const reader = await (await browser.newContext()).newPage();
await reader.goto(`${BASE}/s/${SLUG}/3`);
await reader.waitForSelector("text=Үргэлжлэл удахгүй гарна");
assert(!(await reader.textContent("main")).includes("Зүүн тийш явах"), "choices to unwritten chapters hidden");
await reader.goto(`${BASE}/s/${SLUG}/4`);
await reader.waitForSelector("text=Хуудас олдсонгүй");
assert(true, "placeholder chapter not readable");

// Batch 2: only slug + chapters, merged; story fields untouched.
await page.goto(`${BASE}/admin/import`);
await page.fill("#json", JSON.stringify(batch2));
await page.click("button:has-text('Шалгах')");
await page.waitForSelector("text=бүлэг нэмэгдэнэ");
assert((await page.textContent("main")).includes("Цуврал туршилт"), "batch shows the existing story title");
await page.check("text=Шууд нийтлэх");
await page.click("button:has-text('Оруулах (1)')");
await page.waitForSelector("text=Шинэчлэгдлээ: Цуврал туршилт");
assert(sql(`select title || '|' || description || '|' || genre from stories where slug = '${SLUG}'`) === "Цуврал туршилт|Анхны тайлбар|mystery", "story fields kept");
assert(sql(`select count(*) from chapters c join stories s on s.id = c.story_id where s.slug = '${SLUG}'`) === "5", "5 chapters, placeholders filled (no duplicates)");

await reader.goto(`${BASE}/s/${SLUG}/3`);
await reader.waitForSelector("text=Зүүн тийш явах");
assert(!(await reader.textContent("main")).includes("Үргэлжлэл удахгүй"), "choices appear once the chapters exist");
await reader.click("text=Баруун тийш явах");
await reader.waitForSelector("text=Баруун замын төгсгөл");
assert(true, "branch readable after the second batch");

// Fix one chapter: re-send it with the same number.
await importText(JSON.stringify({ slug: SLUG, chapters: [{ ...batch2.chapters[0], content: long("ЗАССАН зүүн төгсгөл.") }] }), "бүлэг нэмэгдэнэ");
assert(sql(`select position('ЗАССАН' in c.content) > 0 from chapters c join stories s on s.id = c.story_id where s.slug = '${SLUG}' and c.number = 4`) === "t", "chapter fixed in place");

// Export round-trip.
const id = sql(`select id from stories where slug = '${SLUG}'`);
const res = await page.request.get(`${BASE}/admin/stories/${id}/export`);
assert(res.status() === 200 && (res.headers()["content-disposition"] ?? "").includes(`${SLUG}.json`), "export downloads JSON");
const exported = await res.json();
assert(exported.title === "Цуврал туршилт" && exported.chapters.length === 5, "export has story + all chapters");
const norm = (cs) => JSON.stringify(cs.map((c) => [c.label, c.goto]));
assert(norm(exported.chapters[2].choices) === norm(batch1.chapters[2].choices), "export keeps choices as goto numbers");
await importText(JSON.stringify(exported), "Бэлэн · шинэчлэгдэнэ");
assert(sql(`select count(*) from chapters c join stories s on s.id = c.story_id where s.slug = '${SLUG}'`) === "5", "re-importing the export changes nothing structurally");
const anon = await (await browser.newContext()).request.get(`${BASE}/admin/stories/${id}/export`);
assert(anon.status() === 403, "export refused without admin");

// Two batches of one story pasted together are merged before import.
const other = { ...batch1, slug: "neg-dor-tsuvral", title: "Нэг дор цуврал" };
await page.goto(`${BASE}/admin/import`);
await page.fill("#json", JSON.stringify([other, { ...batch2, slug: "neg-dor-tsuvral" }]));
await page.waitForSelector("text=2 хэсгийг (ижил slug) нэгтгэлээ");
await page.click("button:has-text('Шалгах')");
await page.waitForSelector("text=Бэлэн · шинэ");
await page.click("button:has-text('Оруулах (1)')");
await page.waitForSelector("text=Нэмэгдлээ: Нэг дор цуврал");
assert(sql(`select count(*) from chapters c join stories s on s.id = c.story_id where s.slug = 'neg-dor-tsuvral'`) === "5", "merged batches imported as one story");

await browser.close();
console.log("\nSerial import checks passed");
