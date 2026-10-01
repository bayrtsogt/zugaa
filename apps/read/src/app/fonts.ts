import localFont from "next/font/local";

// Custom subsets (Latin + Cyrillic + Ө ө Ү ү + ₮), built from Google Fonts with
// the optical-size axis pinned. Verified glyph coverage; see DECISIONS.md.
export const literata = localFont({
  src: [
    { path: "../fonts/literata.woff2", weight: "400 700", style: "normal" },
    { path: "../fonts/literata-italic.woff2", weight: "400", style: "italic" },
  ],
  variable: "--font-literata",
  display: "swap",
  preload: true,
  fallback: ["PT Serif", "Georgia", "serif"],
  adjustFontFallback: "Times New Roman",
});

export const inter = localFont({
  src: [{ path: "../fonts/inter.woff2", weight: "400 600", style: "normal" }],
  variable: "--font-inter",
  display: "swap",
  preload: true,
  fallback: ["system-ui", "Segoe UI", "Arial", "sans-serif"],
  adjustFontFallback: "Arial",
});
