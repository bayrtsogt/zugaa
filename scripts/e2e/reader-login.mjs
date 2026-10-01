// Reader account setup: OTP login + 18+ birth-year gate. Saves the session for the other reader-* checks.
import { sql as _sql } from "./lib.mjs";
_sql("update profiles set birth_year = null where id = (select id from auth.users where email = 'reader1@test.mn')");
_sql("delete from private.rate_limits where key like 'otp%'");
_sql("delete from reading_progress where user_id = (select id from auth.users where email = 'reader1@test.mn')");
import { launch, login, assert, BASE } from "./lib.mjs";
const b = await launch(); const ctx = await b.newContext({ viewport: { width: 360, height: 800 } }); const p = await ctx.newPage();
await login(p, "reader1@test.mn", "/s/ul-tanikh-zakhidal/1");
assert(p.url().endsWith("/s/ul-tanikh-zakhidal/1"), "redirected back after OTP login: " + p.url());
await p.waitForSelector("#birth_year"); assert(true, "18+ story asks for birth year");
await p.fill("#birth_year", "1992"); await Promise.all([p.waitForLoadState("load"), p.click("form:has(#birth_year) button[type=submit]")]);
await p.waitForSelector(".prose-read");
assert((await p.textContent(".prose-read")).includes("Захидал даваа гарагийн"), "18+ chapter opens after birth year");
await ctx.storageState({ path: "/tmp/zugaa-reader.json" });
// OTP rate limit: 5 codes per email per hour; the 6th is refused by the app.
const rl = await (await b.newContext()).newPage();
const victim = `ratelimit-${Date.now()}@test.mn`;
for (let i = 0; i < 6; i++) {
  await rl.goto(`${BASE}/login`);
  await rl.fill("#email", victim);
  await rl.click("button[type=submit]");
  await rl.waitForSelector(i < 5 ? "#token" : "text=Хэт олон удаа код хүслээ");
}
assert(true, "6th OTP request for one email within an hour is refused");
await b.close();
