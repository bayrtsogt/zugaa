"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { approvePayment, rejectPayment, walletErrorText } from "@zugaa/wallet";
import { createClient } from "@/lib/supabase/server";
import { assertAdmin, getMyProfile } from "@/lib/auth";
import { slugify } from "@/lib/slug";
import { syncTelegramDecision } from "@/lib/telegram";

export type AdminState = { error?: string; ok?: string };

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const optInt = (f: FormData, k: string): number | null => {
  const v = str(f, k);
  if (!v) return null;
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : NaN;
};

/* ------------------------------------------------------------------ stories */

export async function saveStory(_prev: AdminState, form: FormData): Promise<AdminState> {
  await assertAdmin();
  const id = str(form, "id");
  const title = str(form, "title");
  const slug = slugify(str(form, "slug") || title);
  const genre = str(form, "genre");
  const age = str(form, "age_rating");
  const price = optInt(form, "price_coins");
  const wait = optInt(form, "wait_free_hours");
  const color = str(form, "cover_color") || "#3b2a2a";
  const coverUrl = str(form, "cover_url");

  if (!title) return { error: "Гарчиг оруулна уу." };
  if (!slug) return { error: "Slug буруу байна." };
  {
    const supabase = await createClient();
    const { data: g } = await supabase.from("genres").select("slug").eq("slug", genre).maybeSingle();
    if (!g) return { error: "Төрөл сонгоно уу." };
  }
  if (!["all", "16", "18"].includes(age)) return { error: "Насны ангилал сонгоно уу." };
  if (Number.isNaN(price) || Number.isNaN(wait)) return { error: "Үнэ, хүлээх цаг эерэг бүхэл тоо байна." };
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) return { error: "Өнгө #RRGGBB хэлбэртэй байна." };
  if (coverUrl && !/^https:\/\//.test(coverUrl)) return { error: "Хавтасны зураг https:// хаягтай байна." };

  const row = {
    title,
    slug,
    description: str(form, "description"),
    genre,
    age_rating: age,
    price_coins: price,
    wait_free_hours: wait,
    cover_color: color,
    cover_url: coverUrl || null,
  };
  const supabase = await createClient();
  const res = id
    ? await supabase.from("stories").update(row).eq("id", id).select("id").single()
    : await supabase.from("stories").insert(row).select("id").single();
  if (res.error) {
    return { error: res.error.code === "23505" ? "Энэ slug-тай өгүүллэг аль хэдийн байна." : "Хадгалж чадсангүй." };
  }
  revalidatePath("/admin/stories");
  if (!id) redirect(`/admin/stories/${res.data.id}`);
  return { ok: "Хадгаллаа." };
}

export async function setStoryStatus(form: FormData) {
  await assertAdmin();
  const id = str(form, "id");
  const status = str(form, "status") === "published" ? "published" : "draft";
  const supabase = await createClient();
  await supabase.from("stories").update({ status }).eq("id", id);
  revalidatePath(`/admin/stories/${id}`);
  revalidatePath("/admin/stories");
}

export type BulkResult = { ok?: string; error?: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Deletes stories (chapters, choices, unlocks and progress cascade). A story
 * whose bank-purchase product has payment history cannot be deleted — that
 * history must stay — so it is unpublished (hidden from readers) instead.
 */
async function removeStories(ids: string[]): Promise<{ deleted: string[]; hidden: string[]; failed: string[] }> {
  const supabase = await createClient();
  const out = { deleted: [] as string[], hidden: [] as string[], failed: [] as string[] };
  for (const id of ids.filter((x) => UUID_RE.test(x))) {
    const { data: story } = await supabase.from("stories").select("title").eq("id", id).maybeSingle();
    if (!story) continue;
    const { error } = await supabase.from("stories").delete().eq("id", id);
    if (!error) {
      out.deleted.push(story.title);
    } else if (error.code === "23503") {
      await supabase.from("stories").update({ status: "draft" }).eq("id", id);
      await supabase.from("products").update({ active: false }).eq("story_id", id);
      out.hidden.push(story.title);
    } else {
      out.failed.push(story.title);
    }
  }
  return out;
}

function summary(r: { deleted: string[]; hidden: string[]; failed: string[] }): BulkResult {
  const parts = [];
  if (r.deleted.length) parts.push(`${r.deleted.length} өгүүллэг устгагдлаа.`);
  if (r.hidden.length) parts.push(`Төлбөрийн түүхтэй тул устгаагүй, нуусан: ${r.hidden.join(", ")}.`);
  if (r.failed.length) return { error: `${parts.join(" ")} Устгаж чадсангүй: ${r.failed.join(", ")}.`.trim() };
  return { ok: parts.join(" ") || "Өөрчлөлт алга." };
}

export async function deleteStory(form: FormData) {
  await assertAdmin();
  const r = await removeStories([str(form, "id")]);
  revalidatePath("/admin/stories");
  revalidatePath("/");
  const msg = summary(r);
  redirect(`/admin/stories?msg=${encodeURIComponent(msg.error ?? msg.ok ?? "")}`);
}

export async function bulkStories(_prev: BulkResult, form: FormData): Promise<BulkResult> {
  await assertAdmin();
  const ids = form.getAll("ids").map(String);
  if (ids.length === 0) return { error: "Өгүүллэг сонгоно уу." };
  const action = str(form, "bulk");
  if (action === "delete") {
    if (str(form, "confirm") !== "УСТГАХ") return { error: "Баталгаажуулахын тулд УСТГАХ гэж бичнэ үү." };
    const r = await removeStories(ids);
    revalidatePath("/admin/stories");
    revalidatePath("/");
    return summary(r);
  }
  if (action === "hide" || action === "publish") {
    const supabase = await createClient();
    const { error } = await supabase
      .from("stories")
      .update({ status: action === "hide" ? "draft" : "published" })
      .in("id", ids.filter((x) => UUID_RE.test(x)));
    revalidatePath("/admin/stories");
    revalidatePath("/");
    if (error) return { error: "Хадгалж чадсангүй." };
    return { ok: action === "hide" ? `${ids.length} өгүүллэгийг нуулаа (ноорог).` : `${ids.length} өгүүллэгийг нийтэллээ.` };
  }
  return { error: "Үйлдэл сонгоно уу." };
}

/* ----------------------------------------------------------------- chapters */

export async function saveChapter(_prev: AdminState, form: FormData): Promise<AdminState> {
  await assertAdmin();
  const id = str(form, "id");
  const storyId = str(form, "story_id");
  const number = optInt(form, "number");
  const price = optInt(form, "price_coins");
  const title = str(form, "title");
  const content = String(form.get("content") ?? "");
  if (!number || Number.isNaN(number)) return { error: "Бүлгийн дугаар эерэг бүхэл тоо байна." };
  if (!title) return { error: "Гарчиг оруулна уу." };
  if (!price || Number.isNaN(price)) return { error: "Үнэ эерэг бүхэл тоо байна." };

  const supabase = await createClient();
  const publish = form.get("published") === "on";
  let publishedAt: string | null = null;
  if (publish) {
    const existing = id ? (await supabase.from("chapters").select("published_at").eq("id", id).single()).data?.published_at : null;
    publishedAt = existing ?? new Date().toISOString();
  }
  const row = {
    story_id: storyId,
    number,
    title,
    content,
    is_free: form.get("is_free") === "on",
    is_ending: form.get("is_ending") === "on",
    price_coins: price,
    published_at: publishedAt,
  };
  const res = id
    ? await supabase.from("chapters").update(row).eq("id", id).select("id").single()
    : await supabase.from("chapters").insert(row).select("id").single();
  if (res.error) {
    return { error: res.error.code === "23505" ? `${number}-р бүлэг аль хэдийн байна.` : "Хадгалж чадсангүй." };
  }
  const chapterId = res.data.id;

  // Choices: replace the whole set. Rows arrive as choice_label[] / choice_target[].
  const labels = form.getAll("choice_label").map(String);
  const targets = form.getAll("choice_target").map((v) => Number(v));
  const wanted = labels
    .map((label, i) => ({ label: label.trim(), target: targets[i] ?? 0, position: i }))
    .filter((c) => c.label && c.target > 0);
  const { data: siblings } = await supabase.from("chapters").select("id, number").eq("story_id", storyId);
  const byNumber = new Map((siblings ?? []).map((c) => [c.number, c.id]));
  const missing = wanted.find((c) => !byNumber.has(c.target));
  if (missing) return { error: `Сонголтын зорилтот ${missing.target}-р бүлэг олдсонгүй.` };

  await supabase.from("chapter_choices").delete().eq("chapter_id", chapterId);
  if (wanted.length > 0) {
    const { error } = await supabase.from("chapter_choices").insert(
      wanted.map((c) => ({ chapter_id: chapterId, label: c.label, target_chapter_id: byNumber.get(c.target)!, position: c.position })),
    );
    if (error) return { error: "Сонголтыг хадгалж чадсангүй." };
  }

  revalidatePath(`/admin/stories/${storyId}`);
  if (!id) redirect(`/admin/stories/${storyId}/chapters/${chapterId}?saved=1`);
  return { ok: "Хадгаллаа." };
}

export async function deleteChapter(form: FormData) {
  await assertAdmin();
  const storyId = str(form, "story_id");
  const supabase = await createClient();
  await supabase.from("chapters").delete().eq("id", str(form, "id"));
  redirect(`/admin/stories/${storyId}`);
}

/* ----------------------------------------------------------------- payments */

async function adminLabel(): Promise<string> {
  const profile = await getMyProfile();
  return profile?.display_name ? `${profile.display_name} (сайт)` : "Админ (сайт)";
}

export async function decidePayment(_prev: AdminState, form: FormData): Promise<AdminState> {
  await assertAdmin();
  const id = str(form, "id");
  const decision = str(form, "decision");
  const supabase = await createClient();
  try {
    // Same SQL functions the Telegram webhook calls (admin session is allowed).
    const res =
      decision === "approve"
        ? await approvePayment(supabase, id)
        : await rejectPayment(supabase, id, { reason: str(form, "reason") || undefined });
    if (!res.ok) return { error: `Төлөв өөрчлөгдөхгүй: ${res.status}` };
    await syncTelegramDecision(id, await adminLabel());
    // No revalidation: the row stays and shows the result; the list refreshes on next visit.
    return { ok: res.already ? "Аль хэдийн шийдвэрлэсэн." : decision === "approve" ? `${res.ref_code} батлагдлаа.` : `${res.ref_code} татгалзлаа.` };
  } catch (e) {
    return { error: walletErrorText(e) };
  }
}

/* -------------------------------------------------------------------- users */

export async function adjustCoins(_prev: AdminState, form: FormData): Promise<AdminState> {
  await assertAdmin();
  const userId = str(form, "user_id");
  const delta = Number(str(form, "delta"));
  const reason = str(form, "reason");
  if (!Number.isInteger(delta) || delta === 0 || Math.abs(delta) > 100_000) return { error: "Дүн буруу (±1–100000)." };
  if (!reason) return { error: "Шалтгаан бичнэ үү." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_adjust_coins", { p_user_id: userId, p_delta: delta, p_reason: reason });
  if (error) return { error: error.message === "insufficient_balance" ? "Үлдэгдэл хасах дүнгээс бага байна." : "Хадгалж чадсангүй." };
  revalidatePath("/admin/users");
  return { ok: `Шинэ үлдэгдэл: ${data} coin` };
}

/* ------------------------------------------------------------------- genres */

const ARTS = ["horror", "thriller", "mystery", "romance", "other"];

export async function saveGenre(_prev: AdminState, form: FormData): Promise<AdminState> {
  await assertAdmin();
  const original = str(form, "original");
  const label = str(form, "label");
  const slug = slugify(str(form, "slug") || label);
  const art = str(form, "art");
  const position = Number(str(form, "position") || "50");
  if (!label || label.length > 40) return { error: "Нэр 1–40 тэмдэгт байна." };
  if (!slug) return { error: "Slug үүсгэж чадсангүй. Латинаар бичнэ үү." };
  if (!ARTS.includes(art)) return { error: "Зураг сонгоно уу." };
  if (!Number.isInteger(position)) return { error: "Дараалал бүхэл тоо байна." };
  const supabase = await createClient();
  const row = { slug, label, art, position };
  const { error } = original
    ? await supabase.from("genres").update(row).eq("slug", original)
    : await supabase.from("genres").insert(row);
  if (error) return { error: error.code === "23505" ? "Ийм slug-тай төрөл байна." : "Хадгалж чадсангүй." };
  revalidatePath("/admin/genres");
  revalidatePath("/");
  revalidatePath("/library");
  return { ok: original ? "Хадгаллаа." : `«${label}» төрөл нэмэгдлээ.` };
}

export async function deleteGenre(_prev: AdminState, form: FormData): Promise<AdminState> {
  await assertAdmin();
  const slug = str(form, "slug");
  const supabase = await createClient();
  const { count } = await supabase.from("stories").select("id", { count: "exact", head: true }).eq("genre", slug);
  if (count) return { error: `Энэ төрөлд ${count} өгүүллэг байна. Эхлээд тэдгээрийн төрлийг солино уу.` };
  const { error } = await supabase.from("genres").delete().eq("slug", slug);
  if (error) return { error: "Устгаж чадсангүй." };
  revalidatePath("/");
  revalidatePath("/library");
  // The row disappears, so report on the page itself.
  redirect(`/admin/genres?msg=${encodeURIComponent(`«${slug}» төрөл устгагдлаа.`)}`);
}
