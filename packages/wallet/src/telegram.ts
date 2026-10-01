/**
 * Minimal Telegram Bot API client (plain fetch) and the payment-approval
 * message format. App-agnostic: any Зугаа app's payments go through here.
 */
import { formatDateTime, formatMnt } from "./format";

export type InlineButton = { text: string; callback_data: string };
export type InlineKeyboard = { inline_keyboard: InlineButton[][] };

export type TelegramUser = { id: number; first_name?: string; last_name?: string; username?: string };
export type TelegramMessage = {
  message_id: number;
  chat: { id: number };
  from?: TelegramUser;
  text?: string;
  reply_to_message?: TelegramMessage;
};
export type TelegramCallbackQuery = {
  id: string;
  from: TelegramUser;
  message?: TelegramMessage;
  data?: string;
};
export type TelegramUpdate = {
  update_id: number;
  callback_query?: TelegramCallbackQuery;
  message?: TelegramMessage;
};

export class TelegramClient {
  constructor(
    private readonly token: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async call<T = unknown>(method: string, body: Record<string, unknown>): Promise<T> {
    const res = await this.fetchImpl(`https://api.telegram.org/bot${this.token}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => null)) as { ok: boolean; result?: T; description?: string } | null;
    if (!json?.ok) {
      throw new Error(`Telegram ${method} failed: ${json?.description ?? res.status}`);
    }
    return json.result as T;
  }

  sendMessage(chatId: number | string, text: string, replyMarkup?: InlineKeyboard) {
    return this.call<TelegramMessage>("sendMessage", {
      chat_id: chatId,
      text,
      reply_markup: replyMarkup,
      link_preview_options: { is_disabled: true },
    });
  }

  editMessageText(chatId: number | string, messageId: number, text: string, replyMarkup?: InlineKeyboard) {
    return this.call("editMessageText", {
      chat_id: chatId,
      message_id: messageId,
      text,
      reply_markup: replyMarkup ?? { inline_keyboard: [] },
    });
  }

  answerCallbackQuery(callbackQueryId: string, text?: string) {
    return this.call("answerCallbackQuery", { callback_query_id: callbackQueryId, text });
  }

  setWebhook(url: string, secretToken: string) {
    return this.call("setWebhook", {
      url,
      secret_token: secretToken,
      allowed_updates: ["callback_query", "message"],
      drop_pending_updates: false,
    });
  }
}

/* -------------------------------------------------------------------------- */
/* Callback data: "pay:a:<uuid>" / "pay:r:<uuid>" (well under the 64-byte cap) */
/* -------------------------------------------------------------------------- */

export type PaymentAction = "approve" | "reject";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function encodePaymentCallback(action: PaymentAction, requestId: string): string {
  return `pay:${action === "approve" ? "a" : "r"}:${requestId}`;
}

export function decodePaymentCallback(data: string | undefined): { action: PaymentAction; requestId: string } | null {
  if (!data) return null;
  const m = /^pay:([ar]):(.+)$/.exec(data);
  if (!m || !UUID_RE.test(m[2]!)) return null;
  return { action: m[1] === "a" ? "approve" : "reject", requestId: m[2]! };
}

/* -------------------------------------------------------------------------- */
/* Message text                                                                */
/* -------------------------------------------------------------------------- */

export type PaymentMessageInput = {
  refCode: string;
  email: string | null;
  productTitle: string;
  amountMnt: number;
  submittedAt: string | Date;
};

export function paymentRequestMessage(p: PaymentMessageInput): string {
  return [
    `Шинэ төлбөр — ${p.refCode}`,
    `Хэрэглэгч: ${p.email ?? "—"}`,
    `Бүтээгдэхүүн: ${p.productTitle}`,
    `Дүн: ${formatMnt(p.amountMnt)}`,
    `Цаг: ${formatDateTime(p.submittedAt)}`,
  ].join("\n");
}

export function paymentKeyboard(requestId: string): InlineKeyboard {
  return {
    inline_keyboard: [
      [
        { text: "✅ Батлах", callback_data: encodePaymentCallback("approve", requestId) },
        { text: "❌ Татгалзах", callback_data: encodePaymentCallback("reject", requestId) },
      ],
    ],
  };
}

export function adminName(user: TelegramUser | { name: string }): string {
  if ("name" in user) return user.name;
  if (user.username) return `@${user.username}`;
  return [user.first_name, user.last_name].filter(Boolean).join(" ") || String(user.id);
}

export function decidedMessage(
  original: PaymentMessageInput,
  decision: "approved" | "rejected",
  by: string,
  at: Date = new Date(),
): string {
  const line =
    decision === "approved"
      ? `✅ Батлагдсан — ${by} ${formatDateTime(at)}`
      : `❌ Татгалзсан — ${by} ${formatDateTime(at)}\nШалтгаан бичих бол энэ мессежид хариу бичнэ үү.`;
  return `${paymentRequestMessage(original)}\n\n${line}`;
}

export function parseAdminIds(raw: string | undefined): Set<number> {
  return new Set(
    (raw ?? "")
      .split(",")
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isSafeInteger(n) && n > 0),
  );
}

/** Constant-time string comparison for the webhook secret header. */
export function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  let diff = ab.length ^ bb.length;
  const len = Math.max(ab.length, bb.length);
  for (let i = 0; i < len; i++) diff |= (ab[i] ?? 0) ^ (bb[i] ?? 0);
  return diff === 0;
}
