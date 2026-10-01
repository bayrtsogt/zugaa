"use client";
import { useState } from "react";
import { Icon } from "@zugaa/ui";

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Older Android WebViews: fall back to a temporary textarea.
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  }
}

export function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        if (await copyText(value)) {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }
      }}
      className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-1.5 rounded-sm border border-line px-3 text-sm text-ink hover:border-field"
      aria-label={`${label} хуулах`}
    >
      {copied ? <Icon.Check className="h-4 w-4 text-ok" /> : <Icon.Copy className="h-4 w-4" />}
      <span aria-live="polite">{copied ? "Хуулсан" : "Хуулах"}</span>
    </button>
  );
}
