// Usage: node scripts/screenshots.mjs <outDir> <width> <light|sepia|dark|none> <path...>
// Env: BASE_URL (default http://localhost:3000), CHROMIUM_PATH, STORAGE_STATE (signed-in session JSON).
import { chromium } from "playwright-core";

const [, , out, width, theme, ...paths] = process.argv;
const base = process.env.BASE_URL ?? "http://localhost:3000";
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--disable-background-networking", "--disable-component-update", "--no-first-run"],
});
const ctx = await browser.newContext({
  viewport: { width: Number(width), height: 800 },
  storageState: process.env.STORAGE_STATE || undefined,
});
if (theme !== "none") {
  await ctx.addInitScript((t) => localStorage.setItem("zugaa:reader", JSON.stringify({ theme: t, fs: 2, lh: 2 })), theme);
}
const page = await ctx.newPage();
page.on("console", (m) => m.type() === "error" && console.log("console error:", m.text()));
page.on("response", (r) => r.status() >= 400 && console.log("HTTP", r.status(), r.url()));
for (const p of paths) {
  const [path, label] = p.split("@");
  await page.setViewportSize({ width: Number(width), height: 800 });
  await page.goto(base + path, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  // Full-page capture with fixed bars at their true position: grow the viewport to the page.
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.setViewportSize({ width: Number(width), height: Math.min(h, 6000) });
  await page.waitForTimeout(200);
  const name = (label ?? path).replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "") || "home";
  await page.screenshot({ path: `${out}/${name}-${width}-${theme}.png`, fullPage: false });
}
await browser.close();
