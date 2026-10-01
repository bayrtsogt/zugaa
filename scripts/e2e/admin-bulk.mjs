// Admin bulk story actions: hide, delete (typed confirmation), story with payment history is hidden not deleted.
import { launch, login, assert, sql, BASE } from "./lib.mjs";

const mk = (slug, title) =>
  sql(`insert into stories (slug, title, status) values ('${slug}', '${title}', 'published') on conflict (slug) do update set status = 'published' returning id`);
sql(`delete from payment_requests where product_id in (select id from products where code = 'bulk-test-product')`);
sql(`delete from stories where slug like 'bulk-%'`);
const a = mk("bulk-a", "Бөөн А");
const b = mk("bulk-b", "Бөөн Б");
const c = mk("bulk-c", "Бөөн В");
for (const id of [a, b, c]) sql(`insert into chapters (story_id, number, title, content, is_free, published_at) values ('${id}', 1, 'Нэг', 'Текст', true, now())`);

const browser = await launch();
const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
const email = `bulk-${Date.now()}@test.mn`;
await login(page, email, "/");
sql(`update profiles set is_admin = true where id = (select id from auth.users where email = '${email}')`);
const uid = sql(`select id from auth.users where email = '${email}'`);
// Story C has a bank purchase in its history.
const prod = sql(`insert into products (code, kind, app, title, price_mnt, story_id) values ('bulk-test-product', 'story', 'read', 'Бөөн В', 1000, '${c}') returning id`);
sql(`insert into payment_requests (user_id, product_id, ref_code, amount_mnt, status) values ('${uid}', '${prod}', 'ZG-BULK1', 1000, 'approved')`);

await page.goto(`${BASE}/admin/stories`);
await page.check("input[aria-label='Бөөн А сонгох']");
await page.click("button[value=hide]");
await page.waitForSelector("text=1 өгүүллэгийг нуулаа");
assert(sql(`select status from stories where id = '${a}'`) === "draft", "bulk hide → draft");

await page.check("input[aria-label='Бөөн А сонгох']");
await page.check("input[aria-label='Бөөн Б сонгох']");
await page.check("input[aria-label='Бөөн В сонгох']");
assert(await page.isDisabled("button[value=delete]"), "delete disabled until УСТГАХ is typed");
await page.fill("input[name=confirm]", "УСТГАХ");
await page.click("button[value=delete]");
await page.waitForSelector("text=2 өгүүллэг устгагдлаа");
assert(sql(`select count(*) from stories where id in ('${a}', '${b}')`) === "0", "two stories deleted with their chapters");
assert(sql(`select count(*) from chapters where story_id in ('${a}', '${b}')`) === "0", "chapters cascaded");
assert(sql(`select status from stories where id = '${c}'`) === "draft", "story with payment history hidden instead");
assert(sql(`select count(*) from payment_requests where ref_code = 'ZG-BULK1'`) === "1", "payment history kept");
assert((await page.textContent("main")).includes("Төлбөрийн түүхтэй тул устгаагүй, нуусан: Бөөн В"), "admin told why");

sql(`delete from payment_requests where ref_code = 'ZG-BULK1'`);
sql(`delete from stories where id = '${c}'`);
await browser.close();
console.log("\nBulk checks passed");
