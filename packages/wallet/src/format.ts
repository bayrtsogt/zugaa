/** 1 coin = 10₮. Mirrors private.coin_value_mnt() in SQL. */
export const COIN_VALUE_MNT = 10;

const groupFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

/** 20000 -> "20,000₮" */
export function formatMnt(amount: number): string {
  return `${groupFmt.format(Math.round(amount))}₮`;
}

/** 1200 -> "1,200 coin" */
export function formatCoins(coins: number): string {
  return `${groupFmt.format(Math.round(coins))} coin`;
}

const TZ = "Asia/Ulaanbaatar";

function parts(date: Date) {
  const p = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  return { y: get("year"), m: get("month"), d: get("day"), h: get("hour") === "24" ? "00" : get("hour"), min: get("minute") };
}

/** "2026-10-01 15:30" in Ulaanbaatar time. */
export function formatDateTime(input: string | Date): string {
  const { y, m, d, h, min } = parts(new Date(input));
  return `${y}-${m}-${d} ${h}:${min}`;
}

/** "2026-10-01" in Ulaanbaatar time. */
export function formatDate(input: string | Date): string {
  const { y, m, d } = parts(new Date(input));
  return `${y}-${m}-${d}`;
}

/** Countdown text: "13 цаг 20 мин", "45 мин", "1 өдөр 2 цаг". */
export function formatDuration(ms: number): string {
  const totalMin = Math.max(0, Math.ceil(ms / 60_000));
  const days = Math.floor(totalMin / 1440);
  const hours = Math.floor((totalMin % 1440) / 60);
  const mins = totalMin % 60;
  if (days > 0) return hours > 0 ? `${days} өдөр ${hours} цаг` : `${days} өдөр`;
  if (hours > 0) return mins > 0 ? `${hours} цаг ${mins} мин` : `${hours} цаг`;
  return `${mins} мин`;
}

/** Relative "x өдрийн өмнө" for lists. */
export function formatRelative(input: string | Date, now = new Date()): string {
  const diff = now.getTime() - new Date(input).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "дөнгөж сая";
  if (min < 60) return `${min} минутын өмнө`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} цагийн өмнө`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} өдрийн өмнө`;
  return formatDate(input);
}
