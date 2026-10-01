// Admin JSON import: multiple files, validation report, import, re-import keeps chapter ids (purchases survive).
import { readFileSync } from "node:fs";
import { launch, login, assert, sql, BASE } from "./lib.mjs";

const template = JSON.parse(readFileSync(new URL("../../docs/story-template.json", import.meta.url), "utf8"));
const long = (s) => (s + " ").repeat(60);
const good = { ...template, chapters: template.chapters.map((c) => ({ ...c, content: long(c.content) })) };
const linear = {
  title: "Шугаман туршилт",
  genre: "mystery",
  age_rating: "all",
  chapters: [1, 2, 3].map((n) => ({ number: n, title: `Бүлэг ${n}`, free: n === 1, content: long(`Шугаман өгүүллэгийн ${n}-р бүлэг.`) })),
};
const broken = { title: "Эвдэрхий", chapters: [{ number: 1, title: "Нэг", content: "", choices: [{ label: "Хаашаа", goto: 9 }] }] };

sql(`delete from stories where slug in ('harankhui-gudamj', 'shugaman-turshilt', 'evdekhii')`);
const browser = await launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const email = `importer-${Date.now()}@test.mn`;
await login(page, email, "/");
sql(`update profiles set is_admin = true where id = (select id from auth.users where email = '${email}')`);

await page.goto(`${BASE}/admin/import`, { waitUntil: "networkidle" });
await page.setInputFiles("input[type=file]", [
  { name: "a.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(good)) },
  { name: "b.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify([linear, broken])) },
]);
await page.waitForSelector("text=3 өгүүллэг · 2 нь оруулахад бэлэн");
assert(true, "3 stories from 2 files, 2 valid");
assert((await page.textContent("main")).includes("1-р бүлэг: агуулга хоосон"), "empty chapter reported");
assert((await page.textContent("main")).includes("Энэ файлд байхгүй бүлэг рүү заасан сонголт: 9"), "choice to a not-yet-written chapter flagged");

await page.click("button:has-text('Шалгах')");
await page.waitForSelector("text=Бэлэн · шинэ");
await page.check("text=Шууд нийтлэх");
await page.click("button:has-text('Оруулах (2)')");
await page.waitForSelector("text=Нэмэгдлээ: Харанхуй гудамж");
assert((await page.textContent("main")).includes("Нэмэгдлээ: Шугаман туршилт"), "both valid stories imported");
assert(sql(`select count(*) from stories where slug = 'evdekhii'`) === "0", "invalid story not imported");
assert(sql(`select count(*) from chapter_choices cc join chapters c on c.id = cc.chapter_id join stories s on s.id = c.story_id where s.slug = 'harankhui-gudamj'`) === "2", "choices created");

// Reader sees it with choices.
const reader = await (await browser.newContext()).newPage();
await reader.goto(`${BASE}/s/harankhui-gudamj/1`);
await reader.waitForSelector("text=Хаалгыг онгойлгох");
assert(true, "imported story readable, choices shown");

// A purchase on chapter 2, then re-import with new text: same chapter row, unlock kept.
const ch2 = sql(`select c.id from chapters c join stories s on s.id = c.story_id where s.slug = 'harankhui-gudamj' and c.number = 2`);
const uid = sql(`select id from auth.users where email = '${email}'`);
sql(`insert into unlocks (user_id, story_id, chapter_id, method) select '${uid}', story_id, id, 'coins' from chapters where id = '${ch2}'`);
const updated = { ...good, title: "Харанхуй гудамж (шинэ)", chapters: good.chapters.map((c) => (c.number === 2 ? { ...c, content: long("ШИНЭЧИЛСЭН текст.") } : c)) };
await page.goto(`${BASE}/admin/import`);
await page.fill("#json", JSON.stringify(updated));
await page.click("button:has-text('Шалгах')");
await page.waitForSelector("text=Бэлэн · шинэчлэгдэнэ");
await page.click("button:has-text('Оруулах (1)')");
await page.waitForSelector("text=Шинэчлэгдлээ: Харанхуй гудамж (шинэ)");
assert(sql(`select c.id from chapters c join stories s on s.id = c.story_id where s.slug = 'harankhui-gudamj' and c.number = 2`) === ch2, "re-import keeps the chapter row");
assert(sql(`select count(*) from unlocks where chapter_id = '${ch2}'`) === "1", "purchase survives re-import");
assert(sql(`select position('ШИНЭЧИЛСЭН' in content) > 0 from chapters where id = '${ch2}'`) === "t", "chapter text updated");
assert(sql(`select count(*) from chapter_choices cc join chapters c on c.id = cc.chapter_id join stories s on s.id = c.story_id where s.slug = 'harankhui-gudamj'`) === "2", "choices replaced, not duplicated");

// Non-admins cannot call the import function.
const plain = await (await browser.newContext()).newPage();
await login(plain, `plain-${Date.now()}@test.mn`, "/");
await plain.goto(`${BASE}/admin/import`);
assert(new URL(plain.url()).pathname === "/", "non-admin redirected away from /admin/import");
await browser.close();
console.log("\nImport checks passed");
