/**
 * GET /api/banking/connect
 *
 * Initiates the TrueLayer OAuth flow:
 *   1. Generates a CSRF-safe signed state token (HMAC-SHA256).
 *   2. Redirects the user to the TrueLayer authorisation page.
 *
 * No cookie is used. The state parameter is self-verifying — it embeds a
 * nonce, timestamp, and HMAC so the callback can verify it without any
 * server-side session or cookie. This avoids the SameSite cookie
 * compatibility issues that occur with Monzo's hybrid OAuth flow.
 */

import { randomBytes, createHmac } from "crypto";
import { NextResponse }            from "next/server";
import { getAuthorizationUrl }     from "@/lib/truelayer/client";
import {
  createSupabaseServerClient,
  hasSupabaseServerConfig,
} from "@/lib/supabase/server";

/** Build a signed state token: `nonce.timestamp.hmac` */
export function signState(nonce: string, timestamp: string): string {
  const secret = process.env.TRUELAYER_CLIENT_SECRET ?? "fallback-dev-secret";
  const hmac   = createHmac("sha256", secret)
    .update(`${nonce}:${timestamp}`)
    .digest("hex");
  return `${nonce}.${timestamp}.${hmac}`;
}

export async function GET(req: Request) {
  // ── Auth guard ────────────────────────────────────────────────────────────
  if (hasSupabaseServerConfig()) {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.redirect(new URL("/auth/signin", req.url));
    }
  }

  // ── TrueLayer config guard ────────────────────────────────────────────────
  if (!process.env.TRUELAYER_CLIENT_ID || !process.env.TRUELAYER_CLIENT_SECRET) {
    return NextResponse.redirect(
      new URL("/banking?error=not_configured", req.url),
    );
  }

  // ── Generate self-verifying CSRF state (no cookie needed) ─────────────────
  const nonce     = randomBytes(16).toString("hex");
  const timestamp = Date.now().toString();
  const state     = signState(nonce, timestamp);

  // ── Build redirect URL and go ─────────────────────────────────────────────
  const redirectUri = new URL("/api/banking/callback", req.url).toString();
  const authUrl     = getAuthorizationUrl(redirectUri, state);

  return NextResponse.redirect(authUrl);
}
