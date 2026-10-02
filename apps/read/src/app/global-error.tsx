"use client";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="mn">
      <body style={{ background: "#f8f5ef", color: "#1d1a16", fontFamily: "system-ui, sans-serif", padding: "4rem 1rem" }}>
        <main style={{ maxWidth: "42rem", margin: "0 auto" }}>
          <h1>Алдаа гарлаа</h1>
          <p>Хуудсыг ачаалж чадсангүй.</p>
          <button type="button" onClick={reset} style={{ minHeight: 48, padding: "0 20px" }}>
            Дахин оролдох
          </button>
        </main>
      </body>
    </html>
  );
}
