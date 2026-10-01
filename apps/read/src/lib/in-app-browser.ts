import "server-only";
import { headers } from "next/headers";

/**
 * Facebook / Instagram / Messenger in-app browsers. Google blocks OAuth in
 * embedded webviews ("disallowed_useragent"), so the login page steers these
 * visitors to Facebook login or the email code instead.
 */
export async function isMetaInAppBrowser(): Promise<boolean> {
  const ua = (await headers()).get("user-agent") ?? "";
  return /FBAN|FBAV|FB_IAB|FBIOS|Instagram|Messenger/i.test(ua);
}
