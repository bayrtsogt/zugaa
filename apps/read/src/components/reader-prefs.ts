/**
 * Reader preferences (theme, text size, line spacing), stored in localStorage.
 * Applied as data-attributes on <html>; the CSS tokens do the rest.
 */
export type Theme = "light" | "sepia" | "dark";
export type ReaderPrefs = { theme: Theme | null; fs: 1 | 2 | 3 | 4; lh: 1 | 2 | 3 };

export const PREFS_KEY = "zugaa:reader";
export const DEFAULT_PREFS: ReaderPrefs = { theme: null, fs: 2, lh: 2 };

export const THEMES: Array<{ value: Theme; label: string; swatch: string; ink: string }> = [
  { value: "light", label: "Цайвар", swatch: "#f8f5ef", ink: "#1d1a16" },
  { value: "sepia", label: "Шаргал", swatch: "#f2e8d4", ink: "#2a2117" },
  { value: "dark", label: "Харанхуй", swatch: "#151311", ink: "#e9e3d8" },
];

/** Inline in <head>; must stay dependency-free and tiny. */
export const READER_PREFS_SCRIPT = `(function(){try{var p=JSON.parse(localStorage.getItem(${JSON.stringify(
  PREFS_KEY,
)})||"{}");var d=document.documentElement;if(p.theme==="light"||p.theme==="sepia"||p.theme==="dark")d.dataset.theme=p.theme;if(p.fs>=1&&p.fs<=4)d.dataset.fs=String(p.fs);if(p.lh>=1&&p.lh<=3)d.dataset.lh=String(p.lh);}catch(e){}})();`;

export function readPrefs(): ReaderPrefs {
  try {
    const raw = JSON.parse(localStorage.getItem(PREFS_KEY) ?? "{}") as Partial<ReaderPrefs>;
    return {
      theme: raw.theme === "light" || raw.theme === "sepia" || raw.theme === "dark" ? raw.theme : null,
      fs: raw.fs && raw.fs >= 1 && raw.fs <= 4 ? raw.fs : DEFAULT_PREFS.fs,
      lh: raw.lh && raw.lh >= 1 && raw.lh <= 3 ? raw.lh : DEFAULT_PREFS.lh,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function applyPrefs(p: ReaderPrefs) {
  const d = document.documentElement;
  if (p.theme) d.dataset.theme = p.theme;
  else delete d.dataset.theme;
  d.dataset.fs = String(p.fs);
  d.dataset.lh = String(p.lh);
  const meta = document.querySelector('meta[name="theme-color"]:not([media])') as HTMLMetaElement | null;
  if (meta) meta.content = getComputedStyle(d).getPropertyValue("--zg-paper").trim();
}

export function savePrefs(p: ReaderPrefs) {
  applyPrefs(p);
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(p));
  } catch {
    // Private mode / storage blocked: settings still apply for this page.
  }
}
