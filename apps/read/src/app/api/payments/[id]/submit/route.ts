import { NextResponse, type NextRequest } from "next/server";
import { createTokenSupabase, getSessionUser } from "@zugaa/auth";
import { corsHeaders, preflight } from "@/lib/cors";
import { supabasePublicConfig } from "@/lib/env";
import { submitAndNotify } from "@/lib/payments";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * "Гүйлгээ хийсэн" for apps that keep their own Supabase session (KinoTube):
 * `Authorization: Bearer <access token>`. Same function and Telegram message
 * as this app's payment screen.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const headers = corsHeaders(request, "POST");
  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "Олдсонгүй." }, { status: 404, headers });

  const token = /^Bearer (.+)$/i.exec(request.headers.get("authorization") ?? "")?.[1]?.trim() ?? "";
  const supabase = token ? createTokenSupabase(supabasePublicConfig(), token) : null;
  const user = supabase ? await getSessionUser(supabase, token) : null;
  if (!supabase || !user) return NextResponse.json({ error: "Нэвтэрнэ үү." }, { status: 401, headers });

  const result = await submitAndNotify(supabase, user.id, id);
  return NextResponse.json(result, { status: result.error ? 400 : 200, headers });
}

export function OPTIONS(request: NextRequest) {
  return preflight(request, "POST");
}
