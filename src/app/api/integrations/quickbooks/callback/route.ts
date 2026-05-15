/**
 * GET /api/integrations/quickbooks/callback
 *
 * QuickBooks redirects here with: code, state, realmId.
 *   - realmId IS the tenant ID (the QuickBooks Company ID)
 *   - No separate "list connections" call needed — it's already in the URL.
 */

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  exchangeCode,
  isQuickBooksConfigured,
} from "@/lib/integrations/quickbooks/client";
import {
  getActiveAccountId,
  saveConnection,
} from "@/lib/integrations/oauth-store";

const STATE_COOKIE = "qb_oauth_state";

export async function GET(req: Request) {
  const url     = new URL(req.url);
  const code    = url.searchParams.get("code");
  const state   = url.searchParams.get("state");
  const realmId = url.searchParams.get("realmId");
  const error   = url.searchParams.get("error");

  if (error) {
    const msg = url.searchParams.get("error_description") ?? error;
    return NextResponse.redirect(
      new URL(`/settings/integrations?error=${encodeURIComponent(msg)}`, req.url),
    );
  }

  if (!code || !state || !realmId || !isQuickBooksConfigured()) {
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
    process.env.QUICKBOOKS_REDIRECT_URI ??
    new URL("/api/integrations/quickbooks/callback", req.url).toString();

  let tokens;
  try {
    tokens = await exchangeCode(code, redirectUri);
  } catch (err) {
    console.error("[quickbooks/callback] token exchange failed:", err);
    return NextResponse.redirect(
      new URL("/settings/integrations?error=token_exchange_failed", req.url),
    );
  }

  const expiresAt = new Date(Date.now() + tokens.expiresIn * 1000);
  // We can't fetch the org name here without an extra call; use realmId as a
  // placeholder. The UI can fetch the proper name lazily on first sync.
  const tenantName = `QuickBooks ${realmId.slice(-4)}`;

  try {
    await saveConnection({
      accountId,
      provider:         "quickbooks",
      providerTenantId: realmId,
      accessToken:      tokens.accessToken,
      refreshToken:     tokens.refreshToken,
      scopes:           ["com.intuit.quickbooks.accounting"],
      expiresAt,
      tenantName,
    });
  } catch (err) {
    console.error("[quickbooks/callback] saveConnection failed:", err);
    return NextResponse.redirect(
      new URL("/settings/integrations?error=save_failed", req.url),
    );
  }

  return NextResponse.redirect(
    new URL("/settings/integrations?connected=quickbooks", req.url),
  );
}
