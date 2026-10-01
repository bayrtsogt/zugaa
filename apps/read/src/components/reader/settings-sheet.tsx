"use client";
import { useEffect, useRef, useState } from "react";
import { Icon, cx } from "@zugaa/ui";
import { THEMES, readPrefs, savePrefs, type ReaderPrefs } from "@/components/reader-prefs";

const SIZES: Array<{ value: ReaderPrefs["fs"]; label: string; px: number }> = [
  { value: 1, label: "Жижиг", px: 14 },
  { value: 2, label: "Дунд", px: 17 },
  { value: 3, label: "Том", px: 20 },
  { value: 4, label: "Хамгийн том", px: 23 },
];
const LEADING: Array<{ value: ReaderPrefs["lh"]; label: string }> = [
  { value: 1, label: "Нягт" },
  { value: 2, label: "Дунд" },
  { value: 3, label: "Сул" },
];

const optionClass = (active: boolean) =>
  cx(
    "flex min-h-12 flex-1 items-center justify-center rounded-sm border text-sm",
    active ? "border-accent text-accent" : "border-line text-ink hover:border-field",
  );

export function SettingsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [prefs, setPrefs] = useState<ReaderPrefs | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  const opener = useRef<Element | null>(null);

  useEffect(() => {
    if (!open) return;
    setPrefs(readPrefs());
    opener.current = document.activeElement;
    panel.current?.querySelector<HTMLElement>("button")?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      (opener.current as HTMLElement | null)?.focus?.();
    };
  }, [open, onClose]);

  const update = (patch: Partial<ReaderPrefs>) => {
    const next = { ...(prefs ?? readPrefs()), ...patch };
    setPrefs(next);
    savePrefs(next);
  };

  // Effective theme when none stored: follows the system.
  const activeTheme =
    prefs?.theme ??
    (typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");

  return (
    <div className={cx("fixed inset-0 z-50", !open && "pointer-events-none invisible")}
      style={{ transition: "visibility var(--duration-base)" }} aria-hidden={!open}>
      <div
        className={cx("absolute inset-0 bg-black/30 transition-opacity duration-[var(--duration-base)]", open ? "opacity-100" : "opacity-0")}
        onClick={onClose}
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="reader-settings-title"
        className={cx(
          "absolute inset-x-0 bottom-0 mx-auto max-w-page rounded-t-md border-t border-line bg-paper px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-4 shadow-sheet",
          "ease-[var(--ease-out)]",
          open ? "visible translate-y-0" : "invisible translate-y-full",
        )}
        style={{ transition: "transform var(--duration-base), visibility var(--duration-base)" }}
        inert={!open}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id="reader-settings-title" className="text-base font-medium">
            Унших тохиргоо
          </h2>
          <button type="button" onClick={onClose} className="flex min-h-11 min-w-11 items-center justify-center text-muted" aria-label="Хаах">
            <Icon.Close />
          </button>
        </div>

        <fieldset className="mb-5">
          <legend className="mb-2 text-sm text-muted">Үсгийн хэмжээ</legend>
          <div className="flex gap-2">
            {SIZES.map((s) => (
              <button
                key={s.value}
                type="button"
                aria-pressed={prefs?.fs === s.value}
                aria-label={s.label}
                onClick={() => update({ fs: s.value })}
                className={optionClass(prefs?.fs === s.value)}
              >
                <span className="font-serif" style={{ fontSize: s.px }} aria-hidden>
                  Аа
                </span>
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="mb-5">
          <legend className="mb-2 text-sm text-muted">Өнгө</legend>
          <div className="flex gap-2">
            {THEMES.map((t) => (
              <button
                key={t.value}
                type="button"
                aria-pressed={activeTheme === t.value}
                onClick={() => update({ theme: t.value })}
                className={cx(optionClass(activeTheme === t.value), "gap-2")}
              >
                <span className="h-5 w-5 rounded-full border border-line-strong" style={{ background: t.swatch }} aria-hidden />
                {t.label}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-2 text-sm text-muted">Мөр хоорондын зай</legend>
          <div className="flex gap-2">
            {LEADING.map((l) => (
              <button
                key={l.value}
                type="button"
                aria-pressed={prefs?.lh === l.value}
                onClick={() => update({ lh: l.value })}
                className={optionClass(prefs?.lh === l.value)}
              >
                {l.label}
              </button>
            ))}
          </div>
        </fieldset>
      </div>
    </div>
  );
}
