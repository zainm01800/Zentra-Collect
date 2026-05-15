/**
 * GET /api/integrations/xero/callback
 *
 * Xero redirects here after the user authorises. Steps:
 *   1. Verify CSRF state cookie matches the `state` param
 *   2. Exchange the code for tokens
 *   3. Fetch the list of connections (which Xero orgs were authorised)
 *   4. Store the tokens against the first connection (most users have one org)
 *   5. Redirect to /settings/integrations with a success flag
 */

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  exchangeCode,
  getConnections,
  isXeroConfigured,
} from "@/lib/integrations/xero/client";
import {
  getActiveAccountId,
  saveConnection,
} from "@/lib/integrations/oauth-store";

const STATE_COOKIE = "xero_oauth_state";

export async function GET(req: Request) {
  const url    = new URL(req.url);
  const code   = url.searchParams.get("code");
  const state  = url.searchParams.get("state");
  const error  = url.searchParams.get("error");

  // User declined / Xero error
  if (error) {
    const msg = url.searchParams.get("error_description") ?? error;
    return NextResponse.redirect(
      new URL(`/settings/integrations?error=${encodeURIComponent(msg)}`, req.url),
    );
  }

  if (!code || !state || !isXeroConfigured()) {
    return NextResponse.redirect(
      new URL("/settings/integrations?error=missing_params", req.url),
    );
  }

  // ── CSRF check ────────────────────────────────────────────────────────────
  const cookieJar  = await cookies();
  const storedState = cookieJar.get(STATE_COOKIE)?.value;
  if (!storedState || storedState !== state) {
    return NextResponse.redirect(
      new URL("/settings/integrations?error=state_mismatch", req.url),
    );
  }
  cookieJar.delete(STATE_COOKIE);

  // ── Auth guard ────────────────────────────────────────────────────────────
  const accountId = await getActiveAccountId();
  if (!accountId) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // ── Exchange code for tokens ──────────────────────────────────────────────
  const redirectUri =
    process.env.XERO_REDIRECT_URI ??
    new URL("/api/integrations/xero/callback", req.url).toString();

  let tokens;
  try {
    tokens = await exchangeCode(code, redirectUri);
  } catch (err) {
    console.error("[xero/callback] token exchange failed:", err);
    return NextResponse.redirect(
      new URL("/settings/integrations?error=token_exchange_failed", req.url),
    );
  }

  // ── Get the connected orgs ────────────────────────────────────────────────
  let connections;
  try {
    connections = await getConnections(tokens.accessToken);
  } catch (err) {
    console.error("[xero/callback] getConnections failed:", err);
    return NextResponse.redirect(
      new URL("/settings/integrations?error=fetch_orgs_failed", req.url),
    );
  }

  if (connections.length === 0) {
    return NextResponse.redirect(
      new URL("/settings/integrations?error=no_xero_org", req.url),
    );
  }

  // ── Store tokens — first org for now (multi-org support is a follow-up) ──
  const primary = connections[0];
  const expiresAt = new Date(Date.now() + tokens.expiresIn * 1000);

  try {
    await saveConnection({
      accountId,
      provider:         "xero",
      providerTenantId: primary.tenantId,
      accessToken:      tokens.accessToken,
      refreshToken:     tokens.refreshToken,
      scopes:           tokens.scope.split(" "),
      expiresAt,
      tenantName:       primary.tenantName,
    });
  } catch (err) {
    console.error("[xero/callback] saveConnection failed:", err);
    return NextResponse.redirect(
      new URL("/settings/integrations?error=save_failed", req.url),
    );
  }

  return NextResponse.redirect(
    new URL("/settings/integrations?connected=xero", req.url),
  );
}
