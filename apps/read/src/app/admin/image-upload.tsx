"use client";
import { useRef, useState } from "react";
import { cx } from "@zugaa/ui";
import { browserClient } from "@/lib/supabase/browser";

const MAX_SIDE = 1600;

/** Downscales to at most MAX_SIDE px and re-encodes as WebP (keeps GIFs as they are). */
async function prepare(file: File): Promise<{ blob: Blob; ext: string }> {
  if (file.type === "image/gif") return { blob: file, ext: "gif" };
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.82));
  if (!blob) throw new Error("encode");
  return { blob, ext: "webp" };
}

/**
 * Admin image field: uploads straight from the browser to the public `media`
 * bucket (storage policies allow admins only) and submits the public URL in a
 * hidden input. A URL can also be pasted.
 */
export function ImageUpload({
  name,
  folder,
  value,
  onChange,
  label,
  aspect = "aspect-[3/2]",
  compact = false,
}: {
  name: string;
  folder: string;
  value: string | null;
  onChange?: (url: string | null) => void;
  label: string;
  aspect?: string;
  compact?: boolean;
}) {
  const [url, setUrl] = useState<string | null>(value);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  function set(next: string | null) {
    setUrl(next);
    onChange?.(next);
  }

  async function upload(file: File | undefined) {
    if (!file) return;
    setError(null);
    if (!file.type.startsWith("image/")) return setError("Зөвхөн зураг оруулна.");
    if (file.size > 20 * 1024 * 1024) return setError("Зураг 20MB-аас их байна.");
    setBusy(true);
    try {
      const { blob, ext } = await prepare(file);
      const path = `${folder}/${crypto.randomUUID()}.${ext}`;
      const supabase = browserClient();
      const { error: upError } = await supabase.storage
        .from("media")
        .upload(path, blob, { contentType: blob.type || file.type, cacheControl: "31536000", upsert: false });
      if (upError) throw upError;
      set(supabase.storage.from("media").getPublicUrl(path).data.publicUrl);
    } catch {
      setError("Зураг хуулж чадсангүй. Дахин оролдоно уу.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className={cx("space-y-2", compact ? "w-28 shrink-0" : "")}>
      <input type="hidden" name={name} value={url ?? ""} />
      <div
        className={cx("relative overflow-hidden rounded-sm border border-dashed border-field bg-surface", aspect)}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          void upload(e.dataTransfer.files[0]);
        }}
      >
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element -- admin preview
          <img src={url} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center p-2 text-center text-xs text-muted">
            {busy ? "Хуулж байна…" : compact ? "Зураг" : "Зураг чирж оруулах эсвэл сонгох"}
          </span>
        )}
        <label className="absolute inset-0 cursor-pointer">
          <span className="sr-only">{label}</span>
          <input
            ref={input}
            type="file"
            accept="image/*"
            className="sr-only"
            disabled={busy}
            data-image-field={name}
            onChange={(e) => void upload(e.target.files?.[0])}
          />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 text-xs">
        {url ? (
          <button type="button" onClick={() => set(null)} className="min-h-8 text-accent">
            Арилгах
          </button>
        ) : null}
        {busy ? <span className="text-muted">Хуулж байна…</span> : null}
      </div>
      {!compact ? (
        <input
          type="url"
          aria-label={`${label} — URL`}
          placeholder="эсвэл https://… хаяг буулгах"
          value={url ?? ""}
          onChange={(e) => set(e.target.value.trim() || null)}
          className="min-h-9 w-full rounded-sm border border-field bg-paper px-2 text-xs"
        />
      ) : null}
      {error ? <p className="text-xs text-accent">{error}</p> : null}
    </div>
  );
}
