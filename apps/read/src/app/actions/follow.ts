"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { safeNextPath } from "@zugaa/auth";
import { createClient } from "@/lib/supabase/server";
import { getUser, loginHref } from "@/lib/auth";
import { botUsername } from "@/lib/notify";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Follow / unfollow a story (form: story_id, follow=1|0, path). */
export async function setFollow(form: FormData) {
  const path = safeNextPath(String(form.get("path") ?? ""), "/");
  const user = await getUser();
  if (!user) redirect(loginHref(path));
  const storyId = String(form.get("story_id") ?? "");
  if (!UUID_RE.test(storyId)) return;
  const supabase = await createClient();
  if (form.get("follow") === "1") {
    await supabase.from("follows").upsert({ user_id: user.id, story_id: storyId }, { onConflict: "user_id,story_id", ignoreDuplicates: true });
  } else {
    await supabase.from("follows").delete().eq("user_id", user.id).eq("story_id", storyId);
  }
  revalidatePath(path);
  revalidatePath("/me");
}

/** Opens the bot with a one-time token; the bot's /start links this account. */
export async function linkTelegram() {
  const user = await getUser();
  if (!user) redirect(loginHref("/me"));
  const supabase = await createClient();
  const [{ data: token, error }, bot] = await Promise.all([supabase.rpc("create_telegram_link_token"), botUsername()]);
  if (error || !token || !bot) redirect("/me?tg=error");
  redirect(`https://t.me/${bot}?start=${token}`);
}

export async function unlinkTelegram() {
  const user = await getUser();
  if (!user) redirect(loginHref("/me"));
  const supabase = await createClient();
  await supabase.from("telegram_links").delete().eq("user_id", user.id);
  revalidatePath("/me");
}
