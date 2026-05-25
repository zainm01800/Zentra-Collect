/**
 * src/lib/sync/workspace-sync.ts
 *
 * Client-side workspace sync: push localStorage data to Supabase and pull
 * it back when the user signs in on a new device.
 *
 * Design principles:
 *  - localStorage is the synchronous read cache (instant, always available).
 *  - Supabase is the source of truth (survives sign-out / device changes).
 *  - All operations are best-effort and fire-and-forget — failures are
 *    swallowed silently so a network hiccup never blocks the UI.
 *  - Mileage is handled separately via server actions in lib/mileage.ts;
 *    this module covers invoices, expenses, and bank statements only.
 */

"use client";

import {
  createSupabaseBrowserClient,
  hasSupabaseBrowserConfig,
} from "@/lib/supabase/browser";

// ── localStorage key registry ─────────────────────────────────────────────────

type DataType =
  | "invoices"
  | "expenses"
  | "bank_statements"
  | "bank_statement_active"
  | "quotes"
  | "credit_notes"
  | "bills"
  | "recurring_invoices"
  | "business_settings"
  | "workspace_prefs"
  | "email_settings"
  | "email_templates"
  | "invoice_team"
  | "direct_income"
  | "ar_snapshots"
  | "tone_outcomes"
  | "bookkeeper_clients"
  | "chase_replies"
  | "chase_snoozed"
  | "workspace_setup";

const LS_KEYS: Record<DataType, string> = {
  invoices:             "zentra.importedInvoices.v1",
  expenses:             "zentra.expenses.v1",
  bank_statements:      "zentra.bankStatements.v2",
  bank_statement_active:"zentra.bankStatement.v1",
  quotes:               "zentra.quotes.v1",
  credit_notes:         "zentra.creditNotes.v1",
  bills:                "zentra.bills.v1",
  recurring_invoices:   "zentra.recurringInvoices.v1",
  business_settings:    "zentra.businessSettings.v1",
  workspace_prefs:      "zentra.workspacePrefs.v1",
  email_settings:       "zentra.emailSettings.v1",
  email_templates:      "zn:email-templates:v1",
  invoice_team:         "zentra.invoiceTeam.v1",
  direct_income:        "zentra.directIncome.v1",
  ar_snapshots:         "zentra.arSnapshots.v1",
  tone_outcomes:        "zn:tone-outcomes:v1",
  bookkeeper_clients:   "zentra.bookkeeperClients.v1",
  chase_replies:        "zentra.replies",
  chase_snoozed:        "zentra.bulk.snoozed",
  // Onboarding completion flag — kept in sync so re-login on a new device
  // doesn't re-show the first-run modal.
  workspace_setup:      "zn:workspace:v1",
};

/**
 * Extra localStorage keys that are NOT in the sync registry but still belong
 * to the current user's session. These must be cleared on sign-out so that a
 * different user signing in on the same browser never sees another user's data.
 */
const EXTRA_USER_KEYS = [
  "zn:onboarded:v1",        // legacy onboarding flag
  "zentra.businessName",    // plain-text business name (also in business_settings)
  "zentra.navHidden.v1",    // which nav items the user hid
  "zentra.navCollapse.v1",  // which nav sections are collapsed
  "zentra.demoInvoiceState.v1",
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function safeParseLS(key: string): unknown {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function isNonEmpty(payload: unknown): boolean {
  if (Array.isArray(payload)) return payload.length > 0;
  if (payload && typeof payload === "object") return Object.keys(payload).length > 0;
  return false;
}

// ── Clear helper (sign-out / user switch) ─────────────────────────────────────

/**
 * Wipe all workspace data from localStorage.
 * Call this on sign-out so the next user who signs in on the same device
 * never sees another user's invoices, bank statements, or business name.
 *
 * Does NOT remove the Supabase session cookie or the demoUser key — the
 * caller (handleSignOut) is responsible for those.
 */
export function clearAllWorkspaceData(): void {
  if (typeof window === "undefined") return;
  try {
    for (const key of Object.values(LS_KEYS)) {
      window.localStorage.removeItem(key);
    }
    for (const key of EXTRA_USER_KEYS) {
      window.localStorage.removeItem(key);
    }
  } catch {
    /* best-effort */
  }
}

// ── Core API ──────────────────────────────────────────────────────────────────

/**
 * Push a single data type from localStorage to Supabase.
 * Safe to call after every write — idempotent upsert, fire-and-forget.
 */
export async function pushDataType(
  dataType: DataType,
  accountId: string,
): Promise<void> {
  if (!hasSupabaseBrowserConfig() || !accountId) return;
  try {
    const payload = safeParseLS(LS_KEYS[dataType]);
    const supabase = createSupabaseBrowserClient();
    await supabase.from("zentra_workspace_data").upsert(
      {
        account_id: accountId,
        data_type:  dataType,
        payload,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "account_id,data_type" },
    );
  } catch {
    /* best-effort — never crash the caller */
  }
}

/**
 * Push all three data types in parallel.
 */
export async function pushAllData(accountId: string): Promise<void> {
  if (!hasSupabaseBrowserConfig() || !accountId) return;
  await Promise.all(
    (Object.keys(LS_KEYS) as DataType[]).map((dt) =>
      pushDataType(dt, accountId),
    ),
  );
}

/**
 * Pull all workspace data from Supabase and populate localStorage.
 * Called once after sign-in to restore data on a new device.
 *
 * Clears all existing workspace keys first to prevent data from a
 * previously-signed-in user leaking into the new session. Then writes
 * each key that has a non-empty payload from the server.
 */
export async function pullAllData(accountId: string): Promise<void> {
  if (!hasSupabaseBrowserConfig() || !accountId) return;
  try {
    const supabase = createSupabaseBrowserClient();
    const { data } = await supabase
      .from("zentra_workspace_data")
      .select("data_type, payload")
      .eq("account_id", accountId);

    // Clear any residual data from a previous user before writing new data.
    // This ensures a clean slate even when the previous sign-out didn't clear
    // (e.g. the tab was closed mid-sign-out, or the browser crashed).
    clearAllWorkspaceData();

    if (!data?.length) return;

    for (const row of data) {
      const key = LS_KEYS[row.data_type as DataType];
      if (key && isNonEmpty(row.payload)) {
        window.localStorage.setItem(key, JSON.stringify(row.payload));
      }
    }

    // Fire a storage event so any mounted components re-read their data.
    window.dispatchEvent(new CustomEvent("zentra:workspace-restored"));
  } catch {
    /* best-effort */
  }
}

/**
 * Read the stored Supabase account ID from the local session object.
 * Returns null when the user is not signed in or the id hasn't been stored yet.
 */
export function getLocalSupabaseAccountId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem("zentra.demoUser.v1");
    if (!raw) return null;
    const user = JSON.parse(raw) as { supabaseAccountId?: string };
    return user.supabaseAccountId ?? null;
  } catch {
    return null;
  }
}
