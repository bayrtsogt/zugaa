import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { safeNextPath } from "@zugaa/auth";
import { msUntil } from "@zugaa/wallet";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { serverEnv } from "@/lib/server-env";
import { PaymentScreen } from "./payment-screen";

export const metadata: Metadata = { title: "Төлбөр", robots: { index: false } };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PayPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ next?: string }>;
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  if (!UUID_RE.test(id)) notFound();
  await requireUser(`/pay/${id}`);

  const supabase = await createClient();
  const { data: r } = await supabase
    .from("payment_requests")
    .select("id, ref_code, amount_mnt, status, reject_reason, created_at, products(title, kind)")
    .eq("id", id)
    .maybeSingle();
  if (!r) notFound();

  // Lazy expiry for display; the database job/functions make it permanent.
  const expired = r.status === "created" && -msUntil(r.created_at) > 24 * 3600_000;

  return (
    <PaymentScreen
      id={r.id}
      refCode={r.ref_code}
      amountMnt={r.amount_mnt}
      productTitle={r.products?.title ?? "—"}
      productKind={r.products?.kind ?? ""}
      initialStatus={expired ? "expired" : (r.status as "created")}
      initialReason={r.reject_reason}
      bank={serverEnv.bank()}
      next={safeNextPath(sp.next, "")}
    />
  );
}
