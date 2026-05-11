/**
 * GET /api/banking/callback
 *
 * TrueLayer OAuth callback:
 *   1. Verifies the state cookie matches the query param (CSRF check).
 *   2. Exchanges the authorisation code for access + refresh tokens.
 *   3. Fetches the user's bank accounts to pick the first one.
 *   4. Stores encrypted tokens in zentra_oauth_connections.
 *   5. Redirects to /banking.
 */

import { cookies }          from "next/headers";
import { NextResponse }     from "next/server";
import {
  exchangeCode,
  getAccounts,
  type TLAccount,
} from "@/lib/truelayer/client";
import {
  encryptPassword as encrypt,
} from "@/lib/email/crypto";
import {
  createSupabaseServerClient,
  hasSupabaseServerConfig,
} from "@/lib/supabase/server";

export async function GET(req: Request) {
  const url    = new URL(req.url);
  const code   = url.searchParams.get("code");
  const state  = url.searchParams.get("state");
  const tlError = url.searchParams.get("error");

  // ── TrueLayer returned an error (user cancelled, etc.) ────────────────────
  if (tlError) {
    const msg = url.searchParams.get("error_description") ?? tlError;
    return NextResponse.redirect(
      new URL(`/banking?error=${encodeURIComponent(msg)}`, req.url),
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL("/banking?error=missing_params", req.url),
    );
  }

  // ── CSRF state check ──────────────────────────────────────────────────────
  const cookieJar    = await cookies();
  const storedState  = cookieJar.get("tl_oauth_state")?.value;

  if (!storedState || storedState !== state) {
    return NextResponse.redirect(
      new URL("/banking?error=state_mismatch", req.url),
    );
  }

  // Clear the state cookie
  cookieJar.delete("tl_oauth_state");

  // ── Auth guard ────────────────────────────────────────────────────────────
  if (!hasSupabaseServerConfig()) {
    return NextResponse.redirect(
      new URL("/banking?error=not_configured", req.url),
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/auth/signin", req.url));
  }

  const { data: member } = await supabase
    .from("zentra_account_members")
    .select("account_id")
    .eq("user_id", user.id)
    .single();

  if (!member) {
    return NextResponse.redirect(
      new URL("/banking?error=no_account", req.url),
    );
  }

  // ── Exchange code for tokens ──────────────────────────────────────────────
  const redirectUri = new URL("/api/banking/callback", req.url).toString();

  let tokens;
  try {
    tokens = await exchangeCode(code, redirectUri);
  } catch (err) {
    console.error("[banking/callback] code exchange failed:", err);
    return NextResponse.redirect(
      new URL("/banking?error=token_exchange_failed", req.url),
    );
  }

  // ── Get accounts — pick the first current/transaction account ─────────────
  let accounts: TLAccount[] = [];
  try {
    accounts = await getAccounts(tokens.access_token);
  } catch (err) {
    console.error("[banking/callback] getAccounts failed:", err);
    // Continue without account details — user can still see transactions
  }

  // Prefer a TRANSACTION type account; fall back to first available
  const primaryAccount =
    accounts.find((a) => a.account_type === "TRANSACTION") ?? accounts[0];

  const bankAccountId   = primaryAccount?.account_id   ?? null;
  const bankAccountName = primaryAccount?.display_name  ?? null;
  const bankProviderName = primaryAccount?.provider?.display_name ?? null;
  const expiresAt       = new Date(
    Date.now() + tokens.expires_in * 1000,
  ).toISOString();

  // ── Store tokens in Supabase ──────────────────────────────────────────────
  const { error: upsertErr } = await supabase
    .from("zentra_oauth_connections")
    .upsert(
      {
        account_id:               member.account_id,
        provider:                 "truelayer",
        provider_tenant_id:       bankAccountId,
        encrypted_access_token:   encrypt(tokens.access_token),
        encrypted_refresh_token:  encrypt(tokens.refresh_token),
        scopes:                   ["accounts", "transactions", "balance", "offline_access"],
        expires_at:               expiresAt,
        bank_account_id:          bankAccountId,
        bank_account_name:        bankAccountName,
        bank_provider_name:       bankProviderName,
        updated_at:               new Date().toISOString(),
      },
      { onConflict: "account_id,provider,provider_tenant_id" },
    );

  if (upsertErr) {
    console.error("[banking/callback] upsert failed:", upsertErr);
    return NextResponse.redirect(
      new URL("/banking?error=save_failed", req.url),
    );
  }

  return NextResponse.redirect(new URL("/banking?connected=1", req.url));
}
