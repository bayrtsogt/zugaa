import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Button, Notice, Rule, WelcomeDoodles } from "@zugaa/ui";
import { safeNextPath } from "@zugaa/auth";
import { getUser } from "@/lib/auth";
import { LoginForm } from "./login-form";
import { signInWithGoogle } from "./actions";

export const metadata: Metadata = { title: "Нэвтрэх", robots: { index: false } };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const next = safeNextPath(sp.next);
  if (await getUser()) redirect(next);

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
      {sp.error ? <Notice tone="accent">Нэвтэрч чадсангүй. Дахин оролдоно уу.</Notice> : null}
      <LoginForm next={next} />
      <div className="flex items-center gap-3 text-sm text-muted">
        <Rule className="flex-1" />
        эсвэл
        <Rule className="flex-1" />
      </div>
      <form action={signInWithGoogle}>
        <input type="hidden" name="next" value={next} />
        <Button type="submit" variant="secondary" className="w-full">
          Google-ээр нэвтрэх
        </Button>
      </form>
    </div>
  );
}
