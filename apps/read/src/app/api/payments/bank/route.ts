import { NextResponse, type NextRequest } from "next/server";
import { corsHeaders, preflight } from "@/lib/cors";
import { serverEnv } from "@/lib/server-env";

/** Bank details for the payment screen of other Зугаа apps (KinoTube). */
export function GET(request: NextRequest) {
  return NextResponse.json(serverEnv.bank(), {
    headers: { ...corsHeaders(request, "GET"), "Cache-Control": "public, max-age=300" },
  });
}

export function OPTIONS(request: NextRequest) {
  return preflight(request, "GET");
}
