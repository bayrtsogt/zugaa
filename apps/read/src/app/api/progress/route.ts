import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Debounced reading-progress save from the reader (also sent on page hide). */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { chapterId?: unknown; pct?: unknown } | null;
  const chapterId = typeof body?.chapterId === "string" ? body.chapterId : "";
  const pct = typeof body?.pct === "number" && Number.isFinite(body.pct) ? body.pct : NaN;
  if (!UUID_RE.test(chapterId) || Number.isNaN(pct)) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("save_reading_progress", {
    p_chapter_id: chapterId,
    p_scroll_pct: Math.min(100, Math.max(0, pct)),
  });
  if (error) {
    const status = error.message === "not_authenticated" ? 401 : 400;
    return NextResponse.json({ error: error.message }, { status });
  }
  return new NextResponse(null, { status: 204 });
}
