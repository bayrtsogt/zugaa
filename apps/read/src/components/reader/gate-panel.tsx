import Link from "next/link";
import { AGE_GATE_TEXT, type AgeGate } from "@zugaa/auth";
import { buttonClass } from "@zugaa/ui";
import { loginHref } from "@/lib/auth";
import { BirthYearForm } from "./action-forms";

export function GatePanel({ gate, path, storyHref }: { gate: AgeGate; path: string; storyHref: string }) {
  return (
    <section aria-labelledby="gate-title" className="mx-auto max-w-sm space-y-5 py-6">
      <h2 id="gate-title" className="text-center font-serif text-xl">
        18+
      </h2>
      <p className="text-center text-muted">{AGE_GATE_TEXT[gate]}</p>
      {gate === "login_required" ? (
        <Link href={loginHref(path)} className={buttonClass("primary", "md", "w-full")}>
          Нэвтрэх
        </Link>
      ) : gate === "birth_year_required" ? (
        <BirthYearForm next={path} />
      ) : (
        <Link href="/library" className={buttonClass("secondary", "md", "w-full")}>
          Өөр өгүүллэг сонгох
        </Link>
      )}
      <p className="text-center">
        <Link href={storyHref} className="text-sm text-accent underline-offset-4 hover:underline">
          Өгүүллэгийн хуудас руу буцах
        </Link>
      </p>
    </section>
  );
}
