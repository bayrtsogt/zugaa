import { NextResponse, type NextRequest } from "next/server";
import { safeNextPath } from "@zugaa/auth";
import { createClient } from "@/lib/supabase/server";
import { appUrl } from "@/lib/env";

/** OAuth (Google) PKCE callback. */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = safeNextPath(request.nextUrl.searchParams.get("next"));
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${appUrl()}${next}`);
  }
  return NextResponse.redirect(`${appUrl()}/login?error=oauth&next=${encodeURIComponent(next)}`);
}
