"use client";
import { useState } from "react";
import { buttonClass } from "@zugaa/ui";
import { SettingsSheet } from "@/components/reader/settings-sheet";

export function ReaderSettingsButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={buttonClass("secondary", "sm")} onClick={() => setOpen(true)} aria-haspopup="dialog">
        Унших тохиргоо
      </button>
      <SettingsSheet open={open} onClose={() => setOpen(false)} />
    </>
  );
}
