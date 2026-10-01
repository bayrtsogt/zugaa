"use server";
import { redirect } from "next/navigation";
import { safeNextPath } from "@zugaa/auth";
import { unlockChapter, unlockStory, walletErrorText, type UnlockResult } from "@zugaa/wallet";
import { createClient } from "@/lib/supabase/server";
import { getUser, loginHref } from "@/lib/auth";

export type UnlockState = { error?: string };

async function run(form: FormData, fn: (id: string) => Promise<UnlockResult>): Promise<UnlockState> {
  const returnTo = safeNextPath(String(form.get("returnTo") ?? ""));
  if (!(await getUser())) redirect(loginHref(returnTo));
  let result: UnlockResult;
  try {
    result = await fn(String(form.get("id") ?? ""));
  } catch (e) {
    return { error: walletErrorText(e) };
  }
  if (result.status === "insufficient") {
    redirect(`/shop?next=${encodeURIComponent(returnTo)}&need=${Math.max(0, result.price - result.balance)}`);
  }
  // Re-render the reader: the chapter is now open.
  redirect(returnTo);
}

export async function unlockChapterAction(_prev: UnlockState, form: FormData): Promise<UnlockState> {
  const supabase = await createClient();
  return run(form, (id) => unlockChapter(supabase, id));
}

export async function unlockStoryAction(_prev: UnlockState, form: FormData): Promise<UnlockState> {
  const supabase = await createClient();
  return run(form, (id) => unlockStory(supabase, id));
}
