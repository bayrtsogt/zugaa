import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";

export default async function AdminHome() {
  await requireAdmin();
  const supabase = await createClient();
  const [{ count: submitted }, { count: stories }] = await Promise.all([
    supabase.from("payment_requests").select("id", { count: "exact", head: true }).eq("status", "submitted"),
    supabase.from("stories").select("id", { count: "exact", head: true }),
  ]);
  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl">Админ</h1>
      <ul className="divide-y divide-line border-y border-line">
        <li>
          <Link href="/admin/payments" className="flex min-h-14 items-center justify-between py-3 hover:text-accent">
            Шалгах төлбөр <span className={submitted ? "text-accent" : "text-muted"}>{submitted ?? 0}</span>
          </Link>
        </li>
        <li>
          <Link href="/admin/stories" className="flex min-h-14 items-center justify-between py-3 hover:text-accent">
            Өгүүллэг <span className="text-muted">{stories ?? 0}</span>
          </Link>
        </li>
        <li>
          <Link href="/admin/users" className="flex min-h-14 items-center justify-between py-3 hover:text-accent">
            Хэрэглэгч, coin тохируулах <span />
          </Link>
        </li>
      </ul>
    </div>
  );
}
