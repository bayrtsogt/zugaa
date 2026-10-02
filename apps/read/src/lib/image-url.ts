import { publicEnv } from "@/lib/env";

/** Accepts https:// images and this project's storage URLs (http locally). */
export function isImageUrl(url: string): boolean {
  if (url.length > 1000) return false;
  if (/^https:\/\/\S+$/.test(url)) return true;
  const storage = `${publicEnv.supabaseUrl}/storage/v1/object/public/`;
  return Boolean(publicEnv.supabaseUrl) && url.startsWith(storage);
}
