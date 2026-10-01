import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Button, Notice, Rule, WelcomeDoodles } from "@zugaa/ui";
import { safeNextPath } from "@zugaa/auth";
import { getUser } from "@/lib/auth";
import { LoginForm } from "./login-form";
import { signInWithProvider } from "./actions";
import { isMetaInAppBrowser } from "@/lib/in-app-browser";

export const metadata: Metadata = { title: "Нэвтрэх", robots: { index: false } };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const next = safeNextPath(sp.next);
  if (await getUser()) redirect(next);
  const inApp = await isMetaInAppBrowser();

  return (
    <div className="mx-auto max-w-sm space-y-6 pt-2">
      {/* Welcome panel: always dark, like a book's endpaper. */}
      <section className="rounded-md bg-[#141414] px-6 pb-7 pt-6 text-[#f4f2ed]">
        <WelcomeDoodles className="mx-auto h-36 w-full max-w-xs text-[#f4f2ed]" />
        <h1 className="mt-4 text-center font-serif text-[1.75rem] leading-tight">Зугаа-д тавтай морил</h1>
        <p className="mt-3 text-center text-sm leading-relaxed text-[#bdb8ae]">
          Үнэгүй бүлгүүдийг нэвтрэлгүй уншиж болно. Бүлэг нээх, эрх авах, уншсан газраа хадгалахын тулд нэвтэрнэ үү.
        </p>
      </section>
      {sp.error ? <Notice tone="accent">{ERROR_TEXT[sp.error] ?? "Нэвтэрч чадсангүй. Дахин оролдоно уу."}</Notice> : null}
      <LoginForm next={next} />
      <div className="flex items-center gap-3 text-sm text-muted">
        <Rule className="flex-1" />
        эсвэл
        <Rule className="flex-1" />
      </div>
      <div className="space-y-3">
        {inApp ? <ProviderButton provider="facebook" next={next} /> : null}
        {inApp ? (
          <p className="text-sm text-muted">
            Google-ээр нэвтрэх нь Facebook-ийн хөтөч дотор ажилладаггүй. Баруун дээд буланд байгаа ⋯ товчоор
            «Хөтчөөр нээх»-ийг сонгоно уу.
          </p>
        ) : (
          <>
            <ProviderButton provider="google" next={next} />
            <ProviderButton provider="facebook" next={next} />
          </>
        )}
      </div>
      <p className="text-center text-xs text-muted">
        Нэвтэрснээр та{" "}
        <Link href="/privacy" className="underline underline-offset-2">
          нууцлалын бодлогыг
        </Link>{" "}
        хүлээн зөвшөөрнө.
      </p>
    </div>
  );
}

const ERROR_TEXT: Record<string, string> = {
  google: "Google-ээр нэвтэрч чадсангүй. Имэйлээр код авч нэвтэрнэ үү.",
  facebook: "Facebook-ээр нэвтэрч чадсангүй. Имэйлээр код авч нэвтэрнэ үү.",
};

function ProviderButton({ provider, next }: { provider: "google" | "facebook"; next: string }) {
  return (
    <form action={signInWithProvider}>
      <input type="hidden" name="provider" value={provider} />
      <input type="hidden" name="next" value={next} />
      <Button type="submit" variant="secondary" className="w-full">
        {provider === "google" ? "Google-ээр нэвтрэх" : "Facebook-ээр нэвтрэх"}
      </Button>
    </form>
  );
}
