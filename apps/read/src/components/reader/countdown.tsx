"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDuration } from "@zugaa/wallet";

/** "Үнэгүй нээгдэх хүртэл: 13 цаг 20 мин" — refreshes the page when it reaches zero. */
export function WaitFreeCountdown({ endsAt, initialText }: { endsAt: string; initialText: string }) {
  const router = useRouter();
  const [text, setText] = useState(initialText);

  useEffect(() => {
    const end = new Date(endsAt).getTime();
    const tick = () => {
      const left = end - Date.now();
      if (left <= 0) {
        router.refresh();
        return false;
      }
      setText(formatDuration(left));
      return true;
    };
    if (!tick()) return;
    const id = setInterval(() => {
      if (!tick()) clearInterval(id);
    }, 30_000);
    return () => clearInterval(id);
  }, [endsAt, router]);

  return (
    <p className="text-base">
      Үнэгүй нээгдэх хүртэл: <span className="font-medium tabular-nums">{text}</span>
    </p>
  );
}
