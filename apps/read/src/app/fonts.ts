import localFont from "next/font/local";

// Custom subsets (Latin + Cyrillic + Ө ө Ү ү + typographic punctuation), built from
// Google Fonts with `text=` and the weight axis trimmed. Verified glyph coverage; see DECISIONS.md.
export const adventPro = localFont({
  src: [{ path: "../fonts/advent-pro.woff2", weight: "400 800", style: "normal" }],
  variable: "--font-advent",
  display: "swap",
  preload: true,
  fallback: ["Arial Narrow", "system-ui", "sans-serif"],
  adjustFontFallback: "Arial",
});

export const openSans = localFont({
  src: [
    { path: "../fonts/open-sans.woff2", weight: "400 700", style: "normal" },
    { path: "../fonts/open-sans-italic.woff2", weight: "400 700", style: "italic" },
  ],
  variable: "--font-open-sans",
  display: "swap",
  preload: true,
  fallback: ["system-ui", "Segoe UI", "Arial", "sans-serif"],
  adjustFontFallback: "Arial",
});
