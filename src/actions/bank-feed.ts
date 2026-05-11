"use server";

/**
 * src/actions/bank-feed.ts
 *
 * Server actions for managing the TrueLayer bank connection and
 * fetching transactions.
 *
 * getBankConnection  — returns the stored connection metadata (no tokens)
 * fetchBankTransactions — fetches recent transactions; auto-refreshes the
 *                         access token if expired
 * disconnectBank     — removes the stored connection row
 */

import {
  createSupabaseServerClient,
  hasSupabaseServerConfig,
} from "@/lib/supabase/server";
import {
  getTransactions,
  refreshTokens,
  type TLTransaction,
} from "@/lib/truelayer/client";
import {
  encryptPassword as encrypt,
  decryptPassword as decrypt,
} from "@/lib/email/crypto";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BankConnection {
  id:              string;
  providerName:    string | null;
  bankAccountId:   string | null;
  bankAccountName: string | null;
  expiresAt:       string | null;
  updatedAt:       string;
}

export interface FetchTransactionsResult {
  transactions: TLTransaction[];
  error?:       string;
}

// ── Private helpers ───────────────────────────────────────────────────────────

async function getAccountIdAndClient() {
  if (!hasSupabaseServerConfig()) return null;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: member } = await supabase
    .from("zentra_account_members")
    .select("account_id")
    .eq("user_id", user.id)
    .single();

  if (!member) return null;
  return { supabase, accountId: member.account_id as string };
}

// ── getBankConnection ─────────────────────────────────────────────────────────

export async function getBankConnection(): Promise<BankConnection | null> {
  const ctx = await getAccountIdAndClient();
  if (!ctx) return null;

  const { supabase, accountId } = ctx;

  const { data } = await supabase
    .from("zentra_oauth_connections")
    .select(
      "id, bank_provider_name, bank_account_id, bank_account_name, expires_at, updated_at",
    )
    .eq("account_id", accountId)
    .eq("provider", "truelayer")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;

  return {
    id:              data.id as string,
    providerName:    (data.bank_provider_name as string | null) ?? null,
    bankAccountId:   (data.bank_account_id as string | null) ?? null,
    bankAccountName: (data.bank_account_name as string | null) ?? null,
    expiresAt:       (data.expires_at as string | null) ?? null,
    updatedAt:       data.updated_at as string,
  };
}

// ── fetchBankTransactions ─────────────────────────────────────────────────────

/**
 * Fetches up to `daysBack` days of transactions from TrueLayer.
 * Automatically refreshes the access token if it's within 5 minutes of
 * expiry, and persists the new tokens back to Supabase.
 */
export async function fetchBankTransactions(
  daysBack = 30,
): Promise<FetchTransactionsResult> {
  const ctx = await getAccountIdAndClient();
  if (!ctx) return { transactions: [], error: "Not authenticated" };

  const { supabase, accountId } = ctx;

  // Fetch the full connection row (including encrypted tokens)
  const { data: conn } = await supabase
    .from("zentra_oauth_connections")
    .select(
      "id, bank_account_id, encrypted_access_token, encrypted_refresh_token, expires_at",
    )
    .eq("account_id", accountId)
    .eq("provider", "truelayer")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!conn) {
    return { transactions: [], error: "No bank connected" };
  }

  let accessToken  = decrypt(conn.encrypted_access_token as string);
  const bankAccId  = conn.bank_account_id as string | null;

  if (!bankAccId) {
    return { transactions: [], error: "No bank account selected" };
  }

  // ── Token refresh ──────────────────────────────────────────────────────────

  const expiresAt  = conn.expires_at ? new Date(conn.expires_at as string) : null;
  const fiveMinutes = 5 * 60 * 1000;
  const needsRefresh = !expiresAt || expiresAt.getTime() - Date.now() < fiveMinutes;

  if (needsRefresh) {
    try {
      const refreshToken = decrypt(conn.encrypted_refresh_token as string);
      const newTokens    = await refreshTokens(refreshToken);
      accessToken        = newTokens.access_token;

      // Persist refreshed tokens
      await supabase
        .from("zentra_oauth_connections")
        .update({
          encrypted_access_token:  encrypt(newTokens.access_token),
          encrypted_refresh_token: encrypt(newTokens.refresh_token),
          expires_at: new Date(
            Date.now() + newTokens.expires_in * 1000,
          ).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", conn.id as string);
    } catch (err) {
      console.error("[fetchBankTransactions] token refresh failed:", err);
      return {
        transactions: [],
        error: "Bank session expired. Please reconnect your bank.",
      };
    }
  }

  // ── Fetch transactions ─────────────────────────────────────────────────────

  try {
    const to   = new Date();
    const from = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);

    const transactions = await getTransactions(accessToken, bankAccId, from, to);
    return { transactions };
  } catch (err) {
    console.error("[fetchBankTransactions] fetch failed:", err);
    return {
      transactions: [],
      error: "Could not fetch transactions. Try reconnecting your bank.",
    };
  }
}

// ── disconnectBank ────────────────────────────────────────────────────────────

export async function disconnectBank(): Promise<{ ok: boolean; error?: string }> {
  const ctx = await getAccountIdAndClient();
  if (!ctx) return { ok: false, error: "Not authenticated" };

  const { supabase, accountId } = ctx;

  const { error } = await supabase
    .from("zentra_oauth_connections")
    .delete()
    .eq("account_id", accountId)
    .eq("provider", "truelayer");

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
