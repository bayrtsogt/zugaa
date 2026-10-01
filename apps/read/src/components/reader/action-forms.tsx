"use client";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { buttonClass, type ButtonVariant } from "@zugaa/ui";
import { unlockChapterAction, unlockStoryAction, type UnlockState } from "@/app/actions/unlock";
import { startPurchase, type PurchaseState } from "@/app/actions/payments";
import { setBirthYear, type FormState } from "@/app/actions/account";
import { fieldClass } from "@zugaa/ui";

function Submit({ children, variant, pendingText }: { children: React.ReactNode; variant: ButtonVariant; pendingText: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClass(variant, "md", "w-full")}>
      {pending ? pendingText : children}
    </button>
  );
}

export function UnlockForm({
  kind,
  id,
  returnTo,
  label,
  variant = "primary",
}: {
  kind: "chapter" | "story";
  id: string;
  returnTo: string;
  label: string;
  variant?: ButtonVariant;
}) {
  const [state, action] = useActionState<UnlockState, FormData>(
    kind === "chapter" ? unlockChapterAction : unlockStoryAction,
    {},
  );
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <Submit variant={variant} pendingText="Нээж байна…">
        {label}
      </Submit>
      {state.error ? (
        <p role="alert" className="text-sm text-accent">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}

export function PurchaseForm({
  product,
  next,
  label,
  variant = "secondary",
}: {
  product: string;
  next: string;
  label: React.ReactNode;
  variant?: ButtonVariant;
}) {
  const [state, action] = useActionState<PurchaseState, FormData>(startPurchase, {});
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="product" value={product} />
      <input type="hidden" name="next" value={next} />
      <Submit variant={variant} pendingText="Түр хүлээнэ үү…">
        {label}
      </Submit>
      {state.error ? (
        <p role="alert" className="text-sm text-accent">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}

export function BirthYearForm({ next }: { next: string }) {
  const [state, action] = useActionState<FormState, FormData>(setBirthYear, {});
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="next" value={next} />
      <label htmlFor="birth_year" className="block text-sm font-medium">
        Төрсөн он
      </label>
      <input
        id="birth_year"
        name="birth_year"
        inputMode="numeric"
        pattern="[0-9]{4}"
        maxLength={4}
        placeholder="1995"
        required
        className={fieldClass}
        aria-invalid={state.error ? true : undefined}
        aria-describedby="birth_year_hint"
      />
      <p id="birth_year_hint" className="text-sm text-muted">
        Нэг л удаа асууна. Дараа нь өөрчлөх боломжгүй.
      </p>
      {state.error ? (
        <p role="alert" className="text-sm text-accent">
          {state.error}
        </p>
      ) : null}
      <Submit variant="primary" pendingText="Хадгалж байна…">
        Үргэлжлүүлэх
      </Submit>
    </form>
  );
}
