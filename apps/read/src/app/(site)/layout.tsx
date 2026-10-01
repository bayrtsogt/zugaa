import Link from "next/link";
import { BottomNav, HeaderNav } from "@/components/site-nav";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:bg-paper focus:px-3 focus:py-2">
        Үндсэн агуулга руу шилжих
      </a>
      <header className="border-b border-line">
        <div className="mx-auto flex h-14 max-w-page items-center justify-between px-4">
          <Link href="/" className="flex min-h-11 items-baseline gap-2">
            <span className="font-serif text-xl tracking-tight">Зугаа</span>
            <span className="text-sm text-muted">Унших</span>
          </Link>
          <HeaderNav />
        </div>
      </header>
      <main id="main" className="mx-auto max-w-page px-4 pb-28 pt-6 md:pb-16">
        {children}
      </main>
      <BottomNav />
    </>
  );
}
