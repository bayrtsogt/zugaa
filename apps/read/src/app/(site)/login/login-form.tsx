"use client";
import { useActionState, useState } from "react";
import { Button, Field, Notice, fieldClass } from "@zugaa/ui";
import { sendOtp, verifyOtp, type OtpState } from "./actions";

export function LoginForm({ next }: { next: string }) {
  const [sendState, send, sending] = useActionState(sendOtp, { step: "email" } as OtpState);
  const [verifyState, verify, verifying] = useActionState(verifyOtp, { step: "code" } as OtpState);
  const [editing, setEditing] = useState(false);

  const onCode = sendState.step === "code" && !editing;
  const email = sendState.email ?? "";

  if (!onCode) {
    return (
      <form action={(fd) => { setEditing(false); send(fd); }} className="space-y-4" noValidate>
        <Field label="Имэйл" htmlFor="email" error={sendState.error}>
          <input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            defaultValue={email}
            className={fieldClass}
            placeholder="ner@jishee.mn"
            aria-invalid={sendState.error ? true : undefined}
          />
        </Field>
        <Button type="submit" className="w-full" disabled={sending}>
          {sending ? "Илгээж байна…" : "Код авах"}
        </Button>
      </form>
    );
  }

  return (
    <div className="space-y-4">
      {sendState.info ? <Notice>{sendState.info}</Notice> : null}
      {sendState.error ? <Notice tone="accent">{sendState.error}</Notice> : null}
      <form action={verify} className="space-y-4" noValidate>
        <input type="hidden" name="email" value={email} />
        <input type="hidden" name="next" value={next} />
        <Field label="Нэвтрэх код" htmlFor="token" error={verifyState.error}>
          <input
            id="token"
            name="token"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={6}
            required
            autoFocus
            className={`${fieldClass} font-mono text-xl tracking-[0.4em]`}
            aria-invalid={verifyState.error ? true : undefined}
          />
        </Field>
        <Button type="submit" className="w-full" disabled={verifying}>
          {verifying ? "Шалгаж байна…" : "Нэвтрэх"}
        </Button>
      </form>
      <div className="flex flex-wrap justify-between gap-2 text-sm">
        <button type="button" className="min-h-11 text-accent underline-offset-4 hover:underline" onClick={() => setEditing(true)}>
          Имэйл солих
        </button>
        <form action={send}>
          <input type="hidden" name="email" value={email} />
          <button type="submit" className="min-h-11 text-accent underline-offset-4 hover:underline" disabled={sending}>
            Код дахин авах
          </button>
        </form>
      </div>
    </div>
  );
}
