/**
 * GET /api/integrations/gocardless/callback
 *
 * GoCardless redirects here after the user authorises. Steps:
 *   1. Verify CSRF state matches the cookie
 *   2. Exchange code for tokens (response includes organisation_id)
 *   3. Save the connection keyed by organisationId
 *   4. Redirect to /settings/integrations
 */

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  exchangeCode,
  isGoCardlessConfigured,
} from "@/lib/integrations/gocardless/client";
import {
  getActiveAccountId,
  saveConnection,
} from "@/lib/integrations/oauth-store";

const STATE_COOKIE = "gc_oauth_state";

export async function GET(req: Request) {
  const url   = new URL(req.url);
  const code  = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    const msg = url.searchParams.get("error_description") ?? error;
    return NextResponse.redirect(
      new URL(`/settings/integrations?error=${encodeURIComponent(msg)}`, req.url),
    );
  }

  if (!code || !state || !isGoCardlessConfigured()) {
    return NextResponse.redirect(
      new URL("/settings/integrations?error=missing_params", req.url),
    );
  }

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
    process.env.GC_REDIRECT_URI ??
    new URL("/api/integrations/gocardless/callback", req.url).toString();

  let tokens;
  try {
    tokens = await exchangeCode(code, redirectUri);
  } catch (err) {
    console.error("[gocardless/callback] token exchange failed:", err);
    return NextResponse.redirect(
      new URL("/settings/integrations?error=token_exchange_failed", req.url),
    );
  }

  try {
    await saveConnection({
      accountId,
      provider:         "gocardless",
      providerTenantId: tokens.organisationId || "default",
      accessToken:      tokens.accessToken,
      refreshToken:     tokens.refreshToken,
      scopes:           tokens.scope.split(" "),
      expiresAt:        new Date(Date.now() + tokens.expiresIn * 1000),
      tenantName:       "GoCardless",
    });
  } catch (err) {
    console.error("[gocardless/callback] saveConnection failed:", err);
    return NextResponse.redirect(
      new URL("/settings/integrations?error=save_failed", req.url),
    );
  }

  return NextResponse.redirect(
    new URL("/settings/integrations?connected=gocardless", req.url),
  );
}
