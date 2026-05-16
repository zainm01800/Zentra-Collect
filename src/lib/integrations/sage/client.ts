/**
 * Sage Business Cloud Accounting OAuth 2.0 client + invoice API.
 *
 * Endpoints:
 *   - Authorize:      https://www.sageone.com/oauth2/auth/central
 *   - Token exchange: https://oauth.accounting.sage.com/token
 *   - API:            https://api.accounting.sage.com/v3.1/
 *
 * Token lifetimes:
 *   - Access token:   ~5 minutes (refresh aggressively)
 *   - Refresh token:  60 days
 *
 * Differences vs Xero/QuickBooks:
 *   - URL is /sales_invoices, not /Invoices
 *   - Field names are snake_case (contact_id, due_date, total_amount)
 *   - Customer details come via the `contact` ID expansion (?attributes=all)
 *   - Pagination uses `?items_per_page=N&page=N`
 *   - No tenant concept — each connection is one Sage business
 */

import {
  isTokenExpired,
  readConnection,
  updateTokens,
  type StoredConnection,
} from "@/lib/integrations/oauth-store";

// ── Config ────────────────────────────────────────────────────────────────────

const SAGE_AUTHORIZE_URL = "https://www.sageone.com/oauth2/auth/central";
const SAGE_TOKEN_URL     = "https://oauth.accounting.sage.com/token";
const SAGE_API_BASE      = "https://api.accounting.sage.com/v3.1";

export const SAGE_SCOPES = ["full_access"];

export function isSageConfigured(): boolean {
  return Boolean(process.env.SAGE_CLIENT_ID && process.env.SAGE_CLIENT_SECRET);
}

function requireConfig() {
  if (!isSageConfigured()) {
    throw new Error(
      "Sage is not configured. Set SAGE_CLIENT_ID and SAGE_CLIENT_SECRET in .env.local.",
    );
  }
  return {
    clientId:     process.env.SAGE_CLIENT_ID!,
    clientSecret: process.env.SAGE_CLIENT_SECRET!,
  };
}

// ── OAuth flow ────────────────────────────────────────────────────────────────

export function buildAuthorizeUrl(redirectUri: string, state: string): string {
  const { clientId } = requireConfig();
  const params = new URLSearchParams({
    response_type: "code",
    client_id:     clientId,
    redirect_uri:  redirectUri,
    scope:         SAGE_SCOPES.join(" "),
    state,
    country:       "gb",
    locale:        "en-GB",
  });
  return `${SAGE_AUTHORIZE_URL}?${params.toString()}`;
}

export interface SageTokens {
  accessToken:  string;
  refreshToken: string;
  expiresIn:    number; // seconds
  refreshExpiresIn?: number;
}

export async function exchangeCode(
  code:        string,
  redirectUri: string,
): Promise<SageTokens> {
  const { clientId, clientSecret } = requireConfig();
  const response = await fetch(SAGE_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Accept":       "application/json",
    },
    body: new URLSearchParams({
      grant_type:    "authorization_code",
      client_id:     clientId,
      client_secret: clientSecret,
      code,
      redirect_uri:  redirectUri,
    }).toString(),
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Sage token exchange failed (${response.status}): ${errText}`);
  }
  const data = await response.json();
  return {
    accessToken:      data.access_token,
    refreshToken:     data.refresh_token,
    expiresIn:        data.expires_in,
    refreshExpiresIn: data.refresh_token_expires_in,
  };
}

export async function refreshTokens(refreshToken: string): Promise<SageTokens> {
  const { clientId, clientSecret } = requireConfig();
  const response = await fetch(SAGE_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Accept":       "application/json",
    },
    body: new URLSearchParams({
      grant_type:    "refresh_token",
      client_id:     clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    }).toString(),
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Sage token refresh failed (${response.status}): ${errText}`);
  }
  const data = await response.json();
  return {
    accessToken:      data.access_token,
    refreshToken:     data.refresh_token,
    expiresIn:        data.expires_in,
    refreshExpiresIn: data.refresh_token_expires_in,
  };
}

async function getFreshAccessToken(connection: StoredConnection): Promise<string> {
  // Sage access tokens expire after just 5 minutes — be liberal about refreshing.
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

// ── Sage sales-invoice schema (subset we use) ─────────────────────────────────

export interface SageInvoice {
  id:               string;
  displayed_as:     string;
  contact: {
    id:           string;
    displayed_as: string;
  };
  date:                string; // YYYY-MM-DD
  due_date?:           string;
  total_amount:        number;
  outstanding_amount:  number;
  invoice_number?:     string;
  reference?:          string;
  status: {
    id:           string;
    displayed_as: string; // "Draft" | "Sent" | "Paid" | "Part Paid" | "Void"
  };
  currency?: {
    id: string;
  };
  /** Set when ?attributes=all is used and contact email is available. */
  main_address?: { email?: string };
}

export interface SageContact {
  id:                 string;
  displayed_as:       string;
  email?:             string;
  main_address?:      { email?: string };
}

// ── Invoice fetching ─────────────────────────────────────────────────────────

export interface FetchInvoicesOptions {
  /** Skip fully-paid invoices. Default: true. */
  outstandingOnly?: boolean;
  pageSize?: number;
}

/**
 * Fetch sales invoices for a Sage business. Returns all outstanding by
 * default. Paginates server-side until exhausted.
 */
export async function fetchInvoices(
  accountId: string,
  // Sage doesn't have a tenant concept — businessId is just for display
  businessId: string,
  options: FetchInvoicesOptions = {},
): Promise<SageInvoice[]> {
  const connection = await readConnection(accountId, "sage");
  if (!connection) {
    throw new Error("No Sage connection found for this account.");
  }

  const accessToken = await getFreshAccessToken(connection);
  const pageSize    = options.pageSize ?? 100;
  const outstanding = options.outstandingOnly !== false;
  const all: SageInvoice[] = [];

  let page = 1;
  while (true) {
    // Filter to unpaid + part-paid statuses when outstandingOnly
    // (Sage doesn't natively support OR on status filter — we filter client-side)
    const url =
      `${SAGE_API_BASE}/sales_invoices` +
      `?items_per_page=${pageSize}&page=${page}&attributes=all`;

    const response = await fetch(url, {
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Accept":        "application/json",
        "X-Business":    businessId,
      },
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Sage invoice fetch failed (${response.status}): ${errText}`);
    }

    const data = await response.json();
    const items = ((data.$items ?? data.items ?? []) as SageInvoice[]) ?? [];

    if (outstanding) {
      all.push(...items.filter((i) => (i.outstanding_amount ?? 0) > 0));
    } else {
      all.push(...items);
    }

    if (items.length < pageSize) break;
    page += 1;
    if (page > 50) break; // hard safety cap: 5,000 invoices
  }

  return all;
}
