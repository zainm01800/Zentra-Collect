/**
 * Write-back orchestrator — calls the right per-provider markInvoicePaid
 * after a successful Stripe payment closes the loop on a Zentra portal
 * checkout.
 *
 * Read-only OAuth scopes can't write — users who connected before Phase 3
 * need to reconnect with broader scopes. We log a clear error in that
 * case so they can fix it from /settings/integrations.
 */

import { markPaidInXero }       from "./xero/write-back";
import { markPaidInQuickBooks } from "./quickbooks/write-back";
import { markPaidInSage }       from "./sage/write-back";
import { markPaidInFreeAgent }  from "./freeagent/write-back";

export type Provider = "xero" | "quickbooks" | "sage" | "freeagent";

export interface WriteBackInput {
  accountId:        string;
  provider:         Provider;
  sourceInvoiceId:  string;
  /** Amount actually paid in GBP (post-discount or incl-interest, whichever applied). */
  amountPaid:       number;
  /** ISO YYYY-MM-DD — usually today, the payment date. */
  paidDate:         string;
  /** Free-text reference Stripe gave us (e.g. checkout session id). */
  reference?:       string;
}

export type WriteBackResult =
  | { ok: true }
  | { ok: false; error: string; reauthorize?: boolean };

export async function writeBackPayment(input: WriteBackInput): Promise<WriteBackResult> {
  switch (input.provider) {
    case "xero":       return markPaidInXero(input);
    case "quickbooks": return markPaidInQuickBooks(input);
    case "sage":       return markPaidInSage(input);
    case "freeagent":  return markPaidInFreeAgent(input);
  }
}
