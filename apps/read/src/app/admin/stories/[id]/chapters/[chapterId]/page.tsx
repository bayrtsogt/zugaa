import Link from "next/link";
import { notFound } from "next/navigation";
import { buttonClass, Notice } from "@zugaa/ui";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { ChapterForm, type ChapterFormValues } from "../../../../forms";
import { deleteChapter } from "../../../../actions";

export const metadata = { title: "Бүлэг засах" };

export default async function EditChapter({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; chapterId: string }>;
  searchParams: Promise<{ number?: string; saved?: string }>;
}) {
  await requireAdmin();
  const [{ id: storyId, chapterId }, sp] = await Promise.all([params, searchParams]);
  const supabase = await createClient();
  const { data: story } = await supabase.from("stories").select("id, title").eq("id", storyId).maybeSingle();
  if (!story) notFound();
  const { data: siblings } = await supabase.from("chapters").select("number").eq("story_id", storyId).order("number");
  const numbers = (siblings ?? []).map((c) => c.number);

  let values: ChapterFormValues;
  if (chapterId === "new") {
    values = {
      story_id: storyId,
      number: Number(sp.number) || (numbers.at(-1) ?? 0) + 1,
      title: "",
      content: "",
      is_free: false,
      is_ending: false,
      price_coins: 40,
      published: false,
      choices: [],
    };
  } else {
    // Content comes through get_chapter (admins get the full text, drafts included).
    const [{ data: meta }, { data: full }, { data: choices }] = await Promise.all([
      supabase.from("chapters").select("id, number, title, is_free, is_ending, price_coins, published_at").eq("id", chapterId).maybeSingle(),
      supabase.rpc("get_chapter", { p_chapter_id: chapterId }),
      supabase.from("chapter_choices").select("label, position, target:chapters!chapter_choices_target_chapter_id_fkey(number)").eq("chapter_id", chapterId).order("position"),
    ]);
    if (!meta) notFound();
    values = {
      id: meta.id,
      story_id: storyId,
      number: meta.number,
      title: meta.title,
      content: full?.[0]?.content ?? "",
      is_free: meta.is_free,
      is_ending: meta.is_ending,
      price_coins: meta.price_coins,
      published: Boolean(meta.published_at),
      choices: (choices ?? []).map((c) => ({ label: c.label, target_number: c.target?.number ?? 0 })),
    };
  }

  return (
    <div className="space-y-6">
      <Link href={`/admin/stories/${storyId}`} className="text-sm text-accent">
        ← {story.title}
      </Link>
      <h1 className="font-display text-2xl">{chapterId === "new" ? "Шинэ бүлэг" : `${values.number}. ${values.title}`}</h1>
      {sp.saved ? <Notice tone="ok">Хадгаллаа.</Notice> : null}
      <ChapterForm chapter={values} numbers={numbers} />
      {values.id ? (
        <form action={deleteChapter} className="border-t border-line pt-6">
          <input type="hidden" name="id" value={values.id} />
          <input type="hidden" name="story_id" value={storyId} />
          <details>
            <summary className="min-h-11 cursor-pointer text-sm text-accent">Бүлэг устгах</summary>
            <button type="submit" className={buttonClass("secondary", "sm", "mt-3")}>
              Тийм, устгах
            </button>
          </details>
        </form>
      ) : null}
    </div>
  );
}
