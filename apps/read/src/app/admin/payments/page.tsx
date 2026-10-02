import Link from "next/link";
import { cx } from "@zugaa/ui";
import type { PaymentStatus } from "@zugaa/db";
import { PAYMENT_STATUS_TEXT, formatDateTime, formatMnt, isOpenStatus } from "@zugaa/wallet";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { DecideForm } from "../forms";

export const metadata = { title: "Төлбөр" };

const FILTERS: Array<{ value: PaymentStatus | "all"; label: string }> = [
  { value: "submitted", label: "Шалгах" },
  { value: "created", label: "Хүлээгдэж буй" },
  { value: "approved", label: "Батлагдсан" },
  { value: "rejected", label: "Татгалзсан" },
  { value: "expired", label: "Хугацаа дууссан" },
  { value: "all", label: "Бүгд" },
];

export default async function AdminPayments({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const filter = FILTERS.find((f) => f.value === sp.status)?.value ?? "submitted";
  const supabase = await createClient();
  const { data: rows, error } = await supabase.rpc("admin_list_payment_requests", {
    p_status: filter === "all" ? undefined : filter,
    p_limit: 200,
  });

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl">Төлбөр</h1>
      <nav aria-label="Төлөв" className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.value}
            href={`/admin/payments?status=${f.value}`}
            aria-current={filter === f.value ? "page" : undefined}
            className={cx(
              "inline-flex min-h-11 items-center rounded-sm border px-3 text-sm",
              filter === f.value ? "border-accent text-accent" : "border-line hover:border-field",
            )}
          >
            {f.label}
          </Link>
        ))}
      </nav>
      {error ? <p className="text-accent">Ачаалж чадсангүй.</p> : null}
      {(rows ?? []).length === 0 ? (
        <p className="text-muted">Хүсэлт алга.</p>
      ) : (
        <ul className="divide-y divide-line border-y border-line">
          {rows!.map((r) => {
            const status = r.status as PaymentStatus;
            return (
              <li key={r.id} className="space-y-3 py-4">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <span className="font-mono font-semibold">{r.ref_code}</span>
                  <span className="tabular-nums">{formatMnt(r.amount_mnt)}</span>
                </div>
                <p className="text-sm text-muted">
                  {r.user_email} · {r.product_title}
                  <br />
                  Үүссэн {formatDateTime(r.created_at)}
                  {r.submitted_at ? ` · Илгээсэн ${formatDateTime(r.submitted_at)}` : ""}
                  {r.decided_at ? ` · Шийдсэн ${formatDateTime(r.decided_at)}${r.decided_by_telegram_id ? " (Telegram)" : r.decided_by_user_id ? " (сайт)" : ""}` : ""}
                </p>
                <p className={cx("text-sm", status === "approved" ? "text-ok" : isOpenStatus(status) ? "text-accent" : "text-muted")}>
                  {PAYMENT_STATUS_TEXT[status]}
                  {r.reject_reason ? ` — ${r.reject_reason}` : ""}
                </p>
                {status === "submitted" ? <DecideForm id={r.id} /> : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
