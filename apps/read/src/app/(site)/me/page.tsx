import type { Metadata } from "next";
import Link from "next/link";
import { SectionTitle, buttonClass } from "@zugaa/ui";
import type { PaymentStatus } from "@zugaa/db";
import { PAYMENT_STATUS_TEXT, formatCoins, formatDate, formatDateTime, formatMnt, getWalletSummary, isOpenStatus, nudgeText } from "@zugaa/wallet";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile, requireUser } from "@/lib/auth";
import { getContinueReading } from "@/lib/content";
import { signOut } from "@/app/actions/account";
import { DisplayNameForm } from "@/components/profile-forms";
import { BirthYearForm } from "@/components/reader/action-forms";
import { ReaderSettingsButton } from "@/components/reader-settings-button";

export const metadata: Metadata = { title: "Миний", robots: { index: false } };

export default async function MePage() {
  const user = await requireUser("/me");
  const supabase = await createClient();
  const [profile, wallet, payments, history] = await Promise.all([
    getMyProfile(),
    getWalletSummary(supabase),
    supabase
      .from("payment_requests")
      .select("id, ref_code, amount_mnt, status, created_at, reject_reason, products(title)")
      .order("created_at", { ascending: false })
      .limit(20),
    getContinueReading(user.id, 10),
  ]);
  const nudge = wallet ? nudgeText(wallet) : null;
  const rows = payments.data ?? [];

  return (
    <div className="space-y-10">
      <header className="space-y-1">
        <h1 className="font-serif text-2xl">{profile?.display_name || "Миний"}</h1>
        <p className="text-sm text-muted">{user.email}</p>
      </header>

      <section aria-labelledby="wallet" className="space-y-4">
        <SectionTitle>
          <span id="wallet">Хэтэвч</span>
        </SectionTitle>
        <dl className="grid grid-cols-2 gap-4 border-y border-line py-4">
          <div>
            <dt className="text-sm text-muted">Үлдэгдэл</dt>
            <dd className="font-serif text-2xl tabular-nums">{formatCoins(wallet?.balance_coins ?? 0)}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted">Эрх</dt>
            <dd className="text-base">
              {wallet?.subscription_expires_at ? (
                <>
                  Идэвхтэй
                  <span className="block text-sm text-muted">{formatDateTime(wallet.subscription_expires_at)} хүртэл</span>
                </>
              ) : (
                <span className="text-muted">Идэвхтэй эрх алга</span>
              )}
            </dd>
          </div>
        </dl>
        {nudge ? <p className="text-sm text-muted">{nudge}</p> : null}
        <Link href="/shop" className={buttonClass("secondary", "md", "w-full sm:w-auto")}>
          Coin, эрх авах
        </Link>
      </section>

      <section aria-labelledby="payments">
        <SectionTitle>
          <span id="payments">Төлбөрийн түүх</span>
        </SectionTitle>
        {rows.length === 0 ? (
          <p className="text-muted">Төлбөр хийгээгүй байна.</p>
        ) : (
          <ul className="divide-y divide-line border-y border-line">
            {rows.map((r) => {
              const status = r.status as PaymentStatus;
              const body = (
                <>
                  <span className="min-w-0">
                    <span className="block">{r.products?.title ?? "Бүтээгдэхүүн"}</span>
                    <span className="block text-sm text-muted">
                      {r.ref_code} · {formatDate(r.created_at)}
                    </span>
                    {status === "rejected" && r.reject_reason ? (
                      <span className="block text-sm text-muted">Шалтгаан: {r.reject_reason}</span>
                    ) : null}
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block tabular-nums">{formatMnt(r.amount_mnt)}</span>
                    <span className={`block text-sm ${status === "approved" ? "text-ok" : isOpenStatus(status) ? "text-accent" : "text-muted"}`}>
                      {PAYMENT_STATUS_TEXT[status]}
                    </span>
                  </span>
                </>
              );
              return (
                <li key={r.id}>
                  {isOpenStatus(status) ? (
                    <Link href={`/pay/${r.id}`} className="flex min-h-14 justify-between gap-4 py-3 hover:text-accent">
                      {body}
                    </Link>
                  ) : (
                    <div className="flex min-h-14 justify-between gap-4 py-3">{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="history">
        <SectionTitle>
          <span id="history">Уншсан түүх</span>
        </SectionTitle>
        {history.length === 0 ? (
          <p className="text-muted">
            Одоохондоо юу ч уншаагүй байна.{" "}
            <Link href="/library" className="text-accent underline-offset-4 hover:underline">
              Номын сан
            </Link>
          </p>
        ) : (
          <ul className="divide-y divide-line border-y border-line">
            {history.map((h) => (
              <li key={h.story.slug}>
                <Link href={`/s/${h.story.slug}/${h.chapter.number}`} className="flex min-h-14 items-baseline justify-between gap-4 py-3 hover:text-accent">
                  <span className="min-w-0">
                    <span className="block truncate font-serif">{h.story.title}</span>
                    <span className="block truncate text-sm text-muted">
                      Бүлэг {h.chapter.number} · {h.chapter.title}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm tabular-nums text-muted">{Math.round(h.scroll_pct)}%</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="settings" className="space-y-6">
        <SectionTitle>
          <span id="settings">Тохиргоо</span>
        </SectionTitle>
        <DisplayNameForm value={profile?.display_name ?? ""} />
        {profile?.birth_year ? (
          <p className="text-sm text-muted">Төрсөн он: {profile.birth_year}</p>
        ) : (
          <div className="space-y-1">
            <p className="text-sm text-muted">18+ өгүүллэг уншихад төрсөн он хэрэгтэй.</p>
            <BirthYearForm next="" submitLabel="Хадгалах" />
          </div>
        )}
        <ReaderSettingsButton />
      </section>

      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-6">
        {profile?.is_admin ? (
          <Link href="/admin" className={buttonClass("secondary", "sm")}>
            Админ
          </Link>
        ) : null}
        <form action={signOut}>
          <button type="submit" className={buttonClass("quiet", "sm")}>
            Гарах
          </button>
        </form>
      </div>
    </div>
  );
}
