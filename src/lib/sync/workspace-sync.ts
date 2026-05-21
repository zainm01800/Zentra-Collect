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

type DataType = "invoices" | "expenses" | "bank_statements";

const LS_KEYS: Record<DataType, string> = {
  invoices:        "zentra.importedInvoices.v1",
  expenses:        "zentra.expenses.v1",
  bank_statements: "zentra.bankStatements.v2",
};

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
 * Only overwrites a localStorage key when the server has a non-empty
 * payload — this means local-only data (typed in offline before syncing)
 * is never silently wiped by an empty cloud row.
 */
export async function pullAllData(accountId: string): Promise<void> {
  if (!hasSupabaseBrowserConfig() || !accountId) return;
  try {
    const supabase = createSupabaseBrowserClient();
    const { data } = await supabase
      .from("zentra_workspace_data")
      .select("data_type, payload")
      .eq("account_id", accountId);

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
