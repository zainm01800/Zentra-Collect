/**
 * Shared OAuth token storage for accounting integrations.
 *
 * Handles the read/write/refresh lifecycle for any OAuth 2.0 provider stored
 * in the existing `zentra_oauth_connections` table:
 *   - Xero
 *   - QuickBooks
 *   - FreeAgent (future)
 *   - Sage (future)
 *
 * Tokens are encrypted at rest using the existing `encryptPassword` helper.
 *
 * Server-only — uses Supabase service role and process.env secrets.
 */

import { encryptPassword, decryptPassword } from "@/lib/email/crypto";
import {
  createSupabaseServerClient,
  hasSupabaseServerConfig,
} from "@/lib/supabase/server";

export type IntegrationProvider = "xero" | "quickbooks" | "freeagent" | "sage";

export interface StoredConnection {
  id:               string;
  accountId:        string;
  provider:         IntegrationProvider;
  providerTenantId: string;
  accessToken:      string;
  refreshToken:     string;
  scopes:           string[];
  expiresAt:        Date;
  /** Optional human-readable name of the connected tenant (e.g. "Acme Bookkeeping Ltd"). */
  tenantName?:      string;
  lastSyncedAt?:    Date;
}

export interface SaveConnectionInput {
  accountId:        string;
  provider:         IntegrationProvider;
  providerTenantId: string;
  /** Plaintext access token — will be encrypted before storage. */
  accessToken:      string;
  /** Plaintext refresh token — will be encrypted before storage. */
  refreshToken:     string;
  scopes:           string[];
  expiresAt:        Date;
  tenantName?:      string;
}

// ── Resolving the active account for the current user ────────────────────────

/**
 * Get the currently signed-in user's account_id. Returns null when no user
 * is signed in or when Supabase isn't configured.
 */
export async function getActiveAccountId(): Promise<string | null> {
  if (!hasSupabaseServerConfig()) return null;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: member } = await supabase
    .from("zentra_account_members")
    .select("account_id")
    .eq("user_id", user.id)
    .single();

  return member?.account_id ?? null;
}

// ── Read ──────────────────────────────────────────────────────────────────────

/**
 * Look up an active connection by (account, provider). Returns the most
 * recently updated connection if multiple tenants exist.
 */
export async function readConnection(
  accountId: string,
  provider:  IntegrationProvider,
): Promise<StoredConnection | null> {
  if (!hasSupabaseServerConfig()) return null;
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("zentra_oauth_connections")
    .select("*")
    .eq("account_id", accountId)
    .eq("provider", provider)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  if (!data.encrypted_access_token || !data.encrypted_refresh_token) return null;

  return {
    id:               data.id,
    accountId:        data.account_id,
    provider:         data.provider as IntegrationProvider,
    providerTenantId: data.provider_tenant_id ?? "",
    accessToken:      decryptPassword(data.encrypted_access_token),
    refreshToken:     decryptPassword(data.encrypted_refresh_token),
    scopes:           data.scopes ?? [],
    expiresAt:        new Date(data.expires_at),
    tenantName:       data.bank_account_name ?? undefined,
    lastSyncedAt:     undefined,
  };
}

/** True when the access token is within 60s of expiry (or already expired). */
export function isTokenExpired(connection: StoredConnection): boolean {
  return connection.expiresAt.getTime() - Date.now() <= 60_000;
}

// ── Write ────────────────────────────────────────────────────────────────────

export async function saveConnection(input: SaveConnectionInput): Promise<void> {
  if (!hasSupabaseServerConfig()) {
    throw new Error("Supabase is not configured — cannot save OAuth connection.");
  }
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("zentra_oauth_connections")
    .upsert(
      {
        account_id:              input.accountId,
        provider:                input.provider,
        provider_tenant_id:      input.providerTenantId,
        encrypted_access_token:  encryptPassword(input.accessToken),
        encrypted_refresh_token: encryptPassword(input.refreshToken),
        scopes:                  input.scopes,
        expires_at:              input.expiresAt.toISOString(),
        // Reuse bank_account_name column for tenant display name (added in 0009).
        bank_account_name:       input.tenantName ?? null,
        updated_at:              new Date().toISOString(),
      },
      { onConflict: "account_id,provider,provider_tenant_id" },
    );

  if (error) {
    throw new Error(`Failed to save ${input.provider} connection: ${error.message}`);
  }
}

/**
 * Update only the tokens after a refresh. Cheaper than re-running the full
 * upsert — used in the refresh-token middleware.
 */
export async function updateTokens(
  connectionId: string,
  accessToken:  string,
  refreshToken: string,
  expiresAt:    Date,
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("zentra_oauth_connections")
    .update({
      encrypted_access_token:  encryptPassword(accessToken),
      encrypted_refresh_token: encryptPassword(refreshToken),
      expires_at:              expiresAt.toISOString(),
      updated_at:              new Date().toISOString(),
    })
    .eq("id", connectionId);

  if (error) {
    throw new Error(`Failed to update tokens: ${error.message}`);
  }
}

// ── Delete ────────────────────────────────────────────────────────────────────

export async function deleteConnection(
  accountId: string,
  provider:  IntegrationProvider,
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("zentra_oauth_connections")
    .delete()
    .eq("account_id", accountId)
    .eq("provider", provider);

  if (error) {
    throw new Error(`Failed to delete ${provider} connection: ${error.message}`);
  }
}
