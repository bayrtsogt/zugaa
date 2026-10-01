import "server-only";
import {
  TelegramClient,
  decidedMessage,
  paymentKeyboard,
  paymentRequestMessage,
  type PaymentMessageInput,
} from "@zugaa/wallet";
import { createServiceClient } from "@/lib/supabase/server";
import { serverEnv } from "@/lib/server-env";

export function telegram(): TelegramClient | null {
  const token = serverEnv.telegramBotToken();
  return token ? new TelegramClient(token, serverEnv.telegramApiBase()) : null;
}

type RequestInfo = {
  id: string;
  status: string;
  telegram_chat_id: number | null;
  telegram_message_id: number | null;
  decided_at: string | null;
  input: PaymentMessageInput;
};

/** Everything the admin message shows, read with the service role. */
export async function loadRequestInfo(requestId: string): Promise<RequestInfo | null> {
  const db = createServiceClient();
  const { data: r } = await db
    .from("payment_requests")
    .select("id, user_id, ref_code, amount_mnt, status, submitted_at, created_at, decided_at, telegram_chat_id, telegram_message_id, products(title)")
    .eq("id", requestId)
    .maybeSingle();
  if (!r) return null;
  const { data: u } = await db.auth.admin.getUserById(r.user_id);
  return {
    id: r.id,
    status: r.status,
    telegram_chat_id: r.telegram_chat_id,
    telegram_message_id: r.telegram_message_id,
    decided_at: r.decided_at,
    input: {
      refCode: r.ref_code,
      email: u.user?.email ?? null,
      productTitle: r.products?.title ?? "—",
      amountMnt: r.amount_mnt,
      submittedAt: r.submitted_at ?? r.created_at,
    },
  };
}

/** Sends "Шинэ төлбөр — ZG-…" with approve/reject buttons and remembers the message. */
export async function notifyPaymentSubmitted(requestId: string): Promise<boolean> {
  const tg = telegram();
  const chatId = serverEnv.telegramAdminChatId();
  if (!tg || !chatId) {
    console.warn("Telegram not configured; payment request", requestId, "awaits approval in /admin/payments");
    return false;
  }
  const info = await loadRequestInfo(requestId);
  if (!info || info.status !== "submitted") return false;
  const msg = await tg.sendMessage(chatId, paymentRequestMessage(info.input), paymentKeyboard(requestId));
  await createServiceClient()
    .from("payment_requests")
    .update({ telegram_chat_id: msg.chat.id, telegram_message_id: msg.message_id })
    .eq("id", requestId);
  return true;
}

/** Rewrites the admin message after a decision (from Telegram or the admin panel). */
export async function syncTelegramDecision(requestId: string, by: string): Promise<void> {
  const tg = telegram();
  const info = await loadRequestInfo(requestId);
  if (!tg || !info?.telegram_chat_id || !info.telegram_message_id) return;
  if (info.status !== "approved" && info.status !== "rejected") return;
  try {
    await tg.editMessageText(
      info.telegram_chat_id,
      info.telegram_message_id,
      decidedMessage(info.input, info.status, by, info.decided_at ? new Date(info.decided_at) : new Date()),
    );
  } catch (e) {
    // "message is not modified" when both channels decide; harmless.
    console.warn("editMessageText", (e as Error).message);
  }
}
