/**
 * src/lib/banking/match.ts
 *
 * Pure function: match incoming bank credits to outstanding invoices.
 *
 * Matching criteria (priority order):
 *   1. HIGH   — amount matches within £0.01 AND client name found in description
 *   2. MEDIUM — amount matches within £0.01 only
 *
 * "Low" matches (name only) are too noisy and are not returned.
 *
 * Deduplication: each transaction and each invoice can only appear once
 * in the result set (highest-confidence match wins).
 */

import type { TLTransaction } from "@/lib/truelayer/client";

// ── Types ─────────────────────────────────────────────────────────────────────

export type MatchConfidence = "high" | "medium";

export interface InvoiceForMatching {
  id:                string;
  customerName:      string;
  invoiceNumber:     string;
  amountOutstanding: number;
  dueDate?:          string;
}

export interface TransactionMatch {
  transaction: TLTransaction;
  invoice:     InvoiceForMatching;
  confidence:  MatchConfidence;
  reasons:     string[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Return significant words from a name (length > 3, strip "Ltd", "Limited", etc.)
 * to reduce false positives from short common words.
 */
function significantWords(name: string): string[] {
  const stopWords = new Set(["limited", "ltd", "llp", "plc", "the", "and", "for"]);
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !stopWords.has(w));
}

function descriptionContainsClientName(
  tx:         TLTransaction,
  clientName: string,
): boolean {
  const haystack = [tx.description, tx.merchant_name ?? ""]
    .join(" ")
    .toLowerCase();

  const words = significantWords(clientName);
  // At least one significant word must appear
  return words.length > 0 && words.some((w) => haystack.includes(w));
}

// ── Main export ───────────────────────────────────────────────────────────────

export function matchTransactionsToInvoices(
  transactions: TLTransaction[],
  invoices:     InvoiceForMatching[],
): TransactionMatch[] {
  // Only match against invoices that still have money outstanding
  const outstanding = invoices.filter((inv) => inv.amountOutstanding > 0.005);

  const all: TransactionMatch[] = [];

  for (const tx of transactions) {
    // Only incoming payments can settle an invoice
    if (tx.transaction_type !== "CREDIT") continue;
    if (tx.amount <= 0) continue;

    for (const inv of outstanding) {
      const amountMatch = Math.abs(tx.amount - inv.amountOutstanding) < 0.015;
      if (!amountMatch) continue;

      const nameMatch = descriptionContainsClientName(tx, inv.customerName);

      const confidence: MatchConfidence = nameMatch ? "high" : "medium";
      const reasons: string[] = [
        `Amount £${tx.amount.toFixed(2)} matches invoice outstanding`,
      ];
      if (nameMatch) reasons.push(`Description references "${inv.customerName}"`);

      all.push({ transaction: tx, invoice: inv, confidence, reasons });
    }
  }

  // Sort: high confidence first, then most recent
  all.sort((a, b) => {
    if (a.confidence !== b.confidence) {
      return a.confidence === "high" ? -1 : 1;
    }
    return (
      new Date(b.transaction.timestamp).getTime() -
      new Date(a.transaction.timestamp).getTime()
    );
  });

  // Deduplicate — each tx and each invoice can only appear once
  const seenTx      = new Set<string>();
  const seenInvoice = new Set<string>();
  const deduped: TransactionMatch[] = [];

  for (const m of all) {
    if (seenTx.has(m.transaction.transaction_id)) continue;
    if (seenInvoice.has(m.invoice.id)) continue;
    deduped.push(m);
    seenTx.add(m.transaction.transaction_id);
    seenInvoice.add(m.invoice.id);
  }

  return deduped;
}
