/**
 * Invoice duplicate detection.
 *
 * Surfaces "this looks like a duplicate of an existing invoice" warnings during
 * re-imports. Catches:
 *   - Exact invoice-number matches against a different customer
 *   - Near-matches (1-2 char difference) for the same customer
 *   - Same customer + same amount + dates within 7 days
 *
 * Pure function. O(n × m) over (new × existing) — fine for SMB-sized imports.
 */

// ── Permissive input — matches both cashpilot and zentra invoice schemas ─────

export interface InvoiceForDupeCheck {
  invoiceNumber: string;
  customerName:  string;
  amount:        number;
  invoiceDate?:  string;
  /** Optional zentra alias — checked if invoiceDate is absent. */
  issueDate?:    string;
}

export type DuplicateReason =
  | "exact_number_different_customer"
  | "near_number_same_customer"
  | "same_customer_same_amount_close_date";

export interface DuplicateWarning {
  /** The new invoice being flagged. */
  newInvoiceNumber: string;
  /** The existing invoice it conflicts with. */
  existingInvoiceNumber: string;
  /** Customer on the new invoice. */
  newCustomerName: string;
  /** Customer on the existing invoice (may differ from new for exact-number case). */
  existingCustomerName: string;
  /** Why this was flagged. */
  reason: DuplicateReason;
  /** Plain-English summary suitable for surfacing in the UI. */
  summary: string;
  /** Confidence in the duplicate match: high (probably a dupe), medium (worth a look). */
  confidence: "high" | "medium";
}

// ── Levenshtein distance — tiny, no deps ─────────────────────────────────────

/**
 * Compute Levenshtein edit distance between two strings (case-insensitive).
 * Returns the number of single-character edits needed to transform a into b.
 */
export function levenshtein(a: string, b: string): number {
  const s1 = a.toLowerCase();
  const s2 = b.toLowerCase();
  if (s1 === s2) return 0;
  if (s1.length === 0) return s2.length;
  if (s2.length === 0) return s1.length;

  const prev = new Array(s2.length + 1);
  for (let i = 0; i <= s2.length; i++) prev[i] = i;

  for (let i = 1; i <= s1.length; i++) {
    let curr = i;
    for (let j = 1; j <= s2.length; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      const next = Math.min(
        prev[j] + 1,         // deletion
        curr + 1,            // insertion
        prev[j - 1] + cost,  // substitution
      );
      prev[j - 1] = curr;
      curr = next;
    }
    prev[s2.length] = curr;
  }
  return prev[s2.length];
}

// ── Date helpers ──────────────────────────────────────────────────────────────

function invoiceDateOf(inv: InvoiceForDupeCheck): string | null {
  return inv.invoiceDate ?? inv.issueDate ?? null;
}

function daysApart(a: string, b: string): number {
  const ta = new Date(a).getTime();
  const tb = new Date(b).getTime();
  if (Number.isNaN(ta) || Number.isNaN(tb)) return Number.POSITIVE_INFINITY;
  return Math.abs(ta - tb) / 86_400_000;
}

// ── Main detection ───────────────────────────────────────────────────────────

/**
 * Scan `newInvoices` against `existingInvoices` for likely duplicates.
 * Each new invoice can produce at most ONE warning (the most severe match wins).
 *
 * Returns an empty array when there are no concerns.
 */
export function detectDuplicates(
  newInvoices:      InvoiceForDupeCheck[],
  existingInvoices: InvoiceForDupeCheck[],
): DuplicateWarning[] {
  const warnings: DuplicateWarning[] = [];

  for (const incoming of newInvoices) {
    let best: DuplicateWarning | null = null;

    for (const existing of existingInvoices) {
      const newNum = incoming.invoiceNumber?.trim() ?? "";
      const oldNum = existing.invoiceNumber?.trim() ?? "";

      // Rule 1: Exact invoice-number match against a DIFFERENT customer
      // → highest confidence; almost certainly a data-quality problem.
      if (
        newNum &&
        oldNum &&
        newNum.toLowerCase() === oldNum.toLowerCase() &&
        incoming.customerName.toLowerCase() !== existing.customerName.toLowerCase()
      ) {
        const w: DuplicateWarning = {
          newInvoiceNumber:       incoming.invoiceNumber,
          existingInvoiceNumber:  existing.invoiceNumber,
          newCustomerName:        incoming.customerName,
          existingCustomerName:   existing.customerName,
          reason:                 "exact_number_different_customer",
          summary: `Invoice ${incoming.invoiceNumber} already exists for "${existing.customerName}" — but the new row is for "${incoming.customerName}".`,
          confidence:             "high",
        };
        best = w;
        break; // can't get more severe than this
      }

      // Rule 2: Near-match invoice number (1-2 char diff) for the SAME customer
      // → likely a typo or transposition in the new export.
      if (
        newNum &&
        oldNum &&
        incoming.customerName.toLowerCase() === existing.customerName.toLowerCase() &&
        newNum.toLowerCase() !== oldNum.toLowerCase()
      ) {
        const dist = levenshtein(newNum, oldNum);
        // Only flag if there's some overlap — single-char invoices ("1" vs "2") shouldn't trip
        const longer = Math.max(newNum.length, oldNum.length);
        if (dist > 0 && dist <= 2 && longer >= 4) {
          const w: DuplicateWarning = {
            newInvoiceNumber:       incoming.invoiceNumber,
            existingInvoiceNumber:  existing.invoiceNumber,
            newCustomerName:        incoming.customerName,
            existingCustomerName:   existing.customerName,
            reason:                 "near_number_same_customer",
            summary: `Invoice ${incoming.invoiceNumber} looks similar to existing ${existing.invoiceNumber} for the same customer (${dist}-character difference).`,
            confidence:             "medium",
          };
          if (!best) best = w;
        }
      }

      // Rule 3: Same customer + same amount + invoice dates within 7 days
      // → could be a re-export of the same invoice with a fresh number.
      if (
        incoming.customerName.toLowerCase() === existing.customerName.toLowerCase() &&
        Math.abs(incoming.amount - existing.amount) < 0.005 && // exact pence match
        incoming.amount > 0
      ) {
        const newDate = invoiceDateOf(incoming);
        const oldDate = invoiceDateOf(existing);
        if (
          newDate &&
          oldDate &&
          daysApart(newDate, oldDate) <= 7 &&
          newNum.toLowerCase() !== oldNum.toLowerCase()
        ) {
          const w: DuplicateWarning = {
            newInvoiceNumber:       incoming.invoiceNumber,
            existingInvoiceNumber:  existing.invoiceNumber,
            newCustomerName:        incoming.customerName,
            existingCustomerName:   existing.customerName,
            reason:                 "same_customer_same_amount_close_date",
            summary: `${incoming.invoiceNumber} matches existing ${existing.invoiceNumber} for ${existing.customerName} on amount + date (within 7 days).`,
            confidence:             "medium",
          };
          if (!best) best = w;
        }
      }
    }

    if (best) warnings.push(best);
  }

  return warnings;
}
