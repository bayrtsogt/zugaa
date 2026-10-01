// Admin panel: access control, story/chapter CRUD with choices, publish,
// payment approval from the panel (same SQL as Telegram), coin adjustment.
import { launch, login, assert, sql, BASE } from "./lib.mjs";

sql(`delete from stories where slug = 'shoniin-buudal'`);
const browser = await launch();
const stamp = Date.now();

// Anonymous and non-admin are turned away server-side.
const anon = await (await browser.newContext()).newPage();
await anon.goto(`${BASE}/admin/payments`);
assert(anon.url().includes("/login"), "anonymous /admin → login");

const userCtx = await browser.newContext({ viewport: { width: 360, height: 800 } });
const user = await userCtx.newPage();
const userEmail = `buyer-${stamp}@test.mn`;
await login(user, userEmail, "/");
await user.goto(`${BASE}/admin`);
assert(new URL(user.url()).pathname === "/", "non-admin /admin → home");

// Buyer creates and submits a coin purchase.
await user.goto(`${BASE}/shop`);
await user.waitForSelector("#packs");
await Promise.all([user.waitForURL(/\/pay\//), user.click("form:has(input[value=coins_550]) button")]);
await user.waitForSelector("button:has-text('Гүйлгээ хийсэн')");
const ref = (await user.textContent("main")).match(/ZG-\d{4,}/)[0];
await user.click("button:has-text('Гүйлгээ хийсэн')");
await user.waitForSelector("text=Шалгаж байна");

// Admin.
const adminEmail = `admin-${stamp}@test.mn`;
const adminCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const admin = await adminCtx.newPage();
await login(admin, adminEmail, "/");
sql(`update profiles set is_admin = true where id = (select id from auth.users where email = '${adminEmail}')`);

await admin.goto(`${BASE}/admin/payments`);
const row = admin.locator("li", { hasText: ref });
await row.waitFor();
assert((await row.textContent()).includes(userEmail), "payment list shows buyer email");
await row.locator("button:has-text('Батлах')").click();
await admin.waitForSelector(`text=${ref} батлагдлаа.`);
await user.waitForSelector("text=Эрх нээгдлээ", { timeout: 15000 });
assert(true, "admin-panel approval reaches the buyer's open screen");
assert(sql(`select balance_coins from wallets w join auth.users u on u.id = w.user_id where u.email = '${userEmail}'`) === "550", "550 coins granted");

// Coin adjustment with reason.
await admin.goto(`${BASE}/admin/users?q=${encodeURIComponent(userEmail)}`);
await admin.fill("input[name=delta]", "-50");
await admin.fill("li input[name=reason]", "Туршилт");
await admin.click("li button:has-text('Хадгалах')");
await admin.waitForSelector("text=Шинэ үлдэгдэл: 500 coin");
assert(sql(`select count(*) from audit_log where action = 'wallet.adjust'`) !== "0", "coin adjustment audited");

// Story CRUD.
await admin.goto(`${BASE}/admin/stories/new`);
await admin.fill("#title", "Шөнийн буудал");
await admin.fill("#description", "Сүүлчийн галт тэрэг хэзээ ч ирээгүй.");
await admin.selectOption("#genre", "thriller");
await Promise.all([admin.waitForURL(/\/admin\/stories\/[0-9a-f-]{36}$/), admin.click("button:has-text('Хадгалах')")]);
const storyUrl = admin.url();
assert(sql(`select slug from stories where title = 'Шөнийн буудал'`) === "shoniin-buudal", "slug transliterated from Mongolian title");
await admin.goto(`${BASE}/admin/stories/new`);
await admin.fill("#title", "Шөнийн буудал");
await admin.click("button:has-text('Хадгалах')");
await admin.waitForSelector("text=Энэ slug-тай өгүүллэг аль хэдийн байна.");
assert(true, "duplicate slug rejected with a Mongolian message");

for (const [n, title, body] of [[1, "Тасалбар", "Өвлийн шөнө. ".repeat(80)], [2, "Буудал", "Үүр цайх үед. ".repeat(80)]]) {
  await admin.goto(`${storyUrl}/chapters/new?number=${n}`);
  await admin.fill("#title", title);
  await admin.fill("textarea[name=content]", body);
  if (n === 1) await admin.check("input[name=is_free]");
  await admin.check("input[name=published]");
  await Promise.all([admin.waitForURL(/saved=1/), admin.click("button:has-text('Хадгалах')")]);
}
// Add a choice to chapter 1 → chapter 2, and check the preview tab.
await admin.goto(storyUrl);
await admin.click("text=Тасалбар");
await admin.waitForSelector("textarea[name=content]");
await admin.click("button:has-text('+ Сонголт нэмэх')");
await admin.fill("input[name=choice_label]", "Галт тэргэнд суух");
await admin.selectOption("select[name=choice_target]", "2");
await admin.click("button[role=tab]:has-text('Харах')");
assert((await admin.textContent(".prose-read")).includes("Өвлийн шөнө"), "markdown preview renders");
await admin.click("button:has-text('Хадгалах')");
await admin.waitForSelector("text=Хадгаллаа.");

// Draft story is hidden from readers until published.
await user.goto(`${BASE}/s/shoniin-buudal`);
assert((await user.textContent("body")).includes("Олдсонгүй"), "draft story 404 for readers");
await admin.goto(storyUrl);
await admin.click("button:has-text('Нийтлэх')");
await admin.waitForSelector("button:has-text('Нийтлэлээс буулгах')");
await user.goto(`${BASE}/s/shoniin-buudal/1`);
await user.waitForSelector("text=Галт тэргэнд суух");
assert(true, "published story readable with its choice");
await user.click("text=Галт тэргэнд суух");
await user.waitForSelector("#locked-title");
assert(true, "choice leads to the locked chapter screen");

await browser.close();
console.log("\nAdmin checks passed");
