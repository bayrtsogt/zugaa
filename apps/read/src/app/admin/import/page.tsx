import { requireAdmin } from "@/lib/auth";
import { CONTINUE_PROMPT, STORY_TEMPLATE_JSON, buildAiPrompt } from "@/lib/story-format";
import { getGenres } from "@/lib/genres";
import { ImportClient } from "./import-client";

export const metadata = { title: "Өгүүллэг оруулах" };

export default async function ImportPage() {
  await requireAdmin();
  const genres = await getGenres();
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="font-serif text-2xl">Өгүүллэг оруулах (JSON)</h1>
        <p className="text-muted">
          JSON-оо буулгах эсвэл нэг болон хэд хэдэн .json файл сонгоно. «Шалгах» товч бүх өгүүллэгийг шалгана, «Оруулах»
          товч алдаагүйг нь нэг дор оруулна. Ижил slug-тай өгүүллэг байвал бүлгүүдийг нь шинэчилнэ (устгахгүй,
          худалдан авалт хадгалагдана).
        </p>
      </div>
      <ImportClient template={STORY_TEMPLATE_JSON} prompt={buildAiPrompt(genres)}
        continuePrompt={CONTINUE_PROMPT}
        genres={genres.map((g) => g.slug)} />
    </div>
  );
}
