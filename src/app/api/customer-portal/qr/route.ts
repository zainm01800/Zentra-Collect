/**
 * GET /api/customer-portal/qr?token=<token>&size=<px>
 *
 * Returns a PNG QR code that points the customer at /pay/<token> on this
 * deployment. Used in chase emails: the user pastes the chase message
 * containing <img src="…/qr?token=…"> and the recipient scans on their
 * phone to pay — no typing a URL.
 *
 * Token is HMAC-verified before rendering. Cache headers are conservative
 * (5 minutes) because the underlying token is long-lived but we still
 * want clients to recheck periodically in case the user disables the
 * portal.
 */

import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { verifyPaymentToken } from "@/lib/customer-portal/token";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function clampSize(raw: string | null): number {
  const n = parseInt(raw ?? "", 10);
  if (!Number.isFinite(n)) return 240;
  return Math.max(80, Math.min(800, n));
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") ?? "";
  const size  = clampSize(url.searchParams.get("size"));

  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  const verified = verifyPaymentToken(token);
  if (!verified.ok) {
    return NextResponse.json({ error: verified.error }, { status: 404 });
  }

  // Encode the *portal URL*, not the raw token — that's what a phone
  // camera should open.
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? url.origin;
  const portalUrl = `${siteUrl.replace(/\/$/, "")}/pay/${token}`;

  try {
    const png = await QRCode.toBuffer(portalUrl, {
      type:         "png",
      errorCorrectionLevel: "M",
      margin:       1,
      width:        size,
      color:        { dark: "#000000", light: "#ffffff" },
    });
    return new NextResponse(new Uint8Array(png), {
      status: 200,
      headers: {
        "Content-Type":  "image/png",
        "Cache-Control": "public, max-age=300, s-maxage=300",
      },
    });
  } catch (err) {
    console.error("[customer-portal/qr]", err);
    return NextResponse.json({ error: "QR generation failed" }, { status: 500 });
  }
}
