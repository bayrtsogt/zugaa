import "server-only";
import { headers } from "next/headers";
import { createServiceClient } from "@/lib/supabase/server";

/** Fixed-window limiter backed by Postgres (shared by all Worker isolates). */
export async function allow(key: string, max: number, windowSeconds: number): Promise<boolean> {
  const { data, error } = await createServiceClient().rpc("check_rate_limit", {
    p_key: key,
    p_max: max,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    console.error("rate limit check failed", error.message);
    return true; // fail open on infrastructure errors; DB functions still enforce their own limits
  }
  return data === true;
}

export async function clientIp(): Promise<string> {
  const h = await headers();
  return (
    h.get("cf-connecting-ip") ??
    h.get("x-real-ip") ??
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}
