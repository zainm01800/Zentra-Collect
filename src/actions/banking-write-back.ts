"use server";

/**
 * Trigger Phase 3 write-back from the bank-feed "Mark as paid" action.
 *
 * The bank-transactions list is a client component that detects an
 * incoming credit matches an open invoice. When the user confirms,
 * we mark the invoice paid locally AND (when the invoice was imported
 * from an accounting integration) push the payment back to that tool.
 *
 * Read the invoice id prefix to detect source provider — same encoding
 * used by all four mappers (xero-, quickbooks-, sage-, freeagent-).
 * Manually-created invoices (inv-...) have no source and are skipped.
 */

import { writeBackPayment, type Provider } from "@/lib/integrations/write-back";
import { getActiveAccountId } from "@/lib/integrations/oauth-store";

const PROVIDER_PREFIXES: Record<string, Provider> = {
  "xero-":       "xero",
  "quickbooks-": "quickbooks",
  "sage-":       "sage",
  "freeagent-":  "freeagent",
};

export interface BankWriteBackInput {
  invoiceId:    string;
  amountPaid:   number;
  paidDate:     string;
  reference?:   string;
}

export type BankWriteBackResult =
  | { ok: true; provider: Provider }
  | { ok: true; provider: null }   // manual invoice — nothing to write back
  | { ok: false; error: string; reauthorize?: boolean };

function detectProvider(invoiceId: string): { provider: Provider; sourceInvoiceId: string } | null {
  for (const [prefix, provider] of Object.entries(PROVIDER_PREFIXES)) {
    if (invoiceId.startsWith(prefix)) {
      return { provider, sourceInvoiceId: invoiceId };
    }
  }
  return null;
}

export async function writeBackFromBankFeedAction(
  input: BankWriteBackInput,
): Promise<BankWriteBackResult> {
  const detected = detectProvider(input.invoiceId);
  if (!detected) {
    // Manual invoice — local mark-paid already happened client-side.
    return { ok: true, provider: null };
  }

  const accountId = await getActiveAccountId();
  if (!accountId) {
    return { ok: false, error: "Sign in to enable write-back to your accounting tool." };
  }

  const result = await writeBackPayment({
    accountId,
    provider:        detected.provider,
    sourceInvoiceId: detected.sourceInvoiceId,
    amountPaid:      input.amountPaid,
    paidDate:        input.paidDate,
    reference:       input.reference,
  });

  if (!result.ok) {
    return { ok: false, error: result.error, reauthorize: result.reauthorize };
  }
  return { ok: true, provider: detected.provider };
}
