/**
 * Apple touch icon — auto-served at /apple-icon.png by Next.js.
 * 180×180 px, brand warm background with bold "Z" mark.
 */
import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 180,
          height: 180,
          background: "#efe7d6",
          borderRadius: 36,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            fontFamily: "serif",
            fontSize: 108,
            fontWeight: 700,
            color: "#1d1813",
            lineHeight: 1,
            letterSpacing: "-4px",
          }}
        >
          Z
        </div>
      </div>
    ),
    { ...size },
  );
}
