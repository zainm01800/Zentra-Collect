/**
 * GoCardless OAuth 2.0 client + mandate / payment API.
 *
 * Endpoints:
 *   - Authorize:    https://connect.gocardless.com/oauth/authorize
 *   - Token:        https://connect.gocardless.com/oauth/access_token
 *   - API base:     https://api.gocardless.com
 *
 * Use GC_ENV=sandbox in dev to flip to https://connect-sandbox.gocardless.com
 * + https://api-sandbox.gocardless.com.
 *
 * Auth model:
 *   - Standard OAuth 2.0 authorization code flow
 *   - GoCardless API requires a `GoCardless-Version: 2015-07-06` header
 *   - Bearer token for API calls
 *   - Refresh tokens are NOT rotating (unlike Xero) — same refresh
 *     token can be re-used until the user revokes the OAuth grant
 *
 * Why this matters for Zentra Collect:
 *   When a user connects GoCardless, we can list their mandates and
 *   payments, surface "this customer is already on Direct Debit — stop
 *   chasing them" in the chase plan, and (future) create new mandates
 *   from the customer portal.
 */

import {
  isTokenExpired,
  readConnection,
  updateTokens,
  type StoredConnection,
} from "@/lib/integrations/oauth-store";

// ── Config ────────────────────────────────────────────────────────────────────

const IS_SANDBOX = process.env.GC_ENV === "sandbox";

const CONNECT_BASE = IS_SANDBOX
  ? "https://connect-sandbox.gocardless.com"
  : "https://connect.gocardless.com";

const API_BASE = IS_SANDBOX
  ? "https://api-sandbox.gocardless.com"
  : "https://api.gocardless.com";

const AUTHORIZE_URL = `${CONNECT_BASE}/oauth/authorize`;
const TOKEN_URL     = `${CONNECT_BASE}/oauth/access_token`;

const GC_API_VERSION = "2015-07-06";

export const GC_SCOPES = ["read_only"];

export function isGoCardlessConfigured(): boolean {
  return Boolean(
    process.env.GC_CLIENT_ID && process.env.GC_CLIENT_SECRET,
  );
}

function requireConfig() {
  if (!isGoCardlessConfigured()) {
    throw new Error(
      "GoCardless is not configured. Set GC_CLIENT_ID and GC_CLIENT_SECRET in .env.local.",
    );
  }
  return {
    clientId:     process.env.GC_CLIENT_ID!,
    clientSecret: process.env.GC_CLIENT_SECRET!,
  };
}

// ── OAuth flow ────────────────────────────────────────────────────────────────

export function buildAuthorizeUrl(redirectUri: string, state: string): string {
  const { clientId } = requireConfig();
  const params = new URLSearchParams({
    response_type: "code",
    client_id:     clientId,
    redirect_uri:  redirectUri,
    scope:         GC_SCOPES.join(" "),
    initial_view:  "login",
    state,
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

export interface GoCardlessTokens {
  accessToken:    string;
  refreshToken:   string;
  expiresIn:      number;
  scope:          string;
  tokenType:      string;
  organisationId: string;
}

export async function exchangeCode(
  code:        string,
  redirectUri: string,
): Promise<GoCardlessTokens> {
  const { clientId, clientSecret } = requireConfig();

  const response = await fetch(TOKEN_URL, {
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
    throw new Error(`GoCardless token exchange failed (${response.status}): ${errText}`);
  }

  const data = await response.json();
  return {
    accessToken:    data.access_token,
    refreshToken:   data.refresh_token,
    expiresIn:      data.expires_in ?? 3600,
    scope:          data.scope ?? "read_only",
    tokenType:      data.token_type ?? "bearer",
    organisationId: data.organisation_id ?? "",
  };
}

export async function refreshTokens(refreshToken: string): Promise<GoCardlessTokens> {
  const { clientId, clientSecret } = requireConfig();

  const response = await fetch(TOKEN_URL, {
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
    throw new Error(`GoCardless refresh failed (${response.status}): ${errText}`);
  }

  const data = await response.json();
  return {
    accessToken:    data.access_token,
    refreshToken:   data.refresh_token ?? refreshToken, // non-rotating
    expiresIn:      data.expires_in ?? 3600,
    scope:          data.scope ?? "read_only",
    tokenType:      data.token_type ?? "bearer",
    organisationId: data.organisation_id ?? "",
  };
}

async function getFreshAccessToken(connection: StoredConnection): Promise<string> {
  if (!isTokenExpired(connection)) return connection.accessToken;
  const refreshed = await refreshTokens(connection.refreshToken);
  await updateTokens(
    connection.id,
    refreshed.accessToken,
    refreshed.refreshToken,
    new Date(Date.now() + refreshed.expiresIn * 1000),
  );
  return refreshed.accessToken;
}

// ── Mandate / customer schema (subset we use) ─────────────────────────────────

export interface GcCustomer {
  id:            string;
  email?:        string;
  given_name?:   string;
  family_name?:  string;
  company_name?: string;
  created_at:    string;
}

export interface GcMandate {
  id:            string;
  status:        "pending_customer_approval" | "pending_submission" | "submitted"
              | "active" | "failed" | "cancelled" | "expired"
              | "consumed" | "blocked";
  scheme:        string;
  links:         { customer: string; creditor: string };
  created_at:    string;
}

// ── Public API calls ──────────────────────────────────────────────────────────

async function gcGet<T>(
  path: string,
  accessToken: string,
): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Authorization":      `Bearer ${accessToken}`,
      "GoCardless-Version": GC_API_VERSION,
      "Accept":             "application/json",
    },
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`GoCardless API ${path} failed (${response.status}): ${errText}`);
  }
  return response.json() as Promise<T>;
}

/** List all active mandates for the connected creditor. */
export async function fetchActiveMandates(accountId: string): Promise<GcMandate[]> {
  const connection = await readConnection(accountId, "gocardless");
  if (!connection) throw new Error("No GoCardless connection found.");
  const token = await getFreshAccessToken(connection);

  const out: GcMandate[] = [];
  let cursor: string | null = null;
  // Paginate. GoCardless uses a `meta.cursors.after` token.
  do {
    const path: string = `/mandates?status=active&limit=200${cursor ? `&after=${cursor}` : ""}`;
    const page: {
      mandates: GcMandate[];
      meta?: { cursors?: { after?: string | null } };
    } = await gcGet(path, token);
    out.push(...(page.mandates ?? []));
    cursor = page.meta?.cursors?.after ?? null;
    if (out.length > 5_000) break; // safety
  } while (cursor);

  return out;
}

/** List customers paged — used to map a mandate's customer link to an email. */
export async function fetchCustomers(accountId: string): Promise<GcCustomer[]> {
  const connection = await readConnection(accountId, "gocardless");
  if (!connection) throw new Error("No GoCardless connection found.");
  const token = await getFreshAccessToken(connection);

  const out: GcCustomer[] = [];
  let cursor: string | null = null;
  do {
    const path: string = `/customers?limit=200${cursor ? `&after=${cursor}` : ""}`;
    const page: {
      customers: GcCustomer[];
      meta?: { cursors?: { after?: string | null } };
    } = await gcGet(path, token);
    out.push(...(page.customers ?? []));
    cursor = page.meta?.cursors?.after ?? null;
    if (out.length > 10_000) break;
  } while (cursor);

  return out;
}

/**
 * Build the set of customer emails that currently have an active mandate
 * with this creditor. Used by the chase plan to flag "on Direct Debit —
 * don't chase" for any matching invoice.
 */
export async function getEmailsOnActiveDD(accountId: string): Promise<Set<string>> {
  const [mandates, customers] = await Promise.all([
    fetchActiveMandates(accountId),
    fetchCustomers(accountId),
  ]);
  const customerById = new Map(customers.map((c) => [c.id, c]));
  const emails = new Set<string>();
  for (const m of mandates) {
    const customer = customerById.get(m.links.customer);
    if (customer?.email) emails.add(customer.email.toLowerCase());
  }
  return emails;
}
