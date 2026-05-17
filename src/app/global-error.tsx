"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ background: "#fbf8f1", color: "#1d1813", fontFamily: "sans-serif", display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", margin: 0 }}>
        <div style={{ textAlign: "center", padding: "0 16px" }}>
          <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "#8d8472", marginBottom: 16 }}>Zentra Collect</p>
          <h1 style={{ fontSize: 28, fontWeight: 700, margin: "0 0 12px" }}>Something went wrong</h1>
          <p style={{ fontSize: 15, color: "#6b6253", marginBottom: 28 }}>
            An unexpected error occurred. Refresh the page or try again.
          </p>
          <button
            onClick={reset}
            style={{ background: "#1d1813", color: "#fbf8f1", border: "none", borderRadius: 100, padding: "12px 28px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
