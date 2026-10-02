import type { ComponentPropsWithoutRef, ReactNode } from "react";

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/* -------------------------------------------------------------------------- */
/* Buttons: one look shared by <button>, <Link> and <a>.                       */
/* -------------------------------------------------------------------------- */

export type ButtonVariant = "primary" | "secondary" | "quiet";
export type ButtonSize = "md" | "sm";

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-sans font-medium select-none " +
  "transition-colors duration-[var(--duration-fast)] disabled:opacity-50 disabled:pointer-events-none " +
  "aria-disabled:opacity-50 aria-disabled:pointer-events-none";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-fill text-fill-ink hover:opacity-90",
  secondary: "border border-field text-ink bg-transparent hover:bg-surface",
  quiet: "text-accent underline-offset-4 hover:underline",
};

const sizes: Record<ButtonSize, string> = {
  md: "min-h-12 px-5 text-base",
  sm: "min-h-11 px-4 text-sm",
};

export function buttonClass(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  extra?: string,
): string {
  return cx(base, variants[variant], sizes[size], extra);
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  type = "button",
  ...props
}: ComponentPropsWithoutRef<"button"> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <button type={type} className={buttonClass(variant, size, className)} {...props} />;
}

/* -------------------------------------------------------------------------- */
/* Form fields                                                                 */
/* -------------------------------------------------------------------------- */

export const fieldClass =
  "block w-full min-h-12 rounded-sm border border-field bg-surface px-3 text-base text-ink " +
  "placeholder:text-muted focus:outline-2 focus:outline-offset-0 focus:outline-[var(--zg-focus)]";

export function Field({
  label,
  hint,
  error,
  children,
  htmlFor,
}: {
  label: string;
  hint?: ReactNode;
  error?: ReactNode;
  children: ReactNode;
  htmlFor: string;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-ink">
        {label}
      </label>
      {children}
      {hint && !error ? <p className="text-sm text-muted">{hint}</p> : null}
      {error ? (
        <p className="text-sm text-accent" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Covers: a cover image when there is one, otherwise the genre's line art.     */
/* -------------------------------------------------------------------------- */

export function Cover({
  title,
  genre = "other",
  src,
  className,
  priority = false,
}: {
  title: string;
  genre?: string;
  src?: string | null;
  className?: string;
  /** Kept for callers that still pass the old placeholder colour. */
  color?: string;
  size?: "sm" | "md" | "lg";
  priority?: boolean;
}) {
  if (src) {
    return (
      <div className={cx("relative aspect-[3/4] overflow-hidden rounded-sm bg-surface", className)}>
        {/* eslint-disable-next-line @next/next/no-img-element -- remote covers, sized by aspect box */}
        <img
          src={src}
          alt=""
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover"
        />
      </div>
    );
  }
  return (
    <div className={cx("relative flex aspect-[3/4] items-center justify-center text-ink", className)} title={title}>
      <GenreArt genre={genre} className="h-full w-full" />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Small pieces                                                                */
/* -------------------------------------------------------------------------- */

export function Rule({ className }: { className?: string }) {
  return <hr className={cx("border-0 border-t border-line", className)} />;
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-baseline justify-between gap-4">
      <h2 className="font-display text-xl font-semibold tracking-tight text-ink">{children}</h2>
      {action}
    </div>
  );
}

export function Notice({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: "neutral" | "accent" | "ok";
  className?: string;
}) {
  return (
    <div
      role={tone === "accent" ? "alert" : "status"}
      className={cx(
        "rounded-sm border px-4 py-3 text-sm",
        tone === "neutral" && "border-line text-muted",
        tone === "accent" && "border-accent/40 text-accent",
        tone === "ok" && "border-ok/40 text-ok",
        className,
      )}
    >
      {children}
    </div>
  );
}

/* Minimal stroke icons (24px grid, 1.5 stroke). Only where they carry meaning. */
type IconProps = { className?: string; title?: string };
function Svg({ className, title, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cx("h-5 w-5 shrink-0", className)}
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

export const Icon = {
  Lock: (p: IconProps) => (
    <Svg {...p}>
      <rect x="5" y="11" width="14" height="9" rx="1.5" />
      <path d="M8 11V8a4 4 0 1 1 8 0v3" />
    </Svg>
  ),
  Home: (p: IconProps) => (
    <Svg {...p}>
      <path d="M4 10.5 12 4l8 6.5V20h-5v-5H9v5H4z" />
    </Svg>
  ),
  Books: (p: IconProps) => (
    <Svg {...p}>
      <path d="M5 4h4v16H5zM11 4h4v16h-4z" />
      <path d="m17 5 3.5 1-3.5 14" />
    </Svg>
  ),
  User: (p: IconProps) => (
    <Svg {...p}>
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M5 20c1.2-3.5 3.8-5 7-5s5.8 1.5 7 5" />
    </Svg>
  ),
  Back: (p: IconProps) => (
    <Svg {...p}>
      <path d="M15 5l-7 7 7 7" />
    </Svg>
  ),
  Close: (p: IconProps) => (
    <Svg {...p}>
      <path d="M6 6l12 12M18 6 6 18" />
    </Svg>
  ),
  Copy: (p: IconProps) => (
    <Svg {...p}>
      <rect x="8" y="8" width="12" height="12" rx="1.5" />
      <path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8" />
    </Svg>
  ),
  Check: (p: IconProps) => (
    <Svg {...p}>
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </Svg>
  ),
  Type: (p: IconProps) => (
    <Svg {...p}>
      <path d="M4 18 9 6l5 12M5.8 14h6.4M15 18l2.8-7 2.7 7M15.9 16h3.8" />
    </Svg>
  ),
  Search: (p: IconProps) => (
    <Svg {...p}>
      <circle cx="11" cy="11" r="6" />
      <path d="m20 20-4.5-4.5" />
    </Svg>
  ),
};

export * from "./illustrations";
import { GenreArt } from "./illustrations";
