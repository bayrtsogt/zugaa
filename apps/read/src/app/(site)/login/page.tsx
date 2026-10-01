import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Button, Notice, Rule } from "@zugaa/ui";
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
    <div className="mx-auto max-w-sm space-y-6 pt-4">
      <div className="space-y-2">
        <h1 className="font-serif text-2xl">Нэвтрэх</h1>
        <p className="text-muted">
          Үнэгүй бүлгүүдийг нэвтрэлгүй уншиж болно. Бүлэг нээх, эрх авах, уншсан газраа хадгалахын тулд нэвтэрнэ үү.
        </p>
      </div>
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
