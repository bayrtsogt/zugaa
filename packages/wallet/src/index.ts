/**
 * App-agnostic wallet / subscription / payment logic.
 * All grants and prices are decided in Postgres; these are typed wrappers.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, PaymentStatus, ProductKind, Tables } from "@zugaa/db";
import { formatMnt } from "./format";

export * from "./format";
export * from "./telegram";

type Client = SupabaseClient<Database>;

export type Product = Pick<
  Tables<"products">,
  "id" | "code" | "kind" | "app" | "title" | "description" | "price_mnt" | "coins" | "duration_days" | "story_id"
>;
export type PaymentRequest = Tables<"payment_requests">;

export type WalletSummary = {
  balance_coins: number;
  subscription_expires_at: string | null;
  month_spent_mnt: number;
  month_subscription_price_mnt: number | null;
  show_nudge: boolean;
};

export type UnlockResult =
  | { status: "unlocked" | "already"; balance: number }
  | { status: "insufficient"; balance: number; price: number };

export type ApproveResult = {
  ok: boolean;
  already: boolean;
  status: PaymentStatus;
  ref_code: string;
  kind?: ProductKind;
  expires_at?: string | null;
};

/* -------------------------------------------------------------------------- */
/* Errors raised by the SQL functions → Mongolian UI text.                     */
/* -------------------------------------------------------------------------- */

const ERROR_TEXT: Record<string, string> = {
  not_authenticated: "Нэвтэрнэ үү.",
  not_found: "Олдсонгүй.",
  product_not_found: "Бүтээгдэхүүн олдсонгүй.",
  too_many_open: "Танд дуусаагүй 3 төлбөрийн хүсэлт байна. Эхлээд тэдгээрийг дуусгана уу.",
  rate_limited: "Хэт олон оролдлого. Түр хүлээгээд дахин оролдоно уу.",
  age_restricted: "Энэ өгүүллэг 18 наснаас дээш уншигчдад зориулагдсан.",
  not_for_sale: "Энэ өгүүллэгийг бүтнээр нь худалдахгүй байна.",
  forbidden: "Эрхгүй.",
  insufficient_balance: "Үлдэгдэл хүрэлцэхгүй байна.",
  invalid_amount: "Дүн буруу байна.",
  reason_required: "Шалтгаан бичнэ үү.",
};

export class WalletError extends Error {
  constructor(
    public readonly code: string,
    message?: string,
  ) {
    super(message ?? ERROR_TEXT[code] ?? "Алдаа гарлаа. Дахин оролдоно уу.");
  }
}

function toWalletError(error: { message: string } | null): WalletError {
  const code = error?.message?.trim() ?? "unknown";
  return new WalletError(code in ERROR_TEXT ? code : "unknown");
}

export function walletErrorText(e: unknown): string {
  return e instanceof WalletError ? e.message : "Алдаа гарлаа. Дахин оролдоно уу.";
}

/* -------------------------------------------------------------------------- */
/* Reads                                                                       */
/* -------------------------------------------------------------------------- */

const PRODUCT_COLUMNS = "id, code, kind, app, title, description, price_mnt, coins, duration_days, story_id";

export async function listProducts(client: Client, opts: { app?: string } = {}): Promise<Product[]> {
  let q = client
    .from("products")
    .select(PRODUCT_COLUMNS)
    .eq("active", true)
    .in("kind", ["coin_pack", "subscription"])
    .order("sort_order");
  if (opts.app) q = q.in("app", ["all", opts.app]);
  const { data, error } = await q;
  if (error) throw toWalletError(error);
  return data ?? [];
}

export async function getStoryProduct(client: Client, storyId: string): Promise<Product | null> {
  const { data } = await client
    .from("products")
    .select(PRODUCT_COLUMNS)
    .eq("active", true)
    .eq("kind", "story")
    .eq("story_id", storyId)
    .order("sort_order")
    .limit(1)
    .maybeSingle();
  return data;
}

export async function getProductByCode(client: Client, code: string): Promise<Product | null> {
  const { data } = await client.from("products").select(PRODUCT_COLUMNS).eq("code", code).eq("active", true).maybeSingle();
  return data;
}

export async function getWalletSummary(client: Client): Promise<WalletSummary | null> {
  const { data, error } = await client.rpc("my_wallet_summary");
  if (error || !data) return null;
  return data as unknown as WalletSummary;
}

/** "Энэ сард 14,000₮ зарцууллаа. Сарын эрх 20,000₮ — бүх зүйл хязгааргүй." */
export function nudgeText(s: WalletSummary): string | null {
  if (!s.show_nudge || s.month_subscription_price_mnt == null) return null;
  return `Энэ сард ${formatMnt(s.month_spent_mnt)} зарцууллаа. Сарын эрх ${formatMnt(
    s.month_subscription_price_mnt,
  )} — бүх зүйл хязгааргүй.`;
}

/* -------------------------------------------------------------------------- */
/* Unlocks                                                                     */
/* -------------------------------------------------------------------------- */

export async function unlockChapter(client: Client, chapterId: string): Promise<UnlockResult> {
  const { data, error } = await client.rpc("unlock_chapter", { p_chapter_id: chapterId });
  if (error) throw toWalletError(error);
  return data as unknown as UnlockResult;
}

export async function unlockStory(client: Client, storyId: string): Promise<UnlockResult> {
  const { data, error } = await client.rpc("unlock_story", { p_story_id: storyId });
  if (error) throw toWalletError(error);
  return data as unknown as UnlockResult;
}

/* -------------------------------------------------------------------------- */
/* Payments                                                                    */
/* -------------------------------------------------------------------------- */

export async function createPaymentRequest(client: Client, productCode: string): Promise<PaymentRequest> {
  const { data, error } = await client.rpc("create_payment_request", { p_product_code: productCode });
  if (error) throw toWalletError(error);
  return data as PaymentRequest;
}

export async function submitPaymentRequest(
  client: Client,
  requestId: string,
): Promise<{ status: PaymentStatus; needs_notify: boolean }> {
  const { data, error } = await client.rpc("submit_payment_request", { p_request_id: requestId });
  if (error) throw toWalletError(error);
  return data as unknown as { status: PaymentStatus; needs_notify: boolean };
}

/** Service role (webhook/provider) or admin session. */
export async function approvePayment(
  client: Client,
  requestId: string,
  adminTelegramId?: number,
): Promise<ApproveResult> {
  const { data, error } = await client.rpc("approve_payment", {
    p_request_id: requestId,
    p_admin_telegram_id: adminTelegramId,
  });
  if (error) throw toWalletError(error);
  return data as unknown as ApproveResult;
}

export async function rejectPayment(
  client: Client,
  requestId: string,
  opts: { adminTelegramId?: number; reason?: string } = {},
): Promise<ApproveResult> {
  const { data, error } = await client.rpc("reject_payment", {
    p_request_id: requestId,
    p_admin_telegram_id: opts.adminTelegramId,
    p_reason: opts.reason,
  });
  if (error) throw toWalletError(error);
  return data as unknown as ApproveResult;
}

export async function setRejectReason(client: Client, requestId: string, reason: string): Promise<boolean> {
  const { data, error } = await client.rpc("set_payment_reject_reason", {
    p_request_id: requestId,
    p_reason: reason,
  });
  if (error) throw toWalletError(error);
  return Boolean(data);
}

/* -------------------------------------------------------------------------- */
/* Labels                                                                      */
/* -------------------------------------------------------------------------- */

export const PAYMENT_STATUS_TEXT: Record<PaymentStatus, string> = {
  created: "Төлбөр хүлээгдэж байна",
  submitted: "Шалгаж байна",
  approved: "Батлагдсан",
  rejected: "Татгалзсан",
  expired: "Хугацаа дууссан",
};

export function isOpenStatus(s: PaymentStatus): boolean {
  return s === "created" || s === "submitted";
}

export function productSummary(p: Pick<Product, "kind" | "coins" | "duration_days">): string {
  if (p.kind === "coin_pack" && p.coins) return `${p.coins.toLocaleString("en-US")} coin`;
  if (p.kind === "subscription" && p.duration_days) return `${p.duration_days} хоног, бүх бүлэг`;
  return "Бүтэн өгүүллэг";
}
