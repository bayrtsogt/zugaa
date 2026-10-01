"use server";
import { redirect } from "next/navigation";
import { safeNextPath } from "@zugaa/auth";
import { createPaymentRequest, submitPaymentRequest, walletErrorText } from "@zugaa/wallet";
import { allow } from "@/lib/rate-limit";
import { notifyPaymentSubmitted } from "@/lib/telegram";
import { createClient } from "@/lib/supabase/server";
import { getUser, loginHref } from "@/lib/auth";

export type PurchaseState = { error?: string };

/** Creates a payment request for a product; the price is read from `products` in SQL. */
export async function startPurchase(_prev: PurchaseState, form: FormData): Promise<PurchaseState> {
  const code = String(form.get("product") ?? "");
  const next = safeNextPath(String(form.get("next") ?? ""), "");
  if (!(await getUser())) redirect(loginHref(`/shop${next ? `?next=${encodeURIComponent(next)}` : ""}`));

  const supabase = await createClient();
  let id: string;
  try {
    id = (await createPaymentRequest(supabase, code)).id;
  } catch (e) {
    return { error: walletErrorText(e) };
  }
  redirect(`/pay/${id}${next ? `?next=${encodeURIComponent(next)}` : ""}`);
}

export type SubmitResult = { status?: string; error?: string };

/** "Гүйлгээ хийсэн": created → submitted, then notify the admin on Telegram. */
export async function submitPayment(requestId: string): Promise<SubmitResult> {
  const user = await getUser();
  if (!user) return { error: "Нэвтэрнэ үү." };
  if (!(await allow(`submit:${user.id}`, 10, 600))) {
    return { error: "Хэт олон оролдлого. Түр хүлээгээд дахин оролдоно уу." };
  }
  const supabase = await createClient();
  try {
    const res = await submitPaymentRequest(supabase, requestId);
    if (res.needs_notify) {
      await notifyPaymentSubmitted(requestId).catch((e) => console.error("telegram notify", e));
    }
    return { status: res.status };
  } catch (e) {
    return { error: walletErrorText(e) };
  }
}

/** Polling fallback for the pending screen (RLS: own requests only). */
export async function getPaymentStatus(requestId: string): Promise<{ status: string; reject_reason: string | null } | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("payment_requests").select("status, reject_reason").eq("id", requestId).maybeSingle();
  return data;
}
