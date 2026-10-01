"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { isValidBirthYear, safeNextPath } from "@zugaa/auth";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

export type FormState = { error?: string; ok?: boolean };

/** 18+ gate: birth year is asked once (locked in the database afterwards). */
export async function setBirthYear(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await getUser();
  if (!user) return { error: "Нэвтэрнэ үү." };
  const year = Number(form.get("birth_year"));
  if (!isValidBirthYear(year)) return { error: "Төрсөн оноо зөв оруулна уу." };

  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ birth_year: year }).eq("id", user.id);
  if (error) {
    return {
      error: error.message.includes("birth_year_locked")
        ? "Төрсөн оныг нэг удаа л оруулна."
        : "Хадгалж чадсангүй. Дахин оролдоно уу.",
    };
  }
  const next = safeNextPath(String(form.get("next") ?? ""), "");
  if (next) redirect(next);
  revalidatePath("/me");
  return { ok: true };
}

export async function updateDisplayName(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await getUser();
  if (!user) return { error: "Нэвтэрнэ үү." };
  const name = String(form.get("display_name") ?? "").trim().slice(0, 80);
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ display_name: name || null }).eq("id", user.id);
  if (error) return { error: "Хадгалж чадсангүй." };
  revalidatePath("/me");
  return { ok: true };
}
