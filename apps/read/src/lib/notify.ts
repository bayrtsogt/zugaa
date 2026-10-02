import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { appUrl } from "@/lib/env";
import { telegram } from "@/lib/telegram";

let cachedBotUsername: string | null = null;

/** The bot's @username for t.me deep links (Bot API getMe, cached per isolate). */
export async function botUsername(): Promise<string | null> {
  if (cachedBotUsername) return cachedBotUsername;
  const fromEnv = process.env.TELEGRAM_BOT_USERNAME?.replace(/^@/, "").trim();
  if (fromEnv) return (cachedBotUsername = fromEnv);
  const me = await telegram()?.getMe().catch(() => null);
  return (cachedBotUsername = me?.username ?? null);
}

/**
 * Sends «new chapter» Telegram messages to followers of a story who linked
 * Telegram. The database claims each follower once (notified_at), so calling
 * this after every publish is safe.
 */
export async function notifyFollowers(storyId: string): Promise<number> {
  const tg = telegram();
  if (!tg) return 0;
  const db = createServiceClient();
  const { data, error } = await db.rpc("claim_chapter_notifications", { p_story_id: storyId });
  if (error || !data?.length) return 0;
  let sent = 0;
  for (let i = 0; i < data.length; i += 20) {
    const batch = data.slice(i, i + 20);
    const results = await Promise.allSettled(
      batch.map((r) => {
        const url = `${appUrl()}/s/${r.story_slug}/${r.first_new_number}`;
        const more = r.new_chapters > 1 ? ` (+${r.new_chapters - 1} бүлэг)` : "";
        const text = `📖 «${r.story_title}» — шинэ бүлэг гарлаа!\n\n${r.first_new_number}. ${r.first_new_title}${more}`;
        return tg.sendMessage(r.chat_id, text, { inline_keyboard: [[{ text: "Унших", url }]] });
      }),
    );
    sent += results.filter((x) => x.status === "fulfilled").length;
  }
  return sent;
}
