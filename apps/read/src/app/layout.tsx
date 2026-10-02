import type { Metadata, Viewport } from "next";
import { appUrl } from "@/lib/env";
import { adventPro, openSans } from "./fonts";
import { READER_PREFS_SCRIPT } from "@/components/reader-prefs";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl()),
  title: { default: "Зугаа — Унших", template: "%s · Зугаа" },
  description: "Монгол хэл дээрх аймшиг, нууцлаг, триллер өгүүллэгүүд. Бүлэг бүлгээр уншина.",
  applicationName: "Зугаа",
  openGraph: { siteName: "Зугаа", locale: "mn_MN", type: "website" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8f5ef" },
    { media: "(prefers-color-scheme: dark)", color: "#151311" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="mn" className={`${adventPro.variable} ${openSans.variable}`} suppressHydrationWarning>
      <head>
        {/* Applies stored theme / text size before first paint: no flash, no layout shift. */}
        <script dangerouslySetInnerHTML={{ __html: READER_PREFS_SCRIPT }} />
      </head>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
