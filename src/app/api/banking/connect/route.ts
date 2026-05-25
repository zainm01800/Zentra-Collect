/**
 * GET /api/banking/connect
 *
 * Initiates the TrueLayer OAuth flow:
 *   1. Generates a random CSRF state and stores it in a short-lived cookie.
 *   2. Redirects the user to the TrueLayer authorisation page.
 *
 * The user must be authenticated with Supabase before connecting a bank.
 */

import { randomBytes }  from "crypto";
import { NextResponse } from "next/server";
import { getAuthorizationUrl }                  from "@/lib/truelayer/client";
import {
  createSupabaseServerClient,
  hasSupabaseServerConfig,
} from "@/lib/supabase/server";

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

  // ── Generate CSRF state ───────────────────────────────────────────────────
  const state = randomBytes(16).toString("hex");

  // ── Build redirect URL and go ─────────────────────────────────────────────
  const redirectUri = new URL("/api/banking/callback", req.url).toString();
  const authUrl     = getAuthorizationUrl(redirectUri, state);

  // Attach the state cookie directly to the redirect response — more reliable
  // than cookies().set() + redirect() in Next.js App Router Route Handlers.
  const response = NextResponse.redirect(authUrl);
  response.cookies.set("tl_oauth_state", state, {
    httpOnly: true,
    secure:   true,
    sameSite: "lax",
    maxAge:   600, // 10 minutes
    path:     "/",
  });

  return response;
}
