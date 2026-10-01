/**
 * Shared Supabase auth helpers for every Зугаа app.
 * Framework-agnostic: apps pass in their cookie adapter.
 */
import { createBrowserClient, createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@zugaa/db";

export type ZugaaClient = SupabaseClient<Database>;

export type CookieAdapter = {
  getAll(): Array<{ name: string; value: string }>;
  setAll(cookies: Array<{ name: string; value: string; options: CookieOptions }>): void;
};

export type SupabasePublicConfig = { url: string; anonKey: string };

export function createServerSupabase(config: SupabasePublicConfig, cookies: CookieAdapter): ZugaaClient {
  return createServerClient<Database>(config.url, config.anonKey, {
    cookies: {
      getAll: () => cookies.getAll(),
      setAll: (list) => {
        try {
          cookies.setAll(list);
        } catch {
          // Called from a Server Component: cookies are read-only there. The
          // proxy refreshes the session, so this is safe to ignore.
        }
      },
    },
  });
}

let browserClient: ZugaaClient | undefined;
export function getBrowserSupabase(config: SupabasePublicConfig): ZugaaClient {
  browserClient ??= createBrowserClient<Database>(config.url, config.anonKey);
  return browserClient;
}

/**
 * Service-role client. Bypasses RLS: server code only (webhooks, notifications).
 * Never import from client components.
 */
export function createServiceSupabase(url: string, serviceRoleKey: string): ZugaaClient {
  return createClient<Database>(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export type SessionUser = { id: string; email: string | null };

/** Verified current user (JWT signature checked), or null. */
export async function getSessionUser(client: ZugaaClient): Promise<SessionUser | null> {
  const { data, error } = await client.auth.getClaims();
  if (error || !data?.claims?.sub) return null;
  const claims = data.claims as { sub: string; email?: string };
  return { id: claims.sub, email: claims.email ?? null };
}

export type Profile = {
  id: string;
  display_name: string | null;
  birth_year: number | null;
  is_admin: boolean;
};

export async function getProfile(client: ZugaaClient, userId: string): Promise<Profile | null> {
  const { data } = await client
    .from("profiles")
    .select("id, display_name, birth_year, is_admin")
    .eq("id", userId)
    .maybeSingle();
  return data;
}

/* -------------------------------------------------------------------------- */
/* Age gate (mirrors private.is_adult in SQL; the database is authoritative). */
/* -------------------------------------------------------------------------- */

export const ADULT_AGE = 18;

export function currentYearUlaanbaatar(now = new Date()): number {
  return Number(
    new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Ulaanbaatar", year: "numeric" }).format(now),
  );
}

export function isValidBirthYear(year: number, now = new Date()): boolean {
  const current = currentYearUlaanbaatar(now);
  return Number.isInteger(year) && year >= current - 110 && year <= current;
}

export type AgeGate = "login_required" | "birth_year_required" | "underage";

export const AGE_GATE_TEXT: Record<AgeGate, string> = {
  login_required: "Энэ өгүүллэг 18 наснаас дээш уншигчдад зориулагдсан. Үргэлжлүүлэхийн тулд нэвтэрнэ үү.",
  birth_year_required: "Энэ өгүүллэг 18 наснаас дээш уншигчдад зориулагдсан. Төрсөн оноо нэг удаа оруулна уу.",
  underage: "Энэ өгүүллэг 18 наснаас дээш уншигчдад зориулагдсан тул танд нээгдэхгүй.",
};

/**
 * Sanitises a post-login redirect target to a same-origin path.
 * Prevents open redirects via ?next=https://evil.example.
 */
export function safeNextPath(next: string | null | undefined, fallback = "/"): string {
  if (!next || typeof next !== "string") return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}
