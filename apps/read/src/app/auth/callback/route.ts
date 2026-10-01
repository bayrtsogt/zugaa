import { NextResponse, type NextRequest } from "next/server";
import { safeNextPath } from "@zugaa/auth";
import { createClient } from "@/lib/supabase/server";
import { appUrl } from "@/lib/env";

/** OAuth (Google) PKCE callback. */
export async function GET(request: NextRequest) {
  const next = safeNextPath(request.nextUrl.searchParams.get("next"));
  const code = request.nextUrl.searchParams.get("code");
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");
  if (tokenHash && (type === "email" || type === "magiclink" || type === "signup" || type === "email_change")) {
    // Email link opened in a different browser than the one that asked for it.
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: type === "signup" ? "signup" : type === "email_change" ? "email_change" : "email" });
    if (!error) return NextResponse.redirect(`${appUrl()}${next}`);
  }
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${appUrl()}${next}`);
  }
  return NextResponse.redirect(`${appUrl()}/login?error=oauth&next=${encodeURIComponent(next)}`);
}
