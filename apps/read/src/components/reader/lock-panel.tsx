import Link from "next/link";
import { Icon, buttonClass } from "@zugaa/ui";
import {
  formatCoins,
  formatDuration,
  formatMnt,
  getProductByCode,
  getStoryProduct,
  getWalletSummary,
  nudgeText,
} from "@zugaa/wallet";
import { createClient } from "@/lib/supabase/server";
import { loginHref } from "@/lib/auth";
import type { ChapterView } from "@/lib/content";
import { WaitFreeCountdown } from "./countdown";
import { PurchaseForm, UnlockForm } from "./action-forms";

/** Shown under the faded preview of a locked chapter. */
export async function LockPanel({ chapter, signedIn, path }: { chapter: ChapterView; signedIn: boolean; path: string }) {
  if (!signedIn) {
    return (
      <Section>
        <p className="text-muted">Бүлэг нээх, эрх авах, уншсан газраа хадгалахын тулд нэвтэрнэ үү.</p>
        <Link href={loginHref(path)} className={buttonClass("primary", "md", "w-full")}>
          Нэвтрэх
        </Link>
        {chapter.wait_free_hours ? (
          <p className="text-sm text-muted">Нэвтэрсэн уншигчид {chapter.wait_free_hours} цаг хүлээгээд үнэгүй уншиж болно.</p>
        ) : null}
      </Section>
    );
  }

  const supabase = await createClient();
  const [wallet, monthPass, storyProduct] = await Promise.all([
    getWalletSummary(supabase),
    getProductByCode(supabase, "sub_month"),
    getStoryProduct(supabase, chapter.story_id),
  ]);
  const balance = wallet?.balance_coins ?? 0;
  const canChapter = balance >= chapter.price_coins;
  const canStory = chapter.story_price_coins != null && balance >= chapter.story_price_coins;
  const shopHref = `/shop?next=${encodeURIComponent(path)}`;
  const nudge = wallet ? nudgeText(wallet) : null;
  const waitLeft = chapter.wait_free_ends_at ? new Date(chapter.wait_free_ends_at).getTime() - Date.now() : null;

  return (
    <Section>
      {chapter.wait_free_ends_at && waitLeft != null ? (
        <div className="space-y-1">
          <WaitFreeCountdown endsAt={chapter.wait_free_ends_at} initialText={formatDuration(waitLeft)} />
          <p className="text-sm text-muted">Хүлээхгүй бол доорх аргаар одоо нээж болно.</p>
        </div>
      ) : chapter.wait_free_other_chapter ? (
        <p className="text-sm text-muted">
          Үнэгүй хүлээх цаг одоогоор {chapter.wait_free_other_chapter}-р бүлэгт явж байна.
        </p>
      ) : null}

      <div className="space-y-2">
        {canChapter ? (
          <UnlockForm kind="chapter" id={chapter.id} returnTo={path} label={`${formatCoins(chapter.price_coins)}-оор нээх`} />
        ) : (
          <Link href={shopHref} className={buttonClass("primary", "md", "w-full")}>
            Coin авч нээх · {formatCoins(chapter.price_coins)}
          </Link>
        )}
        <p className="text-center text-sm text-muted">Таны үлдэгдэл: {formatCoins(balance)}</p>
      </div>

      {chapter.story_price_coins != null ? (
        canStory ? (
          <UnlockForm
            kind="story"
            id={chapter.story_id}
            returnTo={path}
            variant="secondary"
            label={`Бүтэн өгүүллэг · ${formatCoins(chapter.story_price_coins)}`}
          />
        ) : (
          <Link href={shopHref} className={buttonClass("secondary", "md", "w-full")}>
            Бүтэн өгүүллэг · {formatCoins(chapter.story_price_coins)}
          </Link>
        )
      ) : null}

      {monthPass ? (
        <Link href={shopHref} className={buttonClass("secondary", "md", "w-full")}>
          {monthPass.title} · {formatMnt(monthPass.price_mnt)}
        </Link>
      ) : null}

      {storyProduct ? (
        <PurchaseForm
          product={storyProduct.code}
          next={path}
          variant="quiet"
          label={`Банкаар бүтэн өгүүллэг авах · ${formatMnt(storyProduct.price_mnt)}`}
        />
      ) : null}

      {nudge ? <p className="text-sm text-muted">{nudge}</p> : null}
    </Section>
  );
}

function Section({ children }: { children: React.ReactNode }) {
  return (
    <section aria-labelledby="locked-title" className="mx-auto max-w-sm space-y-5 pb-8">
      <h2 id="locked-title" className="flex items-center justify-center gap-2 text-base font-medium text-accent">
        <Icon.Lock className="h-5 w-5" />
        Энэ бүлэг түгжээтэй
      </h2>
      {children}
    </section>
  );
}
