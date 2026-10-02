import type { Metadata } from "next";
import { Notice, SectionTitle } from "@zugaa/ui";
import { safeNextPath } from "@zugaa/auth";
import { formatCoins, formatDate, formatMnt, getWalletSummary, listProducts, nudgeText, productSummary } from "@zugaa/wallet";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth";
import { ProductRow } from "@/components/product-row";

export const metadata: Metadata = { title: "Coin, эрх авах", robots: { index: false } };

export default async function ShopPage({ searchParams }: { searchParams: Promise<{ next?: string; need?: string }> }) {
  const sp = await searchParams;
  const next = safeNextPath(sp.next, "");
  const need = Number(sp.need) > 0 ? Number(sp.need) : 0;
  const supabase = await createClient();
  const user = await getUser();
  const [products, wallet] = await Promise.all([
    listProducts(supabase, { app: "read" }),
    user ? getWalletSummary(supabase) : Promise.resolve(null),
  ]);
  const subs = products.filter((p) => p.kind === "subscription");
  const packs = products.filter((p) => p.kind === "coin_pack");
  const nudge = wallet ? nudgeText(wallet) : null;

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="font-display text-2xl">Coin, эрх авах</h1>
        {wallet ? (
          <p className="text-muted">
            Үлдэгдэл: <span className="text-ink">{formatCoins(wallet.balance_coins)}</span>
            {wallet.subscription_expires_at ? ` · Эрх ${formatDate(wallet.subscription_expires_at)} хүртэл` : ""}
          </p>
        ) : null}
      </div>

      {need > 0 ? <Notice>Энэ бүлгийг нээхэд {formatCoins(need)} дутуу байна.</Notice> : null}
      {nudge ? <p className="text-sm text-muted">{nudge}</p> : null}

      {subs.length > 0 ? (
        <section aria-labelledby="subs">
          <SectionTitle>
            <span id="subs">Эрх</span>
          </SectionTitle>
          <div className="divide-y divide-line border-y border-line">
            {subs.map((p) => (
              <ProductRow key={p.id} code={p.code} next={next} title={p.title} detail={p.description ?? productSummary(p)} price={formatMnt(p.price_mnt)} />
            ))}
          </div>
          <p className="mt-2 text-sm text-muted">Эрхтэй үед бүх бүлэг нээлттэй. Идэвхтэй эрх дээр шинэ эрх авбал дуусах хугацаанаас нь сунгана.</p>
        </section>
      ) : null}

      {packs.length > 0 ? (
        <section aria-labelledby="packs">
          <SectionTitle>
            <span id="packs">Coin</span>
          </SectionTitle>
          <div className="divide-y divide-line border-y border-line">
            {packs.map((p) => (
              <ProductRow key={p.id} code={p.code} next={next} title={p.title} detail={p.description ?? "Бүлэг тус бүрээр нээнэ"} price={formatMnt(p.price_mnt)} />
            ))}
          </div>
        </section>
      ) : null}

      <p className="text-sm text-muted">
        Төлбөрийг банкны шилжүүлгээр хийнэ. Шилжүүлгийг шалгаж баталгаажуулмагц эрх автоматаар нээгдэнэ.
      </p>
    </div>
  );
}
