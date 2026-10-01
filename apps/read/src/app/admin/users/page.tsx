import { cx, fieldClass } from "@zugaa/ui";
import { formatCoins, formatDate } from "@zugaa/wallet";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { AdjustForm } from "../forms";

export const metadata = { title: "Хэрэглэгч" };

export default async function AdminUsers({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireAdmin();
  const q = ((await searchParams).q ?? "").slice(0, 100);
  const supabase = await createClient();
  const { data: users } = await supabase.rpc("admin_find_users", { p_query: q });

  return (
    <div className="space-y-6">
      <h1 className="font-serif text-2xl">Хэрэглэгч</h1>
      <form role="search" action="/admin/users">
        <label htmlFor="q" className="sr-only">
          Имэйлээр хайх
        </label>
        <input id="q" name="q" type="search" defaultValue={q} placeholder="Имэйлээр хайх" className={cx(fieldClass, "max-w-md")} />
      </form>
      {(users ?? []).length === 0 ? (
        <p className="text-muted">Олдсонгүй.</p>
      ) : (
        <ul className="divide-y divide-line border-y border-line">
          {users!.map((u) => (
            <li key={u.id} className="space-y-3 py-4">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                <span className="break-all">{u.email}</span>
                <span className="tabular-nums">{formatCoins(u.balance_coins)}</span>
              </div>
              <p className="text-sm text-muted">
                {u.display_name ?? "—"}
                {u.subscription_expires_at ? ` · Эрх ${formatDate(u.subscription_expires_at)} хүртэл` : ""}
              </p>
              <AdjustForm userId={u.id} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
