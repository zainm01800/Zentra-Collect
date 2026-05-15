/**
 * GET /api/integrations/xero/connect
 *
 * Starts the Xero OAuth flow:
 *   1. Verifies the user is signed in
 *   2. Generates a CSRF state token and stores it in an httpOnly cookie
 *   3. Builds the Xero authorize URL and redirects there
 */

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { buildAuthorizeUrl, isXeroConfigured } from "@/lib/integrations/xero/client";
import { getActiveAccountId } from "@/lib/integrations/oauth-store";

const STATE_COOKIE = "xero_oauth_state";

export async function GET(req: Request) {
  if (!isXeroConfigured()) {
    return NextResponse.redirect(
      new URL("/settings/integrations?error=xero_not_configured", req.url),
    );
  }

  const accountId = await getActiveAccountId();
  if (!accountId) {
    return NextResponse.redirect(new URL("/login?next=/settings/integrations", req.url));
  }

  // CSRF state — stored in cookie, sent in query, checked on callback
  const state = randomBytes(32).toString("base64url");
  const cookieJar = await cookies();
  cookieJar.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge:   600, // 10 min
    path:     "/",
  });

  const redirectUri =
    process.env.XERO_REDIRECT_URI ??
    new URL("/api/integrations/xero/callback", req.url).toString();

  return NextResponse.redirect(buildAuthorizeUrl(redirectUri, state));
}
