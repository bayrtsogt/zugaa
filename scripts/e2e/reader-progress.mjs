// Reading progress: header auto-hide, debounced save, position restore, continue-reading.
import { launch, assert, BASE } from "./lib.mjs";
const b = await launch(); const ctx = await b.newContext({ viewport: { width: 360, height: 700 }, storageState: "/tmp/zugaa-reader.json" }); const p = await ctx.newPage();
await p.goto(`${BASE}/s/arvan-guravdugaar-davhar/2`); await p.waitForSelector(".prose-read");
await p.evaluate(() => window.scrollTo(0, (document.documentElement.scrollHeight - innerHeight) * 0.5));
await p.waitForTimeout(400);
assert(await p.evaluate(() => document.querySelector("header").className.includes("-translate-y-full")), "header hides on scroll down");
await p.evaluate(() => window.scrollBy(0, -200)); await p.waitForTimeout(300);
assert(!(await p.evaluate(() => document.querySelector("header").className.includes("-translate-y-full"))), "header shows on scroll up");
await p.waitForTimeout(2600);
const p2 = await ctx.newPage();
await p2.goto(`${BASE}/s/arvan-guravdugaar-davhar/2`); await p2.waitForTimeout(500);
const pct = await p2.evaluate(() => window.scrollY / (document.documentElement.scrollHeight - innerHeight));
assert(pct > 0.3 && pct < 0.6, "position restored on reopen: " + pct.toFixed(2));
await p2.goto(`${BASE}/`); await p2.waitForSelector("#stories");
assert((await p2.textContent("main")).includes("Үргэлжлүүлэн унших"), "home shows continue reading");
await p2.goto(`${BASE}/s/arvan-guravdugaar-davhar`); await p2.waitForSelector("#chapters");
assert((await p2.textContent("main")).includes("Үргэлжлүүлэх · 2-р бүлэг"), "story page shows Үргэлжлүүлэх");
await b.close();
