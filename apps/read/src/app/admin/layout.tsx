import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: { default: "Админ", template: "%s · Админ" }, robots: { index: false } };

const LINKS = [
  { href: "/admin/payments", label: "Төлбөр" },
  { href: "/admin/stories", label: "Өгүүллэг" },
  { href: "/admin/import", label: "JSON оруулах" },
  { href: "/admin/users", label: "Хэрэглэгч" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <>
      <header className="border-b border-line">
        <div className="mx-auto flex min-h-14 max-w-wide flex-wrap items-center gap-x-4 px-4">
          <Link href="/admin" className="flex min-h-11 items-baseline gap-2">
            <span className="font-serif text-lg">Зугаа</span>
            <span className="text-sm text-muted">Админ</span>
          </Link>
          <nav aria-label="Админ цэс" className="flex flex-1 items-center gap-1 overflow-x-auto">
            {LINKS.map((l) => (
              <Link key={l.href} href={l.href} className="inline-flex min-h-11 items-center px-2 text-sm text-muted hover:text-ink">
                {l.label}
              </Link>
            ))}
          </nav>
          <Link href="/" className="inline-flex min-h-11 items-center text-sm text-accent">
            Сайт руу
          </Link>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-wide px-4 pb-16 pt-6">
        {children}
      </main>
    </>
  );
}
