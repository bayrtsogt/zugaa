"use client";
import { useActionState } from "react";
import { Button, fieldClass } from "@zugaa/ui";
import { updateDisplayName, type FormState } from "@/app/actions/account";

export function DisplayNameForm({ value }: { value: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(updateDisplayName, {});
  return (
    <form action={action} className="space-y-2">
      <label htmlFor="display_name" className="block text-sm font-medium">
        Нэр
      </label>
      <div className="flex gap-2">
        <input id="display_name" name="display_name" defaultValue={value} maxLength={80} className={fieldClass} autoComplete="nickname" />
        <Button type="submit" variant="secondary" disabled={pending}>
          Хадгалах
        </Button>
      </div>
      {state.ok ? <p className="text-sm text-ok" role="status">Хадгаллаа.</p> : null}
      {state.error ? <p className="text-sm text-accent" role="alert">{state.error}</p> : null}
    </form>
  );
}
