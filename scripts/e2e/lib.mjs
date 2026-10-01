// Shared helpers for local end-to-end checks (Supabase local stack + `next start`).
import { chromium } from "playwright-core";

export const BASE = process.env.BASE_URL ?? "http://localhost:3000";
export const MAILPIT = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";

export async function launch() {
  return chromium.launch({
    executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
    args: ["--disable-background-networking", "--disable-component-update", "--no-first-run"],
  });
}

/** Latest 6-digit OTP sent to `email` (Mailpit), waiting up to ~10 s. */
export async function latestOtp(email, after = 0) {
  for (let i = 0; i < 20; i++) {
    const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`);
    const json = await res.json();
    const msg = (json.messages ?? []).find((m) => new Date(m.Created).getTime() > after);
    if (msg) {
      const full = await (await fetch(`${MAILPIT}/api/v1/message/${msg.ID}`)).json();
      const code = /(\d{6})/.exec(full.Text ?? full.HTML ?? "")?.[1];
      if (code) return code;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`no OTP email for ${email}`);
}

/** Signs in through the real login form. */
export async function login(page, email, next = "/") {
  const t = Date.now() - 1000;
  await page.goto(`${BASE}/login?next=${encodeURIComponent(next)}`);
  await page.fill("#email", email);
  await page.click("button[type=submit]");
  await page.waitForSelector("#token");
  const code = await latestOtp(email, t);
  await page.fill("#token", code);
  await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/login")), page.click("form:has(#token) button[type=submit]")]);
}

export function assert(cond, msg) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`ok - ${msg}`);
}
