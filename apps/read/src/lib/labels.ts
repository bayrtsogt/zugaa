import type { AgeRating, Genre } from "@zugaa/db";

export const GENRES: Array<{ value: Genre; label: string }> = [
  { value: "horror", label: "Аймшиг" },
  { value: "thriller", label: "Триллер" },
  { value: "mystery", label: "Нууцлаг" },
  { value: "romance", label: "Хайр дурлал" },
  { value: "other", label: "Бусад" },
];

export function genreLabel(g: string): string {
  return GENRES.find((x) => x.value === g)?.label ?? "Бусад";
}

export function isGenre(v: unknown): v is Genre {
  return GENRES.some((g) => g.value === v);
}

export const AGE_LABEL: Record<AgeRating, string> = { all: "Бүх нас", "16": "16+", "18": "18+" };

export function ageLabel(a: string): string {
  return AGE_LABEL[a as AgeRating] ?? a;
}
