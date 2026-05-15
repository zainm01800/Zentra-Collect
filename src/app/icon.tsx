/**
 * App icon — auto-served at /icon.png by Next.js.
 * Used as the 192×192 and 512×512 PWA icon fallback.
 * Also referenced in manifest.json as /icon-192.png and /icon-512.png via
 * the generate-icons script (scripts/generate-icons.mjs).
 */
import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 512,
          height: 512,
          background: "#efe7d6",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            fontFamily: "serif",
            fontSize: 320,
            fontWeight: 700,
            color: "#1d1813",
            lineHeight: 1,
            letterSpacing: "-12px",
          }}
        >
          Z
        </div>
      </div>
    ),
    { ...size },
  );
}
