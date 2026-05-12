/**
 * Dynamic Open Graph image for the homepage.
 *
 * Convention: Next.js auto-discovers `app/opengraph-image.{tsx,jpg,png}` and
 * serves it as the `og:image` for that route. This file generates a 1200×630
 * PNG at the edge using the bundled `next/og` runtime.
 *
 * It overrides the static `/og.svg` referenced in src/app/layout.tsx for the
 * root path. Other routes will still use that fallback.
 */

import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Zentra Flow — Upload overdue invoices. Get a ranked chase plan.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#efe7d6",
          display: "flex",
          flexDirection: "column",
          padding: "80px",
          fontFamily: "system-ui, -apple-system, sans-serif",
          color: "#1d1813",
        }}
      >
        {/* Brand mark + wordmark */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 12,
              background: "#1d1813",
              color: "#faf5e8",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 36,
              fontWeight: 600,
              fontStyle: "italic",
            }}
          >
            Z
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.01em" }}>Zentra</div>
            <div
              style={{
                fontSize: 11,
                color: "#6b6253",
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                marginTop: 2,
              }}
            >
              Collect
            </div>
          </div>
        </div>

        {/* Kicker */}
        <div
          style={{
            marginTop: 96,
            fontSize: 16,
            color: "#6b6253",
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            display: "flex",
          }}
        >
          Collections decisioning · for UK bookkeepers
        </div>

        {/* Headline */}
        <div
          style={{
            marginTop: 24,
            fontSize: 78,
            lineHeight: 1.05,
            letterSpacing: "-0.02em",
            fontWeight: 500,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <span>Upload overdue invoices.</span>
          <span>Get a ranked chase plan.</span>
        </div>

        {/* Sub */}
        <div
          style={{
            marginTop: 40,
            fontSize: 22,
            color: "#6b6253",
            display: "flex",
          }}
        >
          Action + reason + draft message — you review and send.
        </div>

        {/* Pill */}
        <div
          style={{
            marginTop: "auto",
            display: "flex",
            alignItems: "center",
            gap: 14,
          }}
        >
          <div
            style={{
              padding: "12px 22px",
              borderRadius: 999,
              background: "#1d1813",
              color: "#faf5e8",
              fontSize: 16,
              fontWeight: 500,
              display: "flex",
            }}
          >
            zentracollect.co.uk
          </div>
          <div style={{ fontSize: 14, color: "#8d8472", display: "flex" }}>
            Try the demo · No card required
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
