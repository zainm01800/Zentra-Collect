/**
 * src/lib/books-sync.ts
 *
 * Run-once-per-session helper that synchronises the four localStorage-
 * backed books libraries with their Supabase tables:
 *   - mileage
 *   - quotes
 *   - credit notes
 *   - direct income
 *
 * Behaviour:
 *   1. On first call in a browser tab, push every local item to Supabase
 *      (idempotent — the server actions deduplicate where possible).
 *   2. Then hydrate from Supabase to overwrite the local cache with the
 *      authoritative server set. This guarantees the user sees the same
 *      data on every device they sign in from.
 *
 * Stores a session flag so the heavy push+hydrate only runs once per tab.
 * Safe to call multiple times. No-op when Supabase isn't configured (the
 * server actions short-circuit and return empty results).
 */

import {
  hydrateMileageFromServer,
  pushLocalMileageToServer,
} from "@/lib/mileage";
import {
  hydrateQuotesFromServer,
  pushLocalQuotesToServer,
} from "@/lib/quotes";
import {
  hydrateCreditNotesFromServer,
  pushLocalCreditNotesToServer,
} from "@/lib/credit-notes";
import {
  hydrateDirectIncomeFromServer,
  pushLocalDirectIncomeToServer,
} from "@/lib/banking/direct-income";

const SESSION_FLAG = "zentra.booksSync.v1";

/** Push every local item to Supabase, then hydrate the local cache back. */
export async function syncBooks(): Promise<void> {
  if (typeof window === "undefined") return;
  if (window.sessionStorage.getItem(SESSION_FLAG) === "done") return;

  try {
    // Push first so brand-new local-only entries make it to the server,
    // then hydrate so we don't double-display them.
    await Promise.allSettled([
      pushLocalMileageToServer(),
      pushLocalQuotesToServer(),
      pushLocalCreditNotesToServer(),
      pushLocalDirectIncomeToServer(),
    ]);
    await Promise.allSettled([
      hydrateMileageFromServer(),
      hydrateQuotesFromServer(),
      hydrateCreditNotesFromServer(),
      hydrateDirectIncomeFromServer(),
    ]);
    window.sessionStorage.setItem(SESSION_FLAG, "done");
  } catch {
    // Don't set the flag — we'll retry on next page load.
  }
}
