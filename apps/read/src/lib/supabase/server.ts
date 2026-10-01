import "server-only";
import { cookies } from "next/headers";
import { createServerSupabase, createServiceSupabase, type ZugaaClient } from "@zugaa/auth";
import { supabasePublicConfig } from "@/lib/env";
import { serverEnv } from "@/lib/server-env";

/** Per-request client acting as the signed-in user (RLS applies). */
export async function createClient(): Promise<ZugaaClient> {
  const store = await cookies();
  return createServerSupabase(supabasePublicConfig(), {
    getAll: () => store.getAll(),
    setAll: (list) => list.forEach(({ name, value, options }) => store.set(name, value, options)),
  });
}

/** Service-role client. Bypasses RLS — webhook and notification code only. */
export function createServiceClient(): ZugaaClient {
  return createServiceSupabase(supabasePublicConfig().url, serverEnv.serviceRoleKey());
}
