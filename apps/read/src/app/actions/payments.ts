"use server";
import { redirect } from "next/navigation";
import { safeNextPath } from "@zugaa/auth";
import { createPaymentRequest, walletErrorText } from "@zugaa/wallet";
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
