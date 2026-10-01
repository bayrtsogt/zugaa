"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDuration } from "@zugaa/wallet";
import { startWaitFreeAction } from "@/app/actions/unlock";

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

/**
 * Rendered when no timer runs yet. Starting it from an effect (not during
 * render) means only a real view starts the clock, never a link prefetch.
 */
export function StartWaitFree({ chapterId, hours }: { chapterId: string; hours: number }) {
  const router = useRouter();
  const [endsAt, setEndsAt] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    startWaitFreeAction(chapterId).then((at) => {
      if (!cancelled && at) {
        setEndsAt(at);
        router.refresh();
      }
    });
    return () => {
      cancelled = true;
    };
  }, [chapterId, router]);
  if (endsAt) return <WaitFreeCountdown endsAt={endsAt} initialText={formatDuration(new Date(endsAt).getTime() - Date.now())} />;
  return (
    <p className="text-base">
      Үнэгүй нээгдэх хүртэл: <span className="font-medium tabular-nums">{hours} цаг</span>
    </p>
  );
}
