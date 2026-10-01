"use client";
import { useActionState } from "react";
import { Button, fieldClass } from "@zugaa/ui";
import { addEmail, updateDisplayName, type FormState } from "@/app/actions/account";

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

export function AddEmailForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(addEmail, {});
  if (state.ok) {
    return (
      <p className="text-sm text-ok" role="status">
        Баталгаажуулах холбоос илгээлээ. Имэйлээ шалгаад холбоос дээр дарна уу.
      </p>
    );
  }
  return (
    <form action={action} className="space-y-2">
      <label htmlFor="add_email" className="block text-sm font-medium">
        Имэйл нэмэх
      </label>
      <p className="text-sm text-muted">Таны бүртгэлд имэйл алга. Төлбөрийн мэдэгдэл, нэвтрэх код авахад хэрэгтэй.</p>
      <div className="flex gap-2">
        <input id="add_email" name="email" type="email" inputMode="email" autoComplete="email" required className={fieldClass} placeholder="ner@jishee.mn" />
        <Button type="submit" variant="secondary" disabled={pending}>
          Нэмэх
        </Button>
      </div>
      {state.error ? <p className="text-sm text-accent" role="alert">{state.error}</p> : null}
    </form>
  );
}
