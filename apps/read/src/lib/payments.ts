import "server-only";
import type { ZugaaClient } from "@zugaa/auth";
import { submitPaymentRequest, walletErrorText } from "@zugaa/wallet";
import { allow } from "@/lib/rate-limit";
import { notifyPaymentSubmitted } from "@/lib/telegram";

export type SubmitResult = { status?: string; error?: string };

/**
 * "Гүйлгээ хийсэн": created → submitted, then notify the admin on Telegram.
 * Shared by this app's server action and the cross-app /api/payments route.
 */
export async function submitAndNotify(client: ZugaaClient, userId: string, requestId: string): Promise<SubmitResult> {
  if (!(await allow(`submit:${userId}`, 10, 600))) {
    return { error: "Хэт олон оролдлого. Түр хүлээгээд дахин оролдоно уу." };
  }
  try {
    const res = await submitPaymentRequest(client, requestId);
    if (res.needs_notify) {
      await notifyPaymentSubmitted(requestId).catch((e) => console.error("telegram notify", e));
    }
    return { status: res.status };
  } catch (e) {
    return { error: walletErrorText(e) };
  }
}
