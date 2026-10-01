import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { StoryForm } from "../../forms";

export const metadata = { title: "Шинэ өгүүллэг" };

export default async function NewStory() {
  await requireAdmin();
  return (
    <div className="max-w-page space-y-6">
      <Link href="/admin/stories" className="text-sm text-accent">
        ← Өгүүллэг
      </Link>
      <h1 className="font-serif text-2xl">Шинэ өгүүллэг</h1>
      <StoryForm />
    </div>
  );
}
