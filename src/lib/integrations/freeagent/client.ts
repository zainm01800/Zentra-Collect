/**
 * FreeAgent OAuth 2.0 client + invoice API.
 *
 * Endpoints:
 *   - Authorize:    https://api.freeagent.com/v2/approve_app
 *   - Token:        https://api.freeagent.com/v2/token_endpoint
 *   - API base:     https://api.freeagent.com/v2
 *
 * Use FA_ENV=sandbox to flip to https://api.sandbox.freeagent.com/v2.
 *
 * Auth:
 *   - HTTP Basic with client_id:client_secret for token exchange/refresh
 *   - Bearer token for API calls
 *   - Refresh tokens do not rotate (you can re-use them)
 *
 * Why FreeAgent matters for Zentra Collect: it's the dominant accounting
 * platform among UK freelancers and small bookkeepers (Royal Bank-owned,
 * UK-first). Closing this gap unlocks the audience our pricing was
 * designed for.
 */

import {
  isTokenExpired,
  readConnection,
  updateTokens,
  type StoredConnection,
} from "@/lib/integrations/oauth-store";

const IS_SANDBOX = process.env.FA_ENV === "sandbox";
const API_BASE = IS_SANDBOX
  ? "https://api.sandbox.freeagent.com/v2"
  : "https://api.freeagent.com/v2";

const AUTHORIZE_URL = `${API_BASE}/approve_app`;
const TOKEN_URL     = `${API_BASE}/token_endpoint`;

export function isFreeAgentConfigured(): boolean {
  return Boolean(
    process.env.FREEAGENT_CLIENT_ID && process.env.FREEAGENT_CLIENT_SECRET,
  );
}

function requireConfig() {
  if (!isFreeAgentConfigured()) {
    throw new Error(
      "FreeAgent is not configured. Set FREEAGENT_CLIENT_ID and FREEAGENT_CLIENT_SECRET in .env.local.",
    );
  }
  return {
    clientId:     process.env.FREEAGENT_CLIENT_ID!,
    clientSecret: process.env.FREEAGENT_CLIENT_SECRET!,
  };
}

// ── OAuth flow ────────────────────────────────────────────────────────────────

export function buildAuthorizeUrl(redirectUri: string, state: string): string {
  const { clientId } = requireConfig();
  const params = new URLSearchParams({
    response_type: "code",
    client_id:     clientId,
    redirect_uri:  redirectUri,
    state,
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

export interface FreeAgentTokens {
  accessToken:  string;
  refreshToken: string;
  expiresIn:    number;
  tokenType:    string;
}

export async function exchangeCode(
  code:        string,
  redirectUri: string,
): Promise<FreeAgentTokens> {
  const { clientId, clientSecret } = requireConfig();
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const response = await fetch(TOKEN_URL, {
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
    throw new Error(`FreeAgent token exchange failed (${response.status}): ${errText}`);
  }

  const data = await response.json();
  return {
    accessToken:  data.access_token,
    refreshToken: data.refresh_token,
    expiresIn:    data.expires_in ?? 3600,
    tokenType:    data.token_type ?? "bearer",
  };
}

export async function refreshTokens(refreshToken: string): Promise<FreeAgentTokens> {
  const { clientId, clientSecret } = requireConfig();
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const response = await fetch(TOKEN_URL, {
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
    throw new Error(`FreeAgent refresh failed (${response.status}): ${errText}`);
  }

  const data = await response.json();
  return {
    accessToken:  data.access_token,
    refreshToken: data.refresh_token ?? refreshToken,
    expiresIn:    data.expires_in ?? 3600,
    tokenType:    data.token_type ?? "bearer",
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

// ── FreeAgent invoice schema (subset) ─────────────────────────────────────────

export interface FaInvoice {
  url:                 string; // canonical URL = id
  reference:           string;
  dated_on:            string;
  due_on:              string;
  status:              "Draft" | "Sent" | "Scheduled to email" | "Open" | "Overdue" | "Paid" | "Cancelled" | "Written off";
  total_value:         string; // FreeAgent returns numbers as strings
  paid_value:          string;
  due_value:           string;
  currency:            string;
  contact:             string; // URL to /v2/contacts/{id}
}

export interface FaContact {
  url:           string;
  first_name?:   string;
  last_name?:    string;
  organisation_name?: string;
  email?:        string;
}

export interface FaCompany {
  name: string;
}

// ── API calls ────────────────────────────────────────────────────────────────

async function faGet<T>(path: string, accessToken: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Accept":        "application/json",
      "User-Agent":    "Zentra Collect (contact: support@zentracollect.app)",
    },
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`FreeAgent API ${path} failed (${response.status}): ${errText}`);
  }
  return response.json() as Promise<T>;
}

/** Fetch all open (unpaid) invoices. */
export async function fetchInvoices(accountId: string): Promise<FaInvoice[]> {
  const connection = await readConnection(accountId, "freeagent");
  if (!connection) throw new Error("No FreeAgent connection found.");
  const token = await getFreshAccessToken(connection);

  // FreeAgent's `view` filter — "open" returns Open + Overdue, which is
  // exactly the AR slice we want.
  const out: FaInvoice[] = [];
  let page = 1;
  while (true) {
    const data = await faGet<{ invoices: FaInvoice[] }>(
      `/invoices?view=open&per_page=100&page=${page}`,
      token,
    );
    const items = data.invoices ?? [];
    out.push(...items);
    if (items.length < 100) break;
    page += 1;
    if (page > 50) break;
  }
  return out;
}

/** Fetch a single contact by URL — used to enrich invoices with names + emails. */
export async function fetchContact(accountId: string, contactUrl: string): Promise<FaContact | null> {
  const connection = await readConnection(accountId, "freeagent");
  if (!connection) throw new Error("No FreeAgent connection found.");
  const token = await getFreshAccessToken(connection);
  // contactUrl is already absolute; strip the API_BASE prefix
  const path = contactUrl.replace(API_BASE, "");
  try {
    const data = await faGet<{ contact: FaContact }>(path, token);
    return data.contact ?? null;
  } catch {
    return null;
  }
}

/** Fetch the company name for the connected account — used as the tenant label. */
export async function fetchCompanyName(accessToken: string): Promise<string | null> {
  try {
    const data = await faGet<{ company: FaCompany }>("/company", accessToken);
    return data.company?.name ?? null;
  } catch {
    return null;
  }
}
