/**
 * src/lib/truelayer/client.ts
 *
 * Thin wrapper around TrueLayer's Data API and Auth endpoints.
 *
 * Environment variables required in production:
 *   TRUELAYER_CLIENT_ID       — app client ID from the TrueLayer console
 *   TRUELAYER_CLIENT_SECRET   — app client secret
 *   TRUELAYER_ENV             — "production" | "sandbox" (default: "sandbox")
 *
 * In sandbox mode all requests go to *.truelayer-sandbox.com so you can
 * test with TrueLayer's mock bank credentials without touching real banks.
 */

const isSandbox = process.env.TRUELAYER_ENV !== "production";

const AUTH_BASE = isSandbox
  ? "https://auth.truelayer-sandbox.com"
  : "https://auth.truelayer.com";

const DATA_BASE = isSandbox
  ? "https://api.truelayer-sandbox.com"
  : "https://api.truelayer.com";

/** Scopes requested during OAuth. offline_access enables refresh tokens. */
const SCOPES = "accounts transactions balance offline_access";

// ── Auth URL ─────────────────────────────────────────────────────────────────

/**
 * Build the TrueLayer authorisation URL to redirect the user to.
 * The `state` should be a CSRF token stored in a short-lived cookie.
 */
export function getAuthorizationUrl(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id:     process.env.TRUELAYER_CLIENT_ID ?? "",
    scope:         SCOPES,
    redirect_uri:  redirectUri,
    state,
    // All UK Open Banking + OAuth-enabled providers
    providers:     "uk-ob-all uk-oauth-all",
  });
  return `${AUTH_BASE}/?${params}`;
}

// ── Token exchange ────────────────────────────────────────────────────────────

export interface TLTokens {
  access_token:  string;
  refresh_token: string;
  expires_in:    number;  // seconds
  token_type:    string;
}

export async function exchangeCode(
  code:        string,
  redirectUri: string,
): Promise<TLTokens> {
  const res = await fetch(`${AUTH_BASE}/connect/token`, {
    method:  "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body:    new URLSearchParams({
      grant_type:    "authorization_code",
      client_id:     process.env.TRUELAYER_CLIENT_ID     ?? "",
      client_secret: process.env.TRUELAYER_CLIENT_SECRET ?? "",
      code,
      redirect_uri:  redirectUri,
    }).toString(),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`TrueLayer code exchange failed (${res.status}): ${body}`);
  }

  return res.json() as Promise<TLTokens>;
}

export async function refreshTokens(refreshToken: string): Promise<TLTokens> {
  const res = await fetch(`${AUTH_BASE}/connect/token`, {
    method:  "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body:    new URLSearchParams({
      grant_type:    "refresh_token",
      client_id:     process.env.TRUELAYER_CLIENT_ID     ?? "",
      client_secret: process.env.TRUELAYER_CLIENT_SECRET ?? "",
      refresh_token: refreshToken,
    }).toString(),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`TrueLayer token refresh failed (${res.status}): ${body}`);
  }

  return res.json() as Promise<TLTokens>;
}

// ── Accounts ─────────────────────────────────────────────────────────────────

export interface TLAccount {
  account_id:     string;
  account_type:   string;    // "TRANSACTION", "SAVINGS", etc.
  display_name:   string;
  currency:       string;
  account_number: {
    iban?:      string;
    number?:    string;
    sort_code?: string;
  };
  provider: {
    provider_id:   string;
    display_name:  string;
    logo_uri?:     string;
  };
}

export async function getAccounts(accessToken: string): Promise<TLAccount[]> {
  const res = await fetch(`${DATA_BASE}/data/v1/accounts`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache:   "no-store",
  });

  if (!res.ok) {
    throw new Error(`TrueLayer getAccounts failed: ${res.status}`);
  }

  const body = (await res.json()) as { results: TLAccount[] };
  return body.results ?? [];
}

// ── Transactions ──────────────────────────────────────────────────────────────

export interface TLTransaction {
  transaction_id:    string;
  timestamp:         string;  // ISO 8601
  description:       string;
  transaction_type:  "CREDIT" | "DEBIT";
  transaction_category: string;
  /** Always positive; check transaction_type for direction. */
  amount:            number;
  currency:          string;
  merchant_name?:    string;
  meta?:             Record<string, string>;
}

export async function getTransactions(
  accessToken: string,
  accountId:   string,
  from:        Date,
  to:          Date,
): Promise<TLTransaction[]> {
  const params = new URLSearchParams({
    from: from.toISOString(),
    to:   to.toISOString(),
  });

  const res = await fetch(
    `${DATA_BASE}/data/v1/accounts/${accountId}/transactions?${params}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache:   "no-store",
    },
  );

  if (!res.ok) {
    throw new Error(`TrueLayer getTransactions failed: ${res.status}`);
  }

  const body = (await res.json()) as { results: TLTransaction[] };
  return body.results ?? [];
}
