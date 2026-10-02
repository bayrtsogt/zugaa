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
 * Readers link their chat for new-chapter messages with /start <token>
 * (deep link from /me) and unlink with /stop.
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
    else if (update?.message && isPrivateCommand(update.message)) await onReaderCommand(update.message);
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

function isPrivateCommand(m: TelegramMessage): boolean {
  return (m.chat.type === undefined || m.chat.type === "private") && /^\/(start|stop)\b/.test(m.text ?? "");
}

/** Reader links (/start <token>) or unlinks (/stop) new-chapter notifications. */
async function onReaderCommand(m: TelegramMessage) {
  const tg = telegram();
  const db = createServiceClient();
  const [command, arg = ""] = (m.text ?? "").trim().split(/\s+/, 2);
  if (command === "/stop") {
    await db.rpc("unlink_telegram_chat", { p_chat_id: m.chat.id });
    await tg?.sendMessage(m.chat.id, "Мэдэгдэл зогслоо. Дахин авах бол Зугаа → Миний хэсгээс Telegram-аа холбоно уу.");
    return;
  }
  if (!/^[0-9a-f]{32}$/.test(arg)) {
    await tg?.sendMessage(m.chat.id, "Сайн байна уу! Шинэ бүлгийн мэдэгдэл авах бол Зугаа → Миний хэсгээс «Telegram холбох» товчийг дарна уу.");
    return;
  }
  const { data: ok } = await db.rpc("link_telegram", { p_token: arg, p_chat_id: m.chat.id });
  await tg?.sendMessage(
    m.chat.id,
    ok
      ? "✅ Холбогдлоо! Таны дагаж буй өгүүллэгт шинэ бүлэг гармагц энд мэдэгдэнэ. Зогсоох бол /stop."
      : "Холбоосны хугацаа дууссан байна. Зугаа → Миний хэсгээс дахин оролдоно уу.",
  );
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
