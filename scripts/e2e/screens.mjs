// Captures every screen at 360px and 1280px in all three themes.
// Usage: node scripts/e2e/screens.mjs <outDir>
import { mkdirSync } from "node:fs";
import { launch, login, sql, BASE } from "./lib.mjs";

const out = process.argv[2] ?? "screenshots";
const THEMES = ["light", "sepia", "dark"];
const WIDTHS = [360, 1280];
const browser = await launch();
const stamp = Date.now();

// --- states -----------------------------------------------------------------
async function signedIn(email, setup) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await login(page, email, "/");
  setup?.();
  const state = await ctx.storageState();
  await ctx.close();
  return state;
}
const reader = `screens-${stamp}@test.mn`;
const readerState = await signedIn(reader);
const uid = sql(`select id from auth.users where email = '${reader}'`);
sql(`update wallets set balance_coins = 120 where user_id = '${uid}'`);
const freshState = await signedIn(`screens-new-${stamp}@test.mn`);
const admin = `screens-admin-${stamp}@test.mn`;
const adminState = await signedIn(admin);
sql(`update profiles set is_admin = true where id = (select id from auth.users where email = '${admin}')`);

// Reader history + 18+ access for the main reader account.
{
  const ctx = await browser.newContext({ storageState: readerState });
  const p = await ctx.newPage();
  await p.goto(`${BASE}/s/ul-tanikh-zakhidal/1`);
  await p.fill("#birth_year", "1991");
  await p.click("form:has(#birth_year) button[type=submit]");
  await p.waitForSelector(".prose-read");
  await p.goto(`${BASE}/s/arvan-guravdugaar-davhar/2`);
  await p.waitForSelector(".prose-read");
  await p.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight * 0.4));
  await p.waitForTimeout(2600);
  // Payment requests in three states.
  for (const code of ["coins_550", "sub_month", "sub_week"]) {
    await p.goto(`${BASE}/shop`);
    await p.waitForSelector("#packs");
    await Promise.all([p.waitForURL(/\/pay\//), p.click(`form:has(input[value=${code}]) button`)]);
  }
  await ctx.close();
}
const [payCreated, paySubmitted, payApproved] = sql(
  `select string_agg(id::text, ',' order by created_at desc) from payment_requests where user_id = '${uid}'`,
).split(",");
sql(`update payment_requests set status = 'submitted', submitted_at = now() where id in ('${paySubmitted}', '${payApproved}')`);
sql(`select set_config('request.jwt.claims', '{"role":"service_role"}', false); select approve_payment('${payApproved}', 777);`);

const storyAdmin = sql(`select id from stories where slug = 'arvan-guravdugaar-davhar'`);
const chapterAdmin = sql(`select id from chapters where story_id = '${storyAdmin}' and number = 3`);

const SCREENS = [
  // [name, path, state, action]
  ["01-home", "/", null],
  ["02-library", "/library?genre=horror", null],
  ["03-story", "/s/arvan-guravdugaar-davhar", null],
  ["04-reader", "/s/arvan-guravdugaar-davhar/1", null],
  ["05-reader-settings", "/s/arvan-guravdugaar-davhar/1", null, (p) => p.click("button[aria-label='Унших тохиргоо']")],
  ["06-locked-anon", "/s/arvan-guravdugaar-davhar/4", null],
  ["07-login", "/login", null],
  ["08-404", "/s/does-not-exist", null],
  ["09-home-signed-in", "/", readerState],
  ["10-locked-signed-in", "/s/arvan-guravdugaar-davhar/4", readerState],
  ["11-choices", "/s/ul-tanikh-zakhidal/2", readerState, (p) => p.evaluate(() => window.scrollTo(0, 1e6))],
  ["12-age-gate", "/s/ul-tanikh-zakhidal/1", freshState],
  ["13-shop", "/shop", readerState],
  ["14-payment", `/pay/${payCreated}`, readerState],
  ["15-payment-pending", `/pay/${paySubmitted}`, readerState],
  ["16-payment-approved", `/pay/${payApproved}`, readerState],
  ["17-me", "/me", readerState],
  ["18-admin-payments", "/admin/payments?status=all", adminState],
  ["19-admin-story", `/admin/stories/${storyAdmin}`, adminState],
  ["20-admin-chapter", `/admin/stories/${storyAdmin}/chapters/${chapterAdmin}`, adminState],
];

for (const theme of THEMES) {
  for (const width of WIDTHS) {
    const dir = `${out}/${theme}-${width}`;
    mkdirSync(dir, { recursive: true });
    for (const [name, path, state, act] of SCREENS) {
      const ctx = await browser.newContext({ viewport: { width, height: 800 }, storageState: state ?? undefined });
      await ctx.addInitScript((t) => localStorage.setItem("zugaa:reader", JSON.stringify({ theme: t, fs: 2, lh: 2 })), theme);
      const page = await ctx.newPage();
      await page.goto(BASE + path, { waitUntil: "load" });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(300);
      if (act) {
        await act(page);
        await page.waitForTimeout(400);
        await page.screenshot({ path: `${dir}/${name}.png` });
      } else {
        const h = await page.evaluate(() => document.documentElement.scrollHeight);
        await page.setViewportSize({ width, height: Math.min(Math.max(h, 800), 4000) });
        await page.waitForTimeout(250);
        await page.screenshot({ path: `${dir}/${name}.png` });
      }
      await ctx.close();
    }
    console.log("captured", dir);
  }
}
await browser.close();
