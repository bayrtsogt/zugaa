/**
 * Registers the Telegram webhook.
 *
 *   TELEGRAM_BOT_TOKEN=... TELEGRAM_WEBHOOK_SECRET=... APP_URL=https://read.zugaa.mn \
 *     pnpm telegram:set-webhook
 *
 * Telegram will POST updates to {APP_URL}/api/telegram/webhook with the
 * X-Telegram-Bot-Api-Secret-Token header set to TELEGRAM_WEBHOOK_SECRET.
 */
import { TelegramClient } from "../packages/wallet/src/telegram";

const token = process.env.TELEGRAM_BOT_TOKEN;
const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
const appUrl = process.env.APP_URL?.replace(/\/+$/, "");

if (!token || !secret || !appUrl) {
  console.error("Set TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET and APP_URL.");
  process.exit(1);
}
if (!/^[A-Za-z0-9_-]{1,256}$/.test(secret)) {
  console.error("TELEGRAM_WEBHOOK_SECRET may only contain A-Z, a-z, 0-9, _ and - (1–256 chars).");
  process.exit(1);
}
if (!appUrl.startsWith("https://")) {
  console.error("Telegram requires an https:// APP_URL.");
  process.exit(1);
}

const tg = new TelegramClient(token, process.env.TELEGRAM_API_BASE || undefined);
const url = `${appUrl}/api/telegram/webhook`;
await tg.setWebhook(url, secret);
const info = await tg.call<{ url: string; pending_update_count: number; allowed_updates?: string[] }>("getWebhookInfo", {});
console.log("Webhook set:", info.url);
console.log("Allowed updates:", info.allowed_updates?.join(", "));
console.log("Pending updates:", info.pending_update_count);
