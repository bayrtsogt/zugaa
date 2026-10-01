// Acceptance flow from the spec, end to end against the local stack:
// sign up → read free → hit lock → buy month pass → "Гүйлгээ хийсэн" →
// approve in Telegram (webhook) → pending screen flips without refresh → reader unlocked.
// Also: webhook auth, non-admin tap, double approve, reject with a reply reason.
//
// Needs: local Supabase, `next start` with TELEGRAM_API_BASE pointing at
// scripts/e2e/mock-telegram.mjs, TELEGRAM_WEBHOOK_SECRET and ADMIN_TELEGRAM_IDS=777.
import { launch, login, assert, sql, BASE } from "./lib.mjs";

const TG = process.env.MOCK_TELEGRAM ?? "http://127.0.0.1:8099";
const SECRET = process.env.TELEGRAM_WEBHOOK_SECRET ?? "local-webhook-secret";
const ADMIN = { id: 777, first_name: "Админ", username: "zugaa_admin" };
const email = `flow-${Date.now()}@test.mn`;

const tgCalls = async () => (await fetch(`${TG}/calls`)).json();
const webhook = (update, secret = SECRET) =>
  fetch(`${BASE}/api/telegram/webhook`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-telegram-bot-api-secret-token": secret },
    body: JSON.stringify({ update_id: Date.now(), ...update }),
  });
const tap = (data, from = ADMIN, messageId = 1) =>
  webhook({ callback_query: { id: `cq-${Math.random()}`, from, data, message: { message_id: messageId, chat: { id: -1001 } } } });

await fetch(`${TG}/calls`, { method: "DELETE" });
const browser = await launch();
const ctx = await browser.newContext({ viewport: { width: 360, height: 800 } });
const page = await ctx.newPage();

// 1. Sign up (OTP creates the account) and read a free chapter.
await login(page, email, "/s/arvan-guravdugaar-davhar/1");
await page.waitForSelector(".prose-read");
assert((await page.textContent(".prose-read")).includes("Өлзийтэй яг адилхан"), "new user reads free chapter 1 in full");

// 2. Hit the lock on chapter 3.
await page.goto(`${BASE}/s/arvan-guravdugaar-davhar/3`);
await page.waitForSelector("#locked-title");
assert(!(await page.textContent("main")).includes("Чи надгүйгээр явчихлаа"), "locked chapter shows preview only");

// 3. Buy the month pass.
await page.click("a:has-text('Сарын эрх')");
await page.waitForSelector("#subs");
await Promise.all([page.waitForURL(/\/pay\//), page.click("form:has(input[value=sub_month]) button")]);
await page.waitForSelector("button:has-text('Гүйлгээ хийсэн')");
const payUrl = page.url();
const requestId = payUrl.match(/\/pay\/([0-9a-f-]{36})/)[1];
const main = await page.textContent("main");
const ref = main.match(/ZG-\d{4,}/)[0];
assert(main.includes("20,000₮") && main.includes("Хаан банк") && main.includes("5000 1234 5678"), "payment screen shows amount and bank details");
assert(main.includes(`Гүйлгээний утга дээр ${ref} гэж бичнэ үү`), `instruction shows reference ${ref}`);
assert((await page.locator("button:has-text('Хуулах')").count()) === 3, "copy buttons for amount, account and reference");
assert(sql(`select amount_mnt from payment_requests where id = '${requestId}'`) === "20000", "amount taken from products on the server");

// 4. "Гүйлгээ хийсэн" → submitted + Telegram message with buttons.
await page.click("button:has-text('Гүйлгээ хийсэн')");
await page.waitForSelector("text=Шалгаж байна");
const sent = (await tgCalls()).find((c) => c.method === "sendMessage");
assert(sent && sent.params.text.startsWith(`Шинэ төлбөр — ${ref}`), "admin got 'Шинэ төлбөр' message");
assert(sent.params.text.includes(`Хэрэглэгч: ${email}`) && sent.params.text.includes("Бүтээгдэхүүн: Сарын эрх") && sent.params.text.includes("Дүн: 20,000₮"), "message has user, product, amount");
const buttons = sent.params.reply_markup.inline_keyboard[0];
assert(buttons[0].text === "✅ Батлах" && buttons[1].text === "❌ Татгалзах", "inline buttons Батлах / Татгалзах");
const messageId = sql(`select telegram_message_id from payment_requests where id = '${requestId}'`);

// 5. Webhook security.
assert((await webhook({}, "wrong-secret")).status === 401, "wrong secret token → 401");
await tap(buttons[0].callback_data, { id: 12345, first_name: "Хэн нэгэн" });
const denied = (await tgCalls()).filter((c) => c.method === "answerCallbackQuery").pop();
assert(denied.params.text === "Эрхгүй", "non-admin tap answered 'Эрхгүй'");
assert(sql(`select status from payment_requests where id = '${requestId}'`) === "submitted", "non-admin tap changes nothing");

// 6. Admin approves; the open page flips by itself (Realtime; polling is 10 s).
const t0 = Date.now();
await tap(buttons[0].callback_data, ADMIN, Number(messageId));
await page.waitForSelector("text=Эрх нээгдлээ", { timeout: 15000 });
const flipMs = Date.now() - t0;
assert(true, `pending screen switched to 'Эрх нээгдлээ' without refresh in ${flipMs} ms${flipMs < 5000 ? " (Realtime)" : " (polling)"}`);
const calls = await tgCalls();
const edit = calls.filter((c) => c.method === "editMessageText").pop();
assert(edit.params.text.includes("✅ Батлагдсан — @zugaa_admin") && edit.params.reply_markup.inline_keyboard.length === 0, "Telegram message edited to ✅ Батлагдсан, buttons removed");
assert(calls.filter((c) => c.method === "answerCallbackQuery").pop().params.text === "Батлагдлаа", "callback answered");

// 7. Reader unlocks.
await page.click("text=Үргэлжлүүлэн унших");
await page.waitForSelector("footer");
assert((await page.textContent("main")).includes("Чи надгүйгээр явчихлаа"), "chapter 3 now readable in full");

// 8. Double approve grants once.
await tap(buttons[0].callback_data, ADMIN, Number(messageId));
assert((await tgCalls()).filter((c) => c.method === "answerCallbackQuery").pop().params.text === "Аль хэдийн шийдвэрлэсэн", "second approve: 'Аль хэдийн шийдвэрлэсэн'");
assert(sql(`select count(*) from subscriptions s join auth.users u on u.id = s.user_id where u.email = '${email}'`) === "1", "one subscription after double approve");

// 9. Reject with a reason reply.
await page.goto(`${BASE}/shop`);
await Promise.all([page.waitForURL(/\/pay\//), page.click("form:has(input[value=coins_300]) button")]);
await page.waitForSelector("button:has-text('Гүйлгээ хийсэн')");
const rejectId = page.url().match(/\/pay\/([0-9a-f-]{36})/)[1];
await page.click("button:has-text('Гүйлгээ хийсэн')");
await page.waitForSelector("text=Шалгаж байна");
const msg2 = (await tgCalls()).filter((c) => c.method === "sendMessage").pop();
const mid2 = Number(sql(`select telegram_message_id from payment_requests where id = '${rejectId}'`));
await tap(msg2.params.reply_markup.inline_keyboard[0][1].callback_data, ADMIN, mid2);
await page.waitForSelector("text=Төлбөр баталгаажсангүй", { timeout: 15000 });
assert(true, "pending screen switched to 'Төлбөр баталгаажсангүй'");
assert((await tgCalls()).filter((c) => c.method === "editMessageText").pop().params.text.includes("❌ Татгалзсан"), "Telegram message edited to ❌ Татгалзсан");
await webhook({ message: { message_id: 5, from: ADMIN, chat: { id: -1001 }, text: "Гүйлгээ олдсонгүй", reply_to_message: { message_id: mid2, chat: { id: -1001 } } } });
assert(sql(`select reject_reason from payment_requests where id = '${rejectId}'`) === "Гүйлгээ олдсонгүй", "reply stored as reject reason");
assert(Number(sql(`select count(*) from audit_log where entity_id in ('${requestId}', '${rejectId}')`)) >= 5, "state changes in audit_log");

await ctx.storageState({ path: process.env.SAVE_STATE ?? "/tmp/flow-user.json" });
await browser.close();
console.log(`\nAll checks passed for ${email}`);
