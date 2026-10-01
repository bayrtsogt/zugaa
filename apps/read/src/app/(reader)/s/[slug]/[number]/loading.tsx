/** Instant shell while a chapter loads; also bounds link prefetching to this shell. */
export default function Loading() {
  return (
    <div className="pt-14" aria-busy="true">
      <div className="fixed inset-x-0 top-0 z-30 h-14 border-b border-line bg-paper" />
      <div className="mx-auto px-5 pt-10 sm:px-8" style={{ maxWidth: "calc(var(--zg-read-measure) + 4rem)" }}>
        <p className="text-sm text-muted">Ачааллаж байна…</p>
      </div>
    </div>
  );
}
