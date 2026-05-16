/**
 * GET /api/integrations/gocardless/connect
 *
 * Starts the GoCardless OAuth flow:
 *   1. Verifies the user is signed in
 *   2. Generates a CSRF state token, stores in an httpOnly cookie
 *   3. Redirects to GoCardless's authorize page
 */

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { buildAuthorizeUrl, isGoCardlessConfigured } from "@/lib/integrations/gocardless/client";
import { getActiveAccountId } from "@/lib/integrations/oauth-store";

const STATE_COOKIE = "gc_oauth_state";

export async function GET(req: Request) {
  if (!isGoCardlessConfigured()) {
    return NextResponse.redirect(
      new URL("/settings/integrations?error=gocardless_not_configured", req.url),
    );
  }

  const accountId = await getActiveAccountId();
  if (!accountId) {
    return NextResponse.redirect(new URL("/login?next=/settings/integrations", req.url));
  }

  const state = randomBytes(32).toString("base64url");
  const cookieJar = await cookies();
  cookieJar.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge:   600,
    path:     "/",
  });

  const redirectUri =
    process.env.GC_REDIRECT_URI ??
    new URL("/api/integrations/gocardless/callback", req.url).toString();

  return NextResponse.redirect(buildAuthorizeUrl(redirectUri, state));
}
