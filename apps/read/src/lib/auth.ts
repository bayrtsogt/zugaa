import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { getProfile, getSessionUser, type Profile, type SessionUser } from "@zugaa/auth";
import { createClient } from "@/lib/supabase/server";

/** Current user, verified, memoised for the request. */
export const getUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createClient();
  return getSessionUser(supabase);
});

export const getMyProfile = cache(async (): Promise<Profile | null> => {
  const user = await getUser();
  if (!user) return null;
  const supabase = await createClient();
  return getProfile(supabase, user.id);
});

export function loginHref(next: string): string {
  return `/login?next=${encodeURIComponent(next)}`;
}

export async function requireUser(next: string): Promise<SessionUser> {
  const user = await getUser();
  if (!user) redirect(loginHref(next));
  return user;
}

/** Server-side admin check for every admin page and action. */
export async function requireAdmin(): Promise<{ user: SessionUser; profile: Profile }> {
  const user = await getUser();
  if (!user) redirect(loginHref("/admin"));
  const profile = await getMyProfile();
  if (!profile?.is_admin) redirect("/");
  return { user, profile };
}

/** For server actions: throws instead of redirecting. */
export async function assertAdmin(): Promise<SessionUser> {
  const user = await getUser();
  const profile = user ? await getMyProfile() : null;
  if (!user || !profile?.is_admin) throw new Error("forbidden");
  return user;
}
