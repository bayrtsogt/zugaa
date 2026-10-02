"use client";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { Notice, buttonClass } from "@zugaa/ui";
import { formatMnt } from "@zugaa/wallet";
import { browserClient } from "@/lib/supabase/browser";
import { getPaymentStatus, submitPayment } from "@/app/actions/payments";
import { CopyButton } from "@/components/copy-button";

type Status = "created" | "submitted" | "approved" | "rejected" | "expired";

type Props = {
  id: string;
  refCode: string;
  amountMnt: number;
  productTitle: string;
  productKind: string;
  initialStatus: Status;
  initialReason: string | null;
  bank: { name: string; accountNumber: string; accountHolder: string };
  next: string;
};

const POLL_MS = 10_000;

export function PaymentScreen(p: Props) {
  const [status, setStatus] = useState<Status>(p.initialStatus);
  const [reason, setReason] = useState(p.initialReason);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  // Live status: Realtime first, polling every 10 s as a fallback.
  useEffect(() => {
    if (status !== "submitted") return;
    let stopped = false;
    const apply = (s: string | undefined, r: string | null | undefined) => {
      if (!s || stopped) return;
      setStatus(s as Status);
      if (r !== undefined) setReason(r);
    };

    const sb = browserClient();
    const channel = sb.channel(`payment:${p.id}`);
    sb.auth.getSession().then(({ data }) => {
      if (stopped) return;
      if (data.session) sb.realtime.setAuth(data.session.access_token);
      channel
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "payment_requests", filter: `id=eq.${p.id}` },
          (payload) => {
            const row = payload.new as { status?: string; reject_reason?: string | null };
            apply(row.status, row.reject_reason);
          },
        )
        .subscribe((state) => {
          // Catch up on anything decided before the channel joined.
          if (state === "SUBSCRIBED") {
            void getPaymentStatus(p.id).then((row) => apply(row?.status, row?.reject_reason)).catch(() => {});
          }
        });
    });

    const timer = setInterval(async () => {
      const row = await getPaymentStatus(p.id).catch(() => null);
      apply(row?.status, row?.reject_reason);
    }, POLL_MS);

    return () => {
      stopped = true;
      clearInterval(timer);
      void sb.removeChannel(channel);
    };
  }, [status, p.id]);

  if (status === "approved") {
    return (
      <div className="space-y-5" role="status">
        <h1 className="font-display text-2xl">Эрх нээгдлээ</h1>
        <p className="text-muted">
          {p.productTitle} баталгаажлаа.{" "}
          {p.productKind === "coin_pack" ? "Coin таны хэтэвчинд орлоо." : p.productKind === "subscription" ? "Бүх бүлэг нээлттэй." : "Өгүүллэг бүтнээрээ нээгдлээ."}
        </p>
        <Link href={p.next || "/"} className={buttonClass("primary", "md", "w-full sm:w-auto")}>
          {p.next ? "Үргэлжлүүлэн унших" : "Нүүр хуудас"}
        </Link>
      </div>
    );
  }

  if (status === "rejected") {
    return (
      <div className="space-y-5" role="status">
        <h1 className="font-display text-2xl">Төлбөр баталгаажсангүй</h1>
        <p className="text-muted">
          {p.refCode} кодтой гүйлгээ олдсонгүй эсвэл дүн таарсангүй.
          {reason ? (
            <>
              <br />
              Шалтгаан: {reason}
            </>
          ) : null}
        </p>
        <p className="text-sm text-muted">Мөнгө шилжүүлсэн бол гүйлгээний баримтаа хадгалаад бидэнтэй холбогдоно уу.</p>
        <Link href={`/shop${p.next ? `?next=${encodeURIComponent(p.next)}` : ""}`} className={buttonClass("secondary", "md")}>
          Дахин оролдох
        </Link>
      </div>
    );
  }

  if (status === "expired") {
    return (
      <div className="space-y-5">
        <h1 className="font-display text-2xl">Хугацаа дууссан</h1>
        <p className="text-muted">Энэ төлбөрийн хүсэлт 24 цагийн дотор баталгаажаагүй тул хүчингүй боллоо.</p>
        <Link href="/shop" className={buttonClass("secondary", "md")}>
          Шинээр авах
        </Link>
      </div>
    );
  }

  if (status === "submitted") {
    return (
      <div className="space-y-5" role="status" aria-live="polite">
        <h1 className="font-display text-2xl">Шалгаж байна</h1>
        <p>
          {p.refCode} · {formatMnt(p.amountMnt)}
        </p>
        <p className="text-muted">
          Гүйлгээг шалгаж байна. Ихэвчлэн хэдэн минут болно. Баталгаажмагц энэ хуудас өөрөө шинэчлэгдэнэ — хааж орхисон ч эрх
          тань нээгдэнэ.
        </p>
        <p className="flex items-center gap-2 text-sm text-muted">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
          Хүлээж байна
        </p>
        <Link href={p.next || "/me"} className={buttonClass("quiet", "sm")}>
          {p.next ? "Уншиж байсан газар руу буцах" : "Миний хуудас"}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="font-display text-2xl">Төлбөр</h1>
        <p className="text-muted">{p.productTitle}</p>
      </div>

      <dl className="divide-y divide-line border-y border-line">
        <Row label="Дүн" value={formatMnt(p.amountMnt)} copy={String(p.amountMnt)} strong />
        <Row label="Банк" value={p.bank.name} />
        <Row label="Дансны дугаар" value={p.bank.accountNumber} copy={p.bank.accountNumber.replace(/\s/g, "")} mono />
        <Row label="Хүлээн авагч" value={p.bank.accountHolder} />
        <Row label="Гүйлгээний утга" value={p.refCode} copy={p.refCode} mono strong />
      </dl>

      <p className="text-base">
        Гүйлгээний утга дээр <strong className="font-mono font-semibold text-accent">{p.refCode}</strong> гэж бичнэ үү.
      </p>
      <p className="text-sm text-muted">
        Яг {formatMnt(p.amountMnt)} шилжүүлнэ үү. Утгагүй эсвэл дүн зөрүүтэй гүйлгээг баталгаажуулах боломжгүй. Хүсэлт 24
        цагийн дотор хүчинтэй.
      </p>

      {error ? <Notice tone="accent">{error}</Notice> : null}

      <button
        type="button"
        disabled={pending}
        className={buttonClass("primary", "md", "w-full")}
        onClick={() =>
          start(async () => {
            setError(null);
            const res = await submitPayment(p.id);
            if (res.error) setError(res.error);
            else if (res.status) setStatus(res.status as Status);
          })
        }
      >
        {pending ? "Илгээж байна…" : "Гүйлгээ хийсэн"}
      </button>
    </div>
  );
}

function Row({ label, value, copy, mono, strong }: { label: string; value: string; copy?: string; mono?: boolean; strong?: boolean }) {
  return (
    <div className="flex min-h-16 items-center justify-between gap-3 py-2">
      <div className="min-w-0">
        <dt className="text-sm text-muted">{label}</dt>
        <dd className={`${mono ? "font-mono" : ""} ${strong ? "text-lg font-semibold" : ""} break-all`}>{value || "—"}</dd>
      </div>
      {copy && value ? <CopyButton value={copy} label={label} /> : null}
    </div>
  );
}
