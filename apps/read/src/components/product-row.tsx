"use client";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { startPurchase, type PurchaseState } from "@/app/actions/payments";

function RowButton({ title, detail, price }: { title: string; detail: string; price: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex min-h-16 w-full items-center justify-between gap-4 py-3 text-left hover:text-accent disabled:opacity-60"
    >
      <span className="min-w-0">
        <span className="block font-medium">{title}</span>
        <span className="block text-sm text-muted">{pending ? "Түр хүлээнэ үү…" : detail}</span>
      </span>
      <span className="shrink-0 tabular-nums">{price}</span>
    </button>
  );
}

export function ProductRow({ code, next, title, detail, price }: { code: string; next: string; title: string; detail: string; price: string }) {
  const [state, action] = useActionState<PurchaseState, FormData>(startPurchase, {});
  return (
    <form action={action}>
      <input type="hidden" name="product" value={code} />
      <input type="hidden" name="next" value={next} />
      <RowButton title={title} detail={detail} price={price} />
      {state.error ? (
        <p role="alert" className="pb-3 text-sm text-accent">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
