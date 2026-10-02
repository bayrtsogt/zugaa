import Link from "next/link";
import { Icon } from "@zugaa/ui";
import { BottomNav, HeaderNav } from "@/components/site-nav";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:bg-paper focus:px-3 focus:py-2">
        Үндсэн агуулга руу шилжих
      </a>
      <header>
        <div className="mx-auto flex h-16 max-w-page items-center justify-between gap-4 px-5">
          <Link href="/" className="flex min-h-11 items-center font-display text-xl font-semibold tracking-tight">
            Зугаа
          </Link>
          <div className="flex items-center gap-2">
            <HeaderNav />
            <Link href="/library?focus=search" aria-label="Хайх" className="flex min-h-11 min-w-11 items-center justify-center text-ink">
              <Icon.Search className="h-6 w-6" />
            </Link>
          </div>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-page px-5 pb-28 pt-2 md:pb-16">
        {children}
      </main>
      <BottomNav />
    </>
  );
}
