/**
 * src/lib/banking/match.ts
 *
 * Scored matching engine: bank credits → outstanding invoices.
 *
 * Scoring (max ~120 pts):
 *   Invoice number in description  35 pts  strongest signal
 *   Exact amount match             40 pts
 *   Customer name similarity       25 pts  token overlap
 *   Date proximity                 20 pts  within 14 days
 *
 * Thresholds:
 *   ≥ 75  → "high"   confidence
 *   ≥ 45  → "medium" confidence
 *   < 45  → not returned
 *
 * Each transaction and each invoice appears at most once (greedy dedup).
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
  issueDate?:        string;
}

export interface TransactionMatch {
  transaction: TLTransaction;
  invoice:     InvoiceForMatching;
  confidence:  MatchConfidence;
  score:       number;
  reasons:     string[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalise(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function tokenOverlap(a: string, b: string): number {
  const aSet = new Set(normalise(a).split(" ").filter((w) => w.length > 2));
  const bSet = new Set(normalise(b).split(" ").filter((w) => w.length > 2));
  if (!aSet.size || !bSet.size) return 0;
  const shared = [...aSet].filter((t) => bSet.has(t)).length;
  return shared / Math.max(aSet.size, bSet.size);
}

function daysBetween(a: string, b: string): number | undefined {
  const da = new Date(a).getTime();
  const db = new Date(b).getTime();
  if (isNaN(da) || isNaN(db)) return undefined;
  return Math.abs(da - db) / 86_400_000;
}

function txDescription(tx: TLTransaction) {
  return [tx.description, tx.merchant_name ?? ""].join(" ").toLowerCase();
}

// ── Scoring ───────────────────────────────────────────────────────────────────

interface ScoreResult {
  score:   number;
  reasons: string[];
}

function scoreInvoiceVsTransaction(
  inv: InvoiceForMatching,
  tx:  TLTransaction,
): ScoreResult {
  let score = 0;
  const reasons: string[] = [];
  const haystack = txDescription(tx);

  // 1. Invoice number in transaction description (strongest signal)
  if (inv.invoiceNumber && inv.invoiceNumber.length >= 3) {
    const needle = normalise(inv.invoiceNumber);
    if (haystack.includes(needle)) {
      score += 35;
      reasons.push(`Invoice ${inv.invoiceNumber} found in payment description`);
    }
  }

  // 2. Amount match (within £0.01 = exact, within 1% = close)
  const diff = Math.abs(tx.amount - inv.amountOutstanding);
  if (diff < 0.015) {
    score += 40;
    reasons.push(`Amount £${tx.amount.toFixed(2)} matches invoice outstanding`);
  } else if (diff / inv.amountOutstanding < 0.01) {
    score += 25;
    reasons.push(`Amount within 1% of invoice outstanding`);
  }

  // 3. Customer name similarity
  const nameSim = tokenOverlap(inv.customerName, haystack);
  if (nameSim > 0.5) {
    score += Math.round(nameSim * 25);
    reasons.push(`Customer name "${inv.customerName}" matches payment sender`);
  } else if (nameSim > 0.2) {
    score += Math.round(nameSim * 15);
    reasons.push(`Partial name match with "${inv.customerName}"`);
  }

  // 4. Date proximity (transaction vs due date or issue date)
  const refDate = inv.dueDate ?? inv.issueDate;
  if (refDate && tx.timestamp) {
    const days = daysBetween(tx.timestamp.slice(0, 10), refDate);
    if (days !== undefined) {
      if (days <= 2)  { score += 20; reasons.push("Payment date matches invoice date closely"); }
      else if (days <= 7)  { score += 14; }
      else if (days <= 14) { score += 8; }
    }
  }

  return { score, reasons };
}

// ── Main export ───────────────────────────────────────────────────────────────

export function matchTransactionsToInvoices(
  transactions: TLTransaction[],
  invoices:     InvoiceForMatching[],
): TransactionMatch[] {
  const outstanding = invoices.filter((inv) => inv.amountOutstanding > 0.005);

  const candidates: TransactionMatch[] = [];

  for (const tx of transactions) {
    if (tx.transaction_type !== "CREDIT") continue;
    if (tx.amount <= 0) continue;

    for (const inv of outstanding) {
      const { score, reasons } = scoreInvoiceVsTransaction(inv, tx);
      if (score < 45) continue;

      const confidence: MatchConfidence = score >= 75 ? "high" : "medium";
      candidates.push({ transaction: tx, invoice: inv, confidence, score, reasons });
    }
  }

  // Sort: highest score first, then most recent
  candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return new Date(b.transaction.timestamp).getTime() - new Date(a.transaction.timestamp).getTime();
  });

  // Greedy dedup — each tx and each invoice appears at most once
  const seenTx      = new Set<string>();
  const seenInvoice = new Set<string>();
  const result: TransactionMatch[] = [];

  for (const m of candidates) {
    if (seenTx.has(m.transaction.transaction_id)) continue;
    if (seenInvoice.has(m.invoice.id)) continue;
    result.push(m);
    seenTx.add(m.transaction.transaction_id);
    seenInvoice.add(m.invoice.id);
  }

  return result;
}
