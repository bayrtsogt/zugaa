// Admin-managed genres: add, appears on home/library/import, rename, delete blocked while in use.
import { launch, login, assert, sql, BASE } from "./lib.mjs";

sql(`delete from stories where genre = 'fantasy'`);
sql(`delete from genres where slug = 'fantasy'`);
const browser = await launch();
const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
const email = `genres-${Date.now()}@test.mn`;
await login(page, email, "/");
sql(`update profiles set is_admin = true where id = (select id from auth.users where email = '${email}')`);

await page.goto(`${BASE}/admin/genres`);
await page.fill("input[aria-label='new нэр']", "Уран зөгнөл");
await page.fill("input[aria-label='new slug']", "fantasy");
await page.selectOption("select[aria-label='new зураг']", "romance");
await page.fill("input[aria-label='new дараалал']", "35");
await page.click("button:has-text('Нэмэх')");
await page.waitForSelector("text=«Уран зөгнөл» төрөл нэмэгдлээ.");
assert(sql(`select label || '|' || art || '|' || position from genres where slug = 'fantasy'`) === "Уран зөгнөл|romance|35", "genre created");

const reader = await (await browser.newContext()).newPage();
await reader.goto(`${BASE}/`);
await reader.waitForSelector("a[href='/library?genre=fantasy']");
assert(true, "new genre chip on home");

// Import a story into the new genre.
await page.goto(`${BASE}/admin/import`);
const story = { title: "Луугийн өндөг", slug: "luugiin-ondog", genre: "fantasy", chapters: [1, 2].map((n) => ({ number: n, title: `Бүлэг ${n}`, free: n === 1, content: "Уран зөгнөлт өгүүллэг. ".repeat(80) })) };
await page.fill("#json", JSON.stringify(story));
await page.click("button:has-text('Шалгах')");
await page.waitForSelector("text=Бэлэн · шинэ");
await page.check("text=Шууд нийтлэх");
await page.click("button:has-text('Оруулах (1)')");
await page.waitForSelector("text=Нэмэгдлээ: Луугийн өндөг");
await page.fill("#json", JSON.stringify({ ...story, slug: "x-unknown", genre: "sci-fi" }));
await page.waitForSelector("text=«sci-fi» байхгүй");
assert(true, "import accepts the new genre and rejects an unknown one");

await reader.goto(`${BASE}/library?genre=fantasy`);
await reader.waitForSelector("text=Луугийн өндөг");
assert((await reader.textContent("main")).includes("Уран зөгнөл"), "library filter + label for new genre");

// Delete blocked while used; rename works; delete works when empty.
await page.goto(`${BASE}/admin/genres`);
const row = page.locator("li", { has: page.locator("input[aria-label='fantasy нэр']") });
await row.locator("button:has-text('Устгах')").click();
await page.waitForSelector("text=Энэ төрөлд 1 өгүүллэг байна");
assert(sql(`select count(*) from genres where slug = 'fantasy'`) === "1", "genre in use not deleted");
await row.locator("input[aria-label='fantasy нэр']").fill("Уран зөгнөлт");
await row.locator("button:has-text('Хадгалах')").click();
await page.waitForSelector("text=Хадгаллаа.");
assert(sql(`select label from genres where slug = 'fantasy'`) === "Уран зөгнөлт", "genre renamed");
sql(`delete from stories where slug = 'luugiin-ondog'`);
await page.reload();
await page.locator("li", { has: page.locator("input[aria-label='fantasy нэр']") }).locator("button:has-text('Устгах')").click();
await page.waitForSelector("text=«fantasy» төрөл устгагдлаа.");
assert(sql(`select count(*) from genres where slug = 'fantasy'`) === "0", "empty genre deleted");
await browser.close();
console.log("\nGenre checks passed");
