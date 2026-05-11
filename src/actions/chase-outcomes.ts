"use server";

/**
 * src/actions/chase-outcomes.ts
 *
 * Server actions for logging and querying chase outcomes.
 *
 * logChaseOutcome — called from the LogOutcomeButton client component
 *                   after the user picks what happened with a chase.
 *
 * getOutcomeSummary — called from server components (dashboard page)
 *                     to show a "what chasing recovered" stat bar.
 */

import {
  createSupabaseServerClient,
  hasSupabaseServerConfig,
} from "@/lib/supabase/server";

// ── Types ─────────────────────────────────────────────────────────────────────

export type ChaseOutcome = "sent" | "promised" | "paid" | "dispute" | "snoozed";

export interface LogChaseOutcomeInput {
  invoiceRef:        string;
  clientName:        string;
  amountOutstanding?: number;
  outcome:           ChaseOutcome;
  promisedDate?:     string;   // ISO date string, only when outcome = "promised"
  notes?:            string;
}

export interface OutcomeSummary {
  /** Total outcomes logged in the current calendar month. */
  totalLogged:    number;
  /** How many invoices were marked paid this month. */
  paidCount:      number;
  /** Sum of amount_outstanding for paid outcomes this month. */
  amountPaid:     number;
  /** How many active (unresolved) promises are on record. */
  promisedCount:  number;
  /** Sum of amount_outstanding for those promises. */
  amountPromised: number;
}

// ── logChaseOutcome ───────────────────────────────────────────────────────────

export async function logChaseOutcome(
  input: LogChaseOutcomeInput,
): Promise<{ ok: boolean; error?: string }> {
  if (!hasSupabaseServerConfig()) {
    // Running without Supabase (dev / demo). Silently succeed so the UI
    // still shows the "Logged!" confirmation.
    return { ok: true };
  }

  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const { data: member } = await supabase
    .from("zentra_account_members")
    .select("account_id")
    .eq("user_id", user.id)
    .single();

  if (!member) return { ok: false, error: "No account found" };

  const { error } = await supabase.from("zentra_chase_outcomes").insert({
    account_id:         member.account_id,
    invoice_ref:        input.invoiceRef,
    client_name:        input.clientName,
    amount_outstanding: input.amountOutstanding ?? null,
    outcome:            input.outcome,
    promised_date:      input.promisedDate ?? null,
    notes:              input.notes?.trim() || null,
    logged_by:          user.id,
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ── getOutcomeSummary ─────────────────────────────────────────────────────────

export async function getOutcomeSummary(): Promise<OutcomeSummary> {
  const empty: OutcomeSummary = {
    totalLogged:    0,
    paidCount:      0,
    amountPaid:     0,
    promisedCount:  0,
    amountPromised: 0,
  };

  if (!hasSupabaseServerConfig()) return empty;

  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return empty;

  const { data: member } = await supabase
    .from("zentra_account_members")
    .select("account_id")
    .eq("user_id", user.id)
    .single();

  if (!member) return empty;

  // Start of current calendar month (UTC)
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  const { data: rows, error } = await supabase
    .from("zentra_chase_outcomes")
    .select("outcome, amount_outstanding, promised_date, created_at")
    .eq("account_id", member.account_id)
    .gte("created_at", monthStart.toISOString());

  if (error || !rows) return empty;

  const todayIso = now.toISOString().slice(0, 10);

  let paidCount      = 0;
  let amountPaid     = 0;
  let promisedCount  = 0;
  let amountPromised = 0;

  for (const row of rows) {
    const amt = (row.amount_outstanding as number | null) ?? 0;
    if (row.outcome === "paid") {
      paidCount++;
      amountPaid += amt;
    }
    if (row.outcome === "promised") {
      // Only count promises that haven't passed yet (still "pending")
      const pd = row.promised_date as string | null;
      if (!pd || pd >= todayIso) {
        promisedCount++;
        amountPromised += amt;
      }
    }
  }

  return {
    totalLogged:   rows.length,
    paidCount,
    amountPaid,
    promisedCount,
    amountPromised,
  };
}
