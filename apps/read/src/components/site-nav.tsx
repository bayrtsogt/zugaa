"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, cx } from "@zugaa/ui";

const ITEMS = [
  { href: "/", label: "Нүүр", icon: Icon.Home, match: (p: string) => p === "/" },
  { href: "/library", label: "Номын сан", icon: Icon.Books, match: (p: string) => p.startsWith("/library") || p.startsWith("/s/") },
  { href: "/library?focus=search", label: "Хайх", icon: Icon.Search, match: () => false },
  { href: "/me", label: "Миний", icon: Icon.User, match: (p: string) => p.startsWith("/me") || p.startsWith("/shop") || p.startsWith("/pay") },
];

/** Mobile: icon-only bottom bar (labels for screen readers). Desktop: text links in the header. */
export function BottomNav() {
  const path = usePathname();
  return (
    <nav aria-label="Үндсэн цэс" className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper pb-[env(safe-area-inset-bottom)] md:hidden">
      <ul className="mx-auto grid max-w-page grid-cols-4">
        {ITEMS.map(({ href, label, icon: I, match }) => {
          const active = match(path);
          return (
            <li key={label}>
              <Link
                href={href}
                aria-label={label}
                aria-current={active ? "page" : undefined}
                className={cx("flex min-h-14 flex-col items-center justify-center gap-1", active ? "text-ink" : "text-muted")}
              >
                <I className="h-6 w-6" />
                <span aria-hidden className={cx("h-1 w-1 rounded-full", active ? "bg-ink" : "bg-transparent")} />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function HeaderNav() {
  const path = usePathname();
  return (
    <nav aria-label="Үндсэн цэс" className="hidden md:block">
      <ul className="flex items-center gap-1">
        {ITEMS.filter((i) => i.label !== "Хайх").map(({ href, label, match }) => {
          const active = match(path);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cx("inline-flex min-h-11 items-center px-3 text-sm", active ? "text-ink underline underline-offset-8" : "text-muted hover:text-ink")}
              >
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
