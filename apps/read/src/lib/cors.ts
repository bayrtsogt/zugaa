import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { serverEnv } from "@/lib/server-env";

/**
 * CORS for routes other Зугаа apps call from the browser (KinoTube). Only
 * origins listed in CORS_ORIGINS get the header; auth is a bearer token, never
 * cookies, so no credentials are allowed.
 */
export function corsHeaders(request: NextRequest, methods: string): Record<string, string> {
  const origin = request.headers.get("origin") ?? "";
  if (!origin || !serverEnv.corsOrigins().includes(origin)) return { Vary: "Origin" };
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": `${methods}, OPTIONS`,
    "Access-Control-Allow-Headers": "authorization, content-type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

export function preflight(request: NextRequest, methods: string): NextResponse {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request, methods) });
}
