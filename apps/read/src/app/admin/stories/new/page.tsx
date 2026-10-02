import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { StoryForm } from "../../forms";
import { getGenres } from "@/lib/genres";

export const metadata = { title: "Шинэ өгүүллэг" };

export default async function NewStory() {
  await requireAdmin();
  return (
    <div className="max-w-page space-y-6">
      <Link href="/admin/stories" className="text-sm text-accent">
        ← Өгүүллэг
      </Link>
      <h1 className="font-display text-2xl">Шинэ өгүүллэг</h1>
      <StoryForm genres={await getGenres()} />
    </div>
  );
}
