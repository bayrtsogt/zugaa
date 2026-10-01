"use server";
import { redirect } from "next/navigation";
import { safeNextPath } from "@zugaa/auth";
import { createClient } from "@/lib/supabase/server";
import { allow, clientIp } from "@/lib/rate-limit";
import { appUrl } from "@/lib/env";

export type OtpState = { step: "email" | "code"; email?: string; error?: string; info?: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function sendOtp(_prev: OtpState, form: FormData): Promise<OtpState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return { step: "email", email, error: "Имэйл хаягаа зөв оруулна уу." };
  }

  const ip = await clientIp();
  const [byEmail, byIp] = await Promise.all([
    allow(`otp:email:${email}`, 5, 3600),
    allow(`otp:ip:${ip}`, 20, 3600),
  ]);
  if (!byEmail || !byIp) {
    return { step: "email", email, error: "Хэт олон удаа код хүслээ. Нэг цагийн дараа дахин оролдоно уу." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
  if (error) {
    console.error("signInWithOtp", error.status, error.message);
    const throttled = error.status === 429;
    return {
      step: throttled ? "code" : "email",
      email,
      error: throttled
        ? "Код саяхан илгээгдсэн. Түр хүлээгээд дахин оролдоно уу."
        : "Код илгээж чадсангүй. Дахин оролдоно уу.",
    };
  }
  return { step: "code", email, info: `${email} хаяг руу 6 оронтой код илгээлээ.` };
}

export async function verifyOtp(_prev: OtpState, form: FormData): Promise<OtpState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const token = String(form.get("token") ?? "").replace(/\D/g, "");
  const next = safeNextPath(String(form.get("next") ?? ""));
  if (token.length !== 6) return { step: "code", email, error: "6 оронтой кодоо оруулна уу." };

  if (!(await allow(`otp-verify:${email}`, 10, 900))) {
    return { step: "code", email, error: "Хэт олон буруу оролдлого. 15 минутын дараа дахин оролдоно уу." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
  if (error) return { step: "code", email, error: "Код буруу эсвэл хугацаа нь дууссан байна." };
  redirect(next);
}

export async function signInWithGoogle(form: FormData) {
  const next = safeNextPath(String(form.get("next") ?? ""));
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${appUrl()}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (error || !data.url) redirect(`/login?next=${encodeURIComponent(next)}&error=google`);
  redirect(data.url);
}
