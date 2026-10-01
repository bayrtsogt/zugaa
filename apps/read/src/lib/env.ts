/**
 * Environment access. Public values are inlined at build time; server values
 * are read at request time (Cloudflare Worker vars/secrets via OpenNext).
 */
export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
};

export function supabasePublicConfig() {
  if (!publicEnv.supabaseUrl || !publicEnv.supabaseAnonKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are not set");
  }
  return { url: publicEnv.supabaseUrl, anonKey: publicEnv.supabaseAnonKey };
}

export function appUrl(): string {
  let url = (process.env.APP_URL || "http://localhost:3000").trim().replace(/\/+$/, "");
  // Tolerate "zugaa-read.example.workers.dev" without a scheme.
  if (!/^https?:\/\//.test(url)) url = `https://${url}`;
  return url;
}
