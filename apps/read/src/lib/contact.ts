import "server-only";

/** Public contact for privacy / data requests (CONTACT_EMAIL), optional. */
export function contactEmail(): string | null {
  const v = (process.env.CONTACT_EMAIL ?? "").trim();
  return v.includes("@") ? v : null;
}
