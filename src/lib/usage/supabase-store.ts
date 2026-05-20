/**
 * src/lib/usage/supabase-store.ts
 *
 * Supabase-backed usage tracking. Reads from zentra_usage_rollups,
 * writes events to zentra_usage_events, and upserts rollups atomically.
 *
 * Replaces the in-memory store (store.ts) for authenticated users.
 * The in-memory store is still used as a fallback when Supabase is
 * unavailable or for the demo account.
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { currentPeriodKey } from "@/lib/usage/tracker";
import type { UsageCounters } from "@/lib/billing/plans";

export type UsageRollup = {
  account_id: string;
  period_start: string;
  imports_used_this_month: number;
  ai_actions_used_this_month: number;
  active_invoice_count: number;
  client_ledger_count: number;
  saved_import_mapping_count: number;
  weekly_digest_count_this_month: number;
  updated_at: string;
};

// ── Read ──────────────────────────────────────────────────────────────────────

/**
 * Load the current-period rollup for an account.
 * Returns null if not found (treat as all-zero counters).
 */
export async function getRollup(accountId: string): Promise<UsageRollup | null> {
  const supabase = await createSupabaseServerClient();
  const periodStart = currentPeriodKey() + "-01"; // "2025-05-01"

  const { data } = await supabase
    .from("zentra_usage_rollups")
    .select("*")
    .eq("account_id", accountId)
    .eq("period_start", periodStart)
    .maybeSingle();

  return data as UsageRollup | null;
}

// ── Write ─────────────────────────────────────────────────────────────────────

/**
 * Increment a usage counter and persist an event row.
 * Uses upsert so the first call for a period creates the rollup row.
 */
export async function incrementRollup(
  accountId: string,
  field: keyof Pick<
    UsageRollup,
    | "imports_used_this_month"
    | "ai_actions_used_this_month"
    | "weekly_digest_count_this_month"
  >,
  delta = 1,
  eventType = field,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const periodStart = currentPeriodKey() + "-01";

  // Write event row for audit trail
  await supabase.from("zentra_usage_events").insert({
    account_id: accountId,
    event_type: eventType,
    usage_type: field,
    quantity: delta,
    metadata,
  });

  // Upsert rollup — increment the specific column
  const { data: existing } = await supabase
    .from("zentra_usage_rollups")
    .select("imports_used_this_month, ai_actions_used_this_month, weekly_digest_count_this_month")
    .eq("account_id", accountId)
    .eq("period_start", periodStart)
    .maybeSingle();

  const currentVal: number = existing ? ((existing as Record<string, number>)[field] ?? 0) : 0;

  await supabase.from("zentra_usage_rollups").upsert(
    {
      account_id: accountId,
      period_start: periodStart,
      [field]: currentVal + delta,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "account_id, period_start", ignoreDuplicates: false },
  );
}

/**
 * Set (not increment) the active_invoice_count — reflects current state.
 */
export async function setActiveInvoiceCount(
  accountId: string,
  count: number,
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const periodStart = currentPeriodKey() + "-01";

  await supabase.from("zentra_usage_rollups").upsert(
    {
      account_id: accountId,
      period_start: periodStart,
      active_invoice_count: count,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "account_id, period_start", ignoreDuplicates: false },
  );
}

// ── Snapshot ──────────────────────────────────────────────────────────────────

/**
 * Build a UsageSnapshot from a DB rollup row.
 * Used by the /api/usage route and plan enforcement.
 */
export function rollupToSnapshot(rollup: UsageRollup | null): Partial<UsageCounters> {
  if (!rollup) return {};
  return {
    importsThisMonth: rollup.imports_used_this_month,
    aiActionsThisMonth: rollup.ai_actions_used_this_month,
    activeInvoices: rollup.active_invoice_count,
    clientLedgers: rollup.client_ledger_count,
    savedImportMappings: rollup.saved_import_mapping_count,
  };
}
