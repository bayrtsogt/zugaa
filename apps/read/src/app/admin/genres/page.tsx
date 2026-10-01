import { Notice, SectionTitle } from "@zugaa/ui";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { getGenres } from "@/lib/genres";
import { GenreForm } from "../forms";

export const metadata = { title: "Төрөл" };

export default async function GenresPage({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  await requireAdmin();
  const msg = (await searchParams).msg?.slice(0, 200);
  const supabase = await createClient();
  const [genres, { data: stories }] = await Promise.all([getGenres(), supabase.from("stories").select("genre")]);
  const counts = new Map<string, number>();
  for (const s of stories ?? []) counts.set(s.genre, (counts.get(s.genre) ?? 0) + 1);

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="font-serif text-2xl">Төрөл</h1>
        <p className="text-muted">
          Төрөл нүүр хуудас, номын сангийн шүүлтүүр, өгүүллэгийн маягт, JSON оруулалтад шууд харагдана. Хавтасгүй
          өгүүллэгт төрлийн зураг гарна. Өгүүллэгтэй төрлийг устгах боломжгүй.
        </p>
      </div>

      {msg ? <Notice tone="ok">{msg}</Notice> : null}
      <section className="space-y-3">
        <SectionTitle>Шинэ төрөл</SectionTitle>
        <GenreForm />
      </section>

      <section className="space-y-3">
        <SectionTitle>Байгаа төрлүүд</SectionTitle>
        <ul className="divide-y divide-line border-y border-line">
          {genres.map((g) => (
            <li key={g.slug} className="py-4">
              <GenreForm genre={{ ...g, stories: counts.get(g.slug) ?? 0 }} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
