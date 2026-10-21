"use server";
import { redirect } from "next/navigation";
import { safeNextPath } from "@zugaa/auth";
import { createPaymentRequest, walletErrorText } from "@zugaa/wallet";
import { submitAndNotify, type SubmitResult } from "@/lib/payments";
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

export type { SubmitResult } from "@/lib/payments";

/** "Гүйлгээ хийсэн": created → submitted, then notify the admin on Telegram. */
export async function submitPayment(requestId: string): Promise<SubmitResult> {
  const user = await getUser();
  if (!user) return { error: "Нэвтэрнэ үү." };
  return submitAndNotify(await createClient(), user.id, requestId);
}

/** Polling fallback for the pending screen (RLS: own requests only). */
export async function getPaymentStatus(requestId: string): Promise<{ status: string; reject_reason: string | null } | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("payment_requests").select("status, reject_reason").eq("id", requestId).maybeSingle();
  return data;
}
