"use client";
import { getBrowserSupabase } from "@zugaa/auth";
import { publicEnv } from "@/lib/env";

export function browserClient() {
  return getBrowserSupabase({ url: publicEnv.supabaseUrl, anonKey: publicEnv.supabaseAnonKey });
}
