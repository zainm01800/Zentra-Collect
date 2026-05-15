/**
 * Xero OAuth 2.0 client + invoice API.
 *
 * Endpoints:
 *   - Authorize:      https://login.xero.com/identity/connect/authorize
 *   - Token exchange: https://identity.xero.com/connect/token
 *   - Connections:    https://api.xero.com/connections
 *   - Invoices:       https://api.xero.com/api.xro/2.0/Invoices
 *
 * Auth:
 *   - Uses HTTP Basic with client_id:client_secret for token exchange/refresh
 *   - Bearer token + Xero-Tenant-Id header for API calls
 *
 * Notes:
 *   - Access tokens expire after 30 minutes
 *   - Refresh tokens are ROTATING — every refresh returns a NEW refresh
 *     token that must be stored. Old one is invalidated.
 *   - Refresh tokens themselves expire after 60 days of inactivity.
 */

import {
  isTokenExpired,
  readConnection,
  updateTokens,
  type StoredConnection,
} from "@/lib/integrations/oauth-store";

// ── Config ────────────────────────────────────────────────────────────────────

const XERO_AUTHORIZE_URL = "https://login.xero.com/identity/connect/authorize";
const XERO_TOKEN_URL     = "https://identity.xero.com/connect/token";
const XERO_CONNECTIONS_URL = "https://api.xero.com/connections";
const XERO_API_BASE      = "https://api.xero.com/api.xro/2.0";

export const XERO_SCOPES = [
  "openid",
  "profile",
  "email",
  "accounting.transactions.read",
  "accounting.contacts.read",
  "accounting.settings.read",
  "offline_access", // required for refresh tokens
];

export function isXeroConfigured(): boolean {
  return Boolean(process.env.XERO_CLIENT_ID && process.env.XERO_CLIENT_SECRET);
}

function requireConfig() {
  if (!isXeroConfigured()) {
    throw new Error(
      "Xero is not configured. Set XERO_CLIENT_ID and XERO_CLIENT_SECRET in .env.local.",
    );
  }
  return {
    clientId:     process.env.XERO_CLIENT_ID!,
    clientSecret: process.env.XERO_CLIENT_SECRET!,
  };
}

// ── OAuth flow ────────────────────────────────────────────────────────────────

/** Build the authorize URL the user is redirected to. `state` is a CSRF token. */
export function buildAuthorizeUrl(redirectUri: string, state: string): string {
  const { clientId } = requireConfig();
  const params = new URLSearchParams({
    response_type: "code",
    client_id:     clientId,
    redirect_uri:  redirectUri,
    scope:         XERO_SCOPES.join(" "),
    state,
  });
  return `${XERO_AUTHORIZE_URL}?${params.toString()}`;
}

export interface XeroTokens {
  accessToken:  string;
  refreshToken: string;
  expiresIn:    number; // seconds
  scope:        string;
  tokenType:    string;
}

/** Exchange an authorization code for tokens (step after redirect). */
export async function exchangeCode(
  code:        string,
  redirectUri: string,
): Promise<XeroTokens> {
  const { clientId, clientSecret } = requireConfig();
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const response = await fetch(XERO_TOKEN_URL, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${basic}`,
      "Content-Type":  "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type:   "authorization_code",
      code,
      redirect_uri: redirectUri,
    }).toString(),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Xero token exchange failed (${response.status}): ${errText}`);
  }

  const data = await response.json();
  return {
    accessToken:  data.access_token,
    refreshToken: data.refresh_token,
    expiresIn:    data.expires_in,
    scope:        data.scope,
    tokenType:    data.token_type,
  };
}

/** Use a refresh token to get a new access + refresh token pair. */
export async function refreshTokens(refreshToken: string): Promise<XeroTokens> {
  const { clientId, clientSecret } = requireConfig();
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const response = await fetch(XERO_TOKEN_URL, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${basic}`,
      "Content-Type":  "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type:    "refresh_token",
      refresh_token: refreshToken,
    }).toString(),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Xero token refresh failed (${response.status}): ${errText}`);
  }

  const data = await response.json();
  return {
    accessToken:  data.access_token,
    refreshToken: data.refresh_token,
    expiresIn:    data.expires_in,
    scope:        data.scope,
    tokenType:    data.token_type,
  };
}

// ── Connected organisations (tenants) ─────────────────────────────────────────

export interface XeroConnection {
  id:           string;
  tenantId:     string;
  tenantName:   string;
  tenantType:   string;
}

/** Fetch the list of orgs the user has authorised this app to access. */
export async function getConnections(accessToken: string): Promise<XeroConnection[]> {
  const response = await fetch(XERO_CONNECTIONS_URL, {
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Accept":        "application/json",
    },
  });
  if (!response.ok) {
    throw new Error(`Xero /connections failed (${response.status})`);
  }
  const data = await response.json();
  return (data ?? []).map((c: { id: string; tenantId: string; tenantName: string; tenantType: string }) => ({
    id:         c.id,
    tenantId:   c.tenantId,
    tenantName: c.tenantName,
    tenantType: c.tenantType,
  }));
}

// ── Access-token middleware: refresh-if-needed before any API call ───────────

/**
 * Get a valid access token for the given stored connection. Refreshes if the
 * current token is expired (or within 60s of expiry). Persists the rotated
 * refresh token back to the store.
 */
async function getFreshAccessToken(connection: StoredConnection): Promise<string> {
  if (!isTokenExpired(connection)) return connection.accessToken;

  const refreshed = await refreshTokens(connection.refreshToken);
  const newExpiresAt = new Date(Date.now() + refreshed.expiresIn * 1000);
  await updateTokens(
    connection.id,
    refreshed.accessToken,
    refreshed.refreshToken,
    newExpiresAt,
  );
  return refreshed.accessToken;
}

// ── Xero invoice schema (subset we use) ───────────────────────────────────────

export interface XeroInvoice {
  InvoiceID:        string;
  InvoiceNumber?:   string;
  Type:             "ACCREC" | "ACCPAY";
  Contact:          {
    ContactID:    string;
    Name:         string;
    EmailAddress?: string;
  };
  Date:             string; // /Date(timestamp)/ or YYYY-MM-DD
  DueDate?:         string;
  Status:           "DRAFT" | "SUBMITTED" | "AUTHORISED" | "PAID" | "VOIDED" | "DELETED";
  CurrencyCode:     string;
  Total:            number;
  AmountDue:        number;
  AmountPaid:       number;
  Reference?:       string;
}

// ── Invoice fetching ─────────────────────────────────────────────────────────

export interface FetchInvoicesOptions {
  /** Defaults to AUTHORISED — outstanding AR. */
  statuses?: Array<"AUTHORISED" | "SUBMITTED" | "PAID">;
  pageSize?: number;
}

/**
 * Fetch all outstanding invoices for a tenant. Paginates server-side until
 * exhausted. Returns the raw XeroInvoice[] for the caller to map.
 */
export async function fetchInvoices(
  accountId:        string,
  tenantId:         string,
  options:          FetchInvoicesOptions = {},
): Promise<XeroInvoice[]> {
  const connection = await readConnection(accountId, "xero");
  if (!connection) {
    throw new Error("No Xero connection found for this account.");
  }
  if (connection.providerTenantId && connection.providerTenantId !== tenantId) {
    // The user's stored connection is for a different tenant.
    throw new Error("Tenant mismatch.");
  }

  const accessToken = await getFreshAccessToken(connection);
  const statuses = options.statuses ?? ["AUTHORISED"];
  const where = `Status=="${statuses.join('"%20OR%20Status=="')}"`;
  const all: XeroInvoice[] = [];

  let page = 1;
  while (true) {
    const url =
      `${XERO_API_BASE}/Invoices?where=${where}` +
      `&Types=ACCREC` + // receivables only (skip bills)
      `&page=${page}` +
      `&pageSize=${options.pageSize ?? 100}`;

    const response = await fetch(url, {
      headers: {
        "Authorization":   `Bearer ${accessToken}`,
        "Xero-Tenant-Id":  tenantId,
        "Accept":          "application/json",
      },
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Xero invoice fetch failed (${response.status}): ${errText}`);
    }

    const data = await response.json();
    const items = (data.Invoices ?? []) as XeroInvoice[];
    all.push(...items);

    if (items.length < (options.pageSize ?? 100)) break;
    page += 1;
    if (page > 50) break; // hard safety cap: 5,000 invoices
  }

  return all;
}
