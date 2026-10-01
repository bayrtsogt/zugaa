import type { AgeRating } from "@zugaa/db";

export const AGE_LABEL: Record<AgeRating, string> = { all: "Бүх нас", "16": "16+", "18": "18+" };

export function ageLabel(a: string): string {
  return AGE_LABEL[a as AgeRating] ?? a;
}
