// Images (admin upload → storage → reader), ongoing stories, follows, in-app updates and
// Telegram new-chapter notifications (/start <token> linking via the webhook).
import { launch, login, assert, sql, BASE } from "./lib.mjs";

const TG = process.env.TELEGRAM_API_BASE ?? "http://127.0.0.1:8099";
const SECRET = process.env.TELEGRAM_WEBHOOK_SECRET ?? "local-webhook-secret";
const SLUG = "zurgiin-turshilt";
const CHAT = 4242;
const long = (s) => (s + " ").repeat(60);
// 4×3 PNG
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAQAAAADCAIAAAA7ljmRAAAAEElEQVR4nGM4YGAARww4OQAONg2BhplLnwAAAABJRU5ErkJggg==",
  "base64",
);
const tgCalls = async () => (await fetch(`${TG}/calls`)).json();
const webhook = (update) =>
  fetch(`${BASE}/api/telegram/webhook`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-telegram-bot-api-secret-token": SECRET },
    body: JSON.stringify({ update_id: Date.now(), ...update }),
  });

sql(`delete from stories where slug = '${SLUG}'`);
sql(`delete from telegram_links where chat_id = ${CHAT}`);
await fetch(`${TG}/calls`, { method: "DELETE" });

const browser = await launch();
const admin = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
const adminEmail = `img-admin-${Date.now()}@test.mn`;
await login(admin, adminEmail, "/");
sql(`update profiles set is_admin = true where id = (select id from auth.users where email = '${adminEmail}')`);

async function importJson(obj) {
  await admin.goto(`${BASE}/admin/import`, { waitUntil: "networkidle" });
  await admin.fill("#json", JSON.stringify(obj));
  await admin.click("button:has-text('Шалгах')");
  await admin.waitForSelector("text=Бэлэн");
  await admin.check("text=Шууд нийтлэх");
  await admin.click("button:has-text('Оруулах (1)')");
  await admin.waitForSelector("text=харах");
}

await importJson({
  slug: SLUG,
  title: "Зургийн туршилт",
  description: "Зурагтай, үргэлжилж буй өгүүллэг",
  genre: "mystery",
  ongoing: true,
  chapters: [
    { number: 1, title: "Нэг", free: true, content: long("Эхний бүлэг.") },
    { number: 2, title: "Хоёр", free: true, content: long("Хоёр дахь бүлэг.") },
  ],
});
const storyId = sql(`select id from stories where slug = '${SLUG}'`);
assert(sql(`select ongoing from stories where id = '${storyId}'`) === "t", "import sets ongoing");

// Admin uploads a chapter image from the chapter form.
const ch1 = sql(`select id from chapters where story_id = '${storyId}' and number = 1`);
await admin.goto(`${BASE}/admin/stories/${storyId}/chapters/${ch1}`, { waitUntil: "networkidle" });
admin.on("console", (m) => m.type() === "error" && console.log("browser:", m.text()));
await admin.setInputFiles("input[data-image-field=image_url]", { name: "a.png", mimeType: "image/png", buffer: PNG });
await admin.waitForSelector("img[src*='/storage/v1/object/public/media/chapters/']");
await admin.click("button[type=submit]:has-text('Хадгалах')");
await admin.waitForSelector("text=Хадгаллаа.");
const img = sql(`select image_url from chapters where id = '${ch1}'`);
assert(/\/storage\/v1\/object\/public\/media\/chapters\/.+\.webp$/.test(img), "chapter image uploaded as WebP to storage");
const fetched = await fetch(img);
assert(fetched.ok && fetched.headers.get("content-type") === "image/webp", "image publicly served");

// Cover upload on the story form.
await admin.goto(`${BASE}/admin/stories/${storyId}`, { waitUntil: "networkidle" });
await admin.setInputFiles("input[data-image-field=cover_url]", { name: "c.png", mimeType: "image/png", buffer: PNG });
await admin.waitForSelector("img[src*='/media/covers/']");
await admin.click("form:has(#title) button[type=submit]");
await admin.waitForSelector("text=Хадгаллаа.");
assert(sql(`select cover_url like '%/media/covers/%' from stories where id = '${storyId}'`) === "t", "cover uploaded");

// Reader sees the image (anonymous), story page shows «ongoing» and the cover as og:image.
const anon = await (await browser.newContext()).newPage();
await anon.goto(`${BASE}/s/${SLUG}/1`);
assert((await anon.getAttribute("main figure img", "src")) === img, "reader shows the chapter image");
await anon.goto(`${BASE}/s/${SLUG}`);
assert((await anon.textContent("main")).includes("Үргэлжилж байна"), "story page shows ongoing");
assert((await anon.getAttribute("meta[property='og:image']", "content"))?.includes("/media/covers/"), "cover is og:image");

// Reader: end of the ongoing story → «continues later» + follow.
const reader = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
const readerEmail = `follower-${Date.now()}@test.mn`;
await login(reader, readerEmail, "/");
await reader.goto(`${BASE}/s/${SLUG}/2`);
await reader.waitForSelector("text=Үргэлжлэл удахгүй гарна");
await reader.click("button:has-text('Дагах')");
await reader.waitForSelector("text=✓ Дагаж байна");
const uid = sql(`select id from auth.users where email = '${readerEmail}'`);
assert(sql(`select count(*) from follows where user_id = '${uid}' and story_id = '${storyId}'`) === "1", "follow saved");

// Link Telegram: /me → bot deep link with a one-time token → /start <token> through the webhook.
let deepLink = "";
await reader.route("https://t.me/**", (route) => {
  deepLink = route.request().url();
  return route.fulfill({ status: 200, body: "telegram" });
});
await reader.goto(`${BASE}/me`);
await reader.click("button:has-text('Telegram холбох')");
await reader.waitForURL(/t\.me/);
const m = deepLink.match(/^https:\/\/t\.me\/zugaa_test_bot\?start=([0-9a-f]{32})$/);
assert(m, "deep link to the bot with a token");
await webhook({ message: { message_id: 1, from: { id: CHAT }, chat: { id: CHAT, type: "private" }, text: `/start ${m[1]}` } });
assert(sql(`select count(*) from telegram_links where user_id = '${uid}' and chat_id = ${CHAT}`) === "1", "chat linked");
assert((await tgCalls()).some((c) => c.method === "sendMessage" && c.params.chat_id === CHAT && c.params.text.includes("Холбогдлоо")), "bot confirms");
await reader.goto(`${BASE}/me`);
await reader.waitForSelector("text=Telegram холбогдсон");
assert((await reader.textContent("main")).includes("Зургийн туршилт"), "/me lists followed story");

// New batch published → follower gets a Telegram message once, and an in-app update.
await importJson({
  slug: SLUG,
  chapters: [
    {
      number: 3,
      title: "Гурав",
      free: true,
      content: long("Гурав дахь бүлэг."),
      choices: [
        { label: "Зүүн", goto: 4, image_url: img },
        { label: "Баруун", goto: 5 },
      ],
    },
    { number: 4, title: "Дөрөв", free: true, ending: true, content: long("Зүүн төгсгөл.") },
    { number: 5, title: "Тав", free: true, ending: true, content: long("Баруун төгсгөл.") },
  ],
});
let notes = [];
for (let i = 0; i < 20 && notes.length === 0; i++) {
  await new Promise((r) => setTimeout(r, 250));
  notes = (await tgCalls()).filter((c) => c.method === "sendMessage" && c.params.chat_id === CHAT && c.params.text.includes("шинэ бүлэг гарлаа"));
}
assert(notes.length === 1, "follower notified on Telegram");
assert(notes[0].params.text.includes("3. Гурав") && notes[0].params.reply_markup.inline_keyboard[0][0].url.endsWith(`/s/${SLUG}/3`), "message names the first new chapter and links to it");

await reader.goto(`${BASE}/`);
await reader.waitForSelector("text=Дагаж буй өгүүллэгт шинэ бүлэг");
assert((await reader.textContent("main")).includes("3. Гурав"), "home shows the update");

// Choice cards with images; reading clears the update.
await reader.goto(`${BASE}/s/${SLUG}/3`);
await reader.waitForSelector(`nav img[src='${img}']`);
assert(true, "choice image shown as a card");
await reader.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await reader.waitForTimeout(2500);
await reader.goto(`${BASE}/`);
assert(!(await reader.textContent("main")).includes("Дагаж буй өгүүллэгт шинэ бүлэг"), "reading clears the update");

// Re-import without image keys keeps the uploaded images.
await importJson({ slug: SLUG, chapters: [{ number: 1, title: "Нэг", free: true, content: long("ЗАССАН эхний бүлэг.") }, { number: 3, title: "Гурав", free: true, content: long("Гурав."), choices: [{ label: "Зүүн", goto: 4 }, { label: "Баруун", goto: 5 }] }] });
assert(sql(`select image_url from chapters where id = '${ch1}'`) === img, "re-import keeps the chapter image");
assert(sql(`select count(*) from chapter_choices cc join chapters c on c.id = cc.chapter_id where c.story_id = '${storyId}' and cc.image_url = '${img}'`) === "1", "re-import keeps the choice image");

// Re-publishing sends nothing new (claimed once).
await new Promise((r) => setTimeout(r, 800));
assert((await tgCalls()).filter((c) => c.method === "sendMessage" && c.params.chat_id === CHAT && c.params.text.includes("шинэ бүлэг гарлаа")).length === 1, "no duplicate notification");

// /stop unlinks.
await webhook({ message: { message_id: 2, from: { id: CHAT }, chat: { id: CHAT, type: "private" }, text: "/stop" } });
assert(sql(`select count(*) from telegram_links where chat_id = ${CHAT}`) === "0", "/stop unlinks");

await browser.close();
console.log("\nFollow & image checks passed");
