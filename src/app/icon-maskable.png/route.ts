/**
 * GET /icon-maskable.png
 *
 * 512×512 maskable icon for Android adaptive icons.
 *
 * Android crops the icon into circle / squircle / rounded-square shapes
 * depending on launcher. The meaningful content sits inside the centre
 * "safe zone" (80% of the canvas) and the rest is full-bleed brand
 * colour so the crop never reveals a transparent edge.
 *
 * Uses React.createElement so this stays a plain .ts route handler.
 */

import { ImageResponse } from "next/og";
import { createElement } from "react";

export const runtime = "edge";

export async function GET() {
  return new ImageResponse(
    createElement(
      "div",
      {
        style: {
          width: 512,
          height: 512,
          background: "#1d1813",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        },
      },
      createElement(
        "div",
        {
          style: {
            fontFamily: "serif",
            fontSize: 280,
            fontStyle: "italic",
            fontWeight: 600,
            color: "#faf5e8",
            lineHeight: 1,
          },
        },
        "Z",
      ),
    ),
    { width: 512, height: 512 },
  );
}
