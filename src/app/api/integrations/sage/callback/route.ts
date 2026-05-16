/**
 * GET /api/integrations/sage/callback
 *
 * Sage redirects here with: code, state. No tenant/realm concept — each
 * connection covers one Sage business.
 */

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  exchangeCode,
  isSageConfigured,
} from "@/lib/integrations/sage/client";
import {
  getActiveAccountId,
  saveConnection,
} from "@/lib/integrations/oauth-store";

const STATE_COOKIE = "sage_oauth_state";

export async function GET(req: Request) {
  const url    = new URL(req.url);
  const code   = url.searchParams.get("code");
  const state  = url.searchParams.get("state");
  const error  = url.searchParams.get("error");

  if (error) {
    const msg = url.searchParams.get("error_description") ?? error;
    return NextResponse.redirect(
      new URL(`/settings/integrations?error=${encodeURIComponent(msg)}`, req.url),
    );
  }

  if (!code || !state || !isSageConfigured()) {
    return NextResponse.redirect(
      new URL("/settings/integrations?error=missing_params", req.url),
    );
  }

  // CSRF check
  const cookieJar  = await cookies();
  const storedState = cookieJar.get(STATE_COOKIE)?.value;
  if (!storedState || storedState !== state) {
    return NextResponse.redirect(
      new URL("/settings/integrations?error=state_mismatch", req.url),
    );
  }
  cookieJar.delete(STATE_COOKIE);

  const accountId = await getActiveAccountId();
  if (!accountId) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const redirectUri =
    process.env.SAGE_REDIRECT_URI ??
    new URL("/api/integrations/sage/callback", req.url).toString();

  let tokens;
  try {
    tokens = await exchangeCode(code, redirectUri);
  } catch (err) {
    console.error("[sage/callback] token exchange failed:", err);
    return NextResponse.redirect(
      new URL("/settings/integrations?error=token_exchange_failed", req.url),
    );
  }

  // Sage doesn't return a tenant — use a synthetic ID derived from the
  // first chars of the access token (consistent for a given connection,
  // but not the user's real Sage business ID — we just need uniqueness).
  // The real business ID can be fetched from /businesses on first sync.
  const tenantId = `sage-${tokens.accessToken.slice(0, 12)}`;
  const expiresAt = new Date(Date.now() + tokens.expiresIn * 1000);
  const tenantName = "Sage Business Cloud";

  try {
    await saveConnection({
      accountId,
      provider:         "sage",
      providerTenantId: tenantId,
      accessToken:      tokens.accessToken,
      refreshToken:     tokens.refreshToken,
      scopes:           ["full_access"],
      expiresAt,
      tenantName,
    });
  } catch (err) {
    console.error("[sage/callback] saveConnection failed:", err);
    return NextResponse.redirect(
      new URL("/settings/integrations?error=save_failed", req.url),
    );
  }

  return NextResponse.redirect(
    new URL("/settings/integrations?connected=sage", req.url),
  );
}
