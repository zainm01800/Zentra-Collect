/**
 * QuickBooks Online OAuth 2.0 client + invoice API.
 *
 * Endpoints:
 *   - Authorize:      https://appcenter.intuit.com/connect/oauth2
 *   - Token exchange: https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer
 *   - API:            https://quickbooks.api.intuit.com/v3/company/{realmId}
 *                     (sandbox uses https://sandbox-quickbooks.api.intuit.com)
 *
 * Auth:
 *   - Basic auth with client_id:client_secret for token exchange
 *   - Bearer token for API calls; realmId in URL path (NOT a header)
 *
 * Differences from Xero worth noting:
 *   - Refresh tokens DON'T rotate by default — same one used every refresh
 *     until QB ages it out (after 100 days of non-use).
 *   - The "tenant" concept is called "realmId" or "Company ID"
 *   - Discovery is via the OAuth state — realmId comes back as a URL param
 */

import {
  isTokenExpired,
  readConnection,
  updateTokens,
  type StoredConnection,
} from "@/lib/integrations/oauth-store";

// ── Config ────────────────────────────────────────────────────────────────────

const QB_AUTHORIZE_URL = "https://appcenter.intuit.com/connect/oauth2";
const QB_TOKEN_URL     = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";
const QB_API_PRODUCTION = "https://quickbooks.api.intuit.com/v3/company";
const QB_API_SANDBOX   = "https://sandbox-quickbooks.api.intuit.com/v3/company";

export const QB_SCOPES = [
  "com.intuit.quickbooks.accounting",
  "openid",
  "profile",
  "email",
];

export function isQuickBooksConfigured(): boolean {
  return Boolean(process.env.QUICKBOOKS_CLIENT_ID && process.env.QUICKBOOKS_CLIENT_SECRET);
}

function requireConfig() {
  if (!isQuickBooksConfigured()) {
    throw new Error(
      "QuickBooks is not configured. Set QUICKBOOKS_CLIENT_ID and QUICKBOOKS_CLIENT_SECRET in .env.local.",
    );
  }
  return {
    clientId:     process.env.QUICKBOOKS_CLIENT_ID!,
    clientSecret: process.env.QUICKBOOKS_CLIENT_SECRET!,
    sandbox:      process.env.QUICKBOOKS_SANDBOX === "true",
  };
}

function apiBase(): string {
  return requireConfig().sandbox ? QB_API_SANDBOX : QB_API_PRODUCTION;
}

// ── OAuth flow ────────────────────────────────────────────────────────────────

export function buildAuthorizeUrl(redirectUri: string, state: string): string {
  const { clientId } = requireConfig();
  const params = new URLSearchParams({
    client_id:     clientId,
    response_type: "code",
    scope:         QB_SCOPES.join(" "),
    redirect_uri:  redirectUri,
    state,
  });
  return `${QB_AUTHORIZE_URL}?${params.toString()}`;
}

export interface QBTokens {
  accessToken:  string;
  refreshToken: string;
  expiresIn:    number;
  refreshExpiresIn: number;
  tokenType:    string;
}

export async function exchangeCode(
  code:        string,
  redirectUri: string,
): Promise<QBTokens> {
  const { clientId, clientSecret } = requireConfig();
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const response = await fetch(QB_TOKEN_URL, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${basic}`,
      "Content-Type":  "application/x-www-form-urlencoded",
      "Accept":        "application/json",
    },
    body: new URLSearchParams({
      grant_type:   "authorization_code",
      code,
      redirect_uri: redirectUri,
    }).toString(),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`QuickBooks token exchange failed (${response.status}): ${errText}`);
  }

  const data = await response.json();
  return {
    accessToken:      data.access_token,
    refreshToken:     data.refresh_token,
    expiresIn:        data.expires_in,
    refreshExpiresIn: data.x_refresh_token_expires_in,
    tokenType:        data.token_type,
  };
}

export async function refreshTokens(refreshToken: string): Promise<QBTokens> {
  const { clientId, clientSecret } = requireConfig();
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const response = await fetch(QB_TOKEN_URL, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${basic}`,
      "Content-Type":  "application/x-www-form-urlencoded",
      "Accept":        "application/json",
    },
    body: new URLSearchParams({
      grant_type:    "refresh_token",
      refresh_token: refreshToken,
    }).toString(),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`QuickBooks token refresh failed (${response.status}): ${errText}`);
  }

  const data = await response.json();
  return {
    accessToken:      data.access_token,
    refreshToken:     data.refresh_token, // same token returned unless near expiry
    expiresIn:        data.expires_in,
    refreshExpiresIn: data.x_refresh_token_expires_in,
    tokenType:        data.token_type,
  };
}

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

// ── QuickBooks invoice schema (subset we use) ─────────────────────────────────

export interface QBInvoice {
  Id:             string;
  DocNumber?:     string;
  TxnDate:        string;       // YYYY-MM-DD
  DueDate?:       string;
  CustomerRef:    { value: string; name?: string };
  BillEmail?:     { Address?: string };
  TotalAmt:       number;
  Balance:        number;
  CurrencyRef:    { value: string };
}

export interface QBInvoiceQueryResponse {
  QueryResponse: {
    Invoice?:    QBInvoice[];
    startPosition?: number;
    maxResults?: number;
    totalCount?: number;
  };
  time:          string;
}

// ── Invoice fetching ─────────────────────────────────────────────────────────

export interface FetchInvoicesOptions {
  /** Skip fully-paid invoices. Default: true. */
  outstandingOnly?: boolean;
  pageSize?: number;
}

/**
 * Fetch invoices for a QuickBooks Company. Returns all outstanding by default.
 * Paginates via startPosition.
 */
export async function fetchInvoices(
  accountId: string,
  realmId:   string,
  options:   FetchInvoicesOptions = {},
): Promise<QBInvoice[]> {
  const connection = await readConnection(accountId, "quickbooks");
  if (!connection) {
    throw new Error("No QuickBooks connection found for this account.");
  }
  if (connection.providerTenantId && connection.providerTenantId !== realmId) {
    throw new Error("Realm mismatch.");
  }

  const accessToken = await getFreshAccessToken(connection);
  const pageSize    = options.pageSize ?? 100;
  const outstanding = options.outstandingOnly !== false;
  const all: QBInvoice[] = [];

  let startPosition = 1;
  while (true) {
    const where = outstanding ? ` WHERE Balance > '0'` : "";
    const query = `SELECT * FROM Invoice${where} STARTPOSITION ${startPosition} MAXRESULTS ${pageSize}`;
    const url   = `${apiBase()}/${realmId}/query?query=${encodeURIComponent(query)}&minorversion=70`;

    const response = await fetch(url, {
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Accept":        "application/json",
      },
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`QuickBooks invoice fetch failed (${response.status}): ${errText}`);
    }

    const data = (await response.json()) as QBInvoiceQueryResponse;
    const items = data.QueryResponse?.Invoice ?? [];
    all.push(...items);

    if (items.length < pageSize) break;
    startPosition += items.length;
    if (startPosition > 5000) break; // safety cap
  }

  return all;
}
