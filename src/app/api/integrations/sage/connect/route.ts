/**
 * GET /api/integrations/sage/connect
 *
 * Initiates Sage Business Cloud Accounting OAuth flow.
 */

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import {
  buildAuthorizeUrl,
  isSageConfigured,
} from "@/lib/integrations/sage/client";
import { getActiveAccountId } from "@/lib/integrations/oauth-store";

const STATE_COOKIE = "sage_oauth_state";

export async function GET(req: Request) {
  if (!isSageConfigured()) {
    return NextResponse.redirect(
      new URL("/settings/integrations?error=sage_not_configured", req.url),
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
    process.env.SAGE_REDIRECT_URI ??
    new URL("/api/integrations/sage/callback", req.url).toString();

  return NextResponse.redirect(buildAuthorizeUrl(redirectUri, state));
}
