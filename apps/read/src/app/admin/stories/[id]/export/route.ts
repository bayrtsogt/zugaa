import { createClient } from "@/lib/supabase/server";
import { assertAdmin } from "@/lib/auth";

/** Import-ready JSON of one story (admin only), for editing and re-importing. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await assertAdmin();
  } catch {
    return new Response("Forbidden", { status: 403 });
  }
  const { id } = await params;
  const supabase = await createClient();
  const { data: story } = await supabase.from("stories").select("slug").eq("id", id).maybeSingle();
  if (!story) return new Response("Not found", { status: 404 });
  const { data, error } = await supabase.rpc("admin_export_story", { p_slug: story.slug });
  if (error || !data) return new Response(error?.message ?? "Not found", { status: error ? 500 : 404 });
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="${story.slug}.json"`,
      "cache-control": "private, no-store",
    },
  });
}
