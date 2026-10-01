import { NextResponse, type NextRequest } from "next/server";
import {
  adminName,
  approvePayment,
  decodePaymentCallback,
  parseAdminIds,
  rejectPayment,
  setRejectReason,
  timingSafeEqual,
  type TelegramCallbackQuery,
  type TelegramMessage,
  type TelegramUpdate,
} from "@zugaa/wallet";
import { createServiceClient } from "@/lib/supabase/server";
import { serverEnv } from "@/lib/server-env";
import { syncTelegramDecision, telegram } from "@/lib/telegram";

/**
 * Telegram webhook: admin approves / rejects payment requests with inline
 * buttons, and can reply to a rejected request's message with a reason.
 */
export async function POST(request: NextRequest) {
  const expected = serverEnv.telegramWebhookSecret();
  const got = request.headers.get("x-telegram-bot-api-secret-token") ?? "";
  if (!expected || !timingSafeEqual(got, expected)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const update = (await request.json().catch(() => null)) as TelegramUpdate | null;
  try {
    if (update?.callback_query) await onCallback(update.callback_query);
    else if (update?.message) await onMessage(update.message);
  } catch (e) {
    console.error("telegram webhook", e);
  }
  // Always 200 so Telegram does not redeliver; failures are logged.
  return NextResponse.json({ ok: true });
}

async function onCallback(cq: TelegramCallbackQuery) {
  const tg = telegram();
  let answer = "";
  try {
    if (!parseAdminIds(serverEnv.adminTelegramIds()).has(cq.from.id)) {
      answer = "Эрхгүй";
      return;
    }
    const parsed = decodePaymentCallback(cq.data);
    if (!parsed) {
      answer = "Буруу хүсэлт";
      return;
    }
    const db = createServiceClient();
    const result =
      parsed.action === "approve"
        ? await approvePayment(db, parsed.requestId, cq.from.id)
        : await rejectPayment(db, parsed.requestId, { adminTelegramId: cq.from.id });

    if (result.ok) {
      await syncTelegramDecision(parsed.requestId, adminName(cq.from));
      answer = result.already
        ? "Аль хэдийн шийдвэрлэсэн"
        : parsed.action === "approve"
          ? "Батлагдлаа"
          : "Татгалзлаа";
    } else {
      answer = `Өөрчлөх боломжгүй (${result.status})`;
    }
  } catch (e) {
    console.error("telegram callback", e);
    answer = "Алдаа гарлаа";
  } finally {
    // Always answer so the button stops spinning.
    await tg?.answerCallbackQuery(cq.id, answer || undefined).catch(() => {});
  }
}

/** Admin replies to a rejected request's message → store it as the reason. */
async function onMessage(m: TelegramMessage) {
  if (!m.from || !parseAdminIds(serverEnv.adminTelegramIds()).has(m.from.id)) return;
  const replyTo = m.reply_to_message?.message_id;
  const text = m.text?.trim();
  if (!replyTo || !text) return;

  const db = createServiceClient();
  const { data: r } = await db
    .from("payment_requests")
    .select("id, ref_code, status")
    .eq("telegram_chat_id", m.chat.id)
    .eq("telegram_message_id", replyTo)
    .maybeSingle();
  if (!r) return;

  const tg = telegram();
  if (r.status !== "rejected") {
    await tg?.sendMessage(m.chat.id, `${r.ref_code}: шалтгааныг зөвхөн татгалзсан хүсэлтэд бичнэ.`);
    return;
  }
  await setRejectReason(db, r.id, text);
  await tg?.sendMessage(m.chat.id, `${r.ref_code}: шалтгаан хадгалагдлаа.`);
}
