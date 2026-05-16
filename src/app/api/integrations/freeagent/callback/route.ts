/**
 * GET /api/integrations/freeagent/callback
 *
 * FreeAgent redirects here after the user authorises. Verifies state,
 * exchanges the code for tokens, fetches the company name for display,
 * persists the connection.
 */

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  exchangeCode,
  fetchCompanyName,
  isFreeAgentConfigured,
} from "@/lib/integrations/freeagent/client";
import {
  getActiveAccountId,
  saveConnection,
} from "@/lib/integrations/oauth-store";

const STATE_COOKIE = "fa_oauth_state";

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
  if (!code || !state || !isFreeAgentConfigured()) {
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
    process.env.FREEAGENT_REDIRECT_URI ??
    new URL("/api/integrations/freeagent/callback", req.url).toString();

  let tokens;
  try {
    tokens = await exchangeCode(code, redirectUri);
  } catch (err) {
    console.error("[freeagent/callback] token exchange failed:", err);
    return NextResponse.redirect(
      new URL("/settings/integrations?error=token_exchange_failed", req.url),
    );
  }

  // Best-effort company name for the tenant label
  let companyName: string | null = null;
  try {
    companyName = await fetchCompanyName(tokens.accessToken);
  } catch {
    /* ignore — fall back to "FreeAgent" */
  }

  try {
    await saveConnection({
      accountId,
      provider:         "freeagent",
      providerTenantId: accountId, // FreeAgent OAuth is per-account, no tenant id
      accessToken:      tokens.accessToken,
      refreshToken:     tokens.refreshToken,
      scopes:           [],
      expiresAt:        new Date(Date.now() + tokens.expiresIn * 1000),
      tenantName:       companyName ?? "FreeAgent",
    });
  } catch (err) {
    console.error("[freeagent/callback] saveConnection failed:", err);
    return NextResponse.redirect(
      new URL("/settings/integrations?error=save_failed", req.url),
    );
  }

  return NextResponse.redirect(
    new URL("/settings/integrations?connected=freeagent", req.url),
  );
}
