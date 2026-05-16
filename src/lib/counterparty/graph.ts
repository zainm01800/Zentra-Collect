/**
 * Counterparty graph — the practice-tier moat feature.
 *
 * When the SAME end-customer appears in multiple client ledgers across a
 * bookkeeper's portfolio, the practice's true exposure to that
 * counterparty isn't visible on any single ledger. This module builds a
 * cross-ledger view: "Acme owes 3 of your clients £18,200 across 7
 * invoices, oldest 64 days overdue."
 *
 * Matching strategy:
 *   - Primary key:   lowercased customerEmail (exact)
 *   - Fallback key:  normalised customerName (lowercase, collapsed whitespace,
 *                    stripped common suffixes like "ltd", "limited", "inc")
 *
 * We don't fuzzy-match; the fallback is deliberately strict so we don't
 * falsely conflate distinct customers with similar names. Two ledgers
 * with the same email always match; ledgers with no email match only on
 * an exact normalised-name hit.
 *
 * Pure functions — no I/O. Caller passes the per-client invoice arrays.
 */

import type { Invoice } from "@/types/zentra";

/**
 * Minimal client identity needed for grouping — accepts either the
 * localStorage `BookkeeperClient` shape or the demo data shape (whose
 * `name` lives at `client.business.name`). The caller normalises.
 */
interface ClientLike { id: string; name: string }

// ── Normalisation ──────────────────────────────────────────────────────────

/** Lowercase + trim email. Returns null for empty/falsy. */
function normaliseEmail(raw: string | undefined): string | null {
  if (!raw) return null;
  const t = raw.trim().toLowerCase();
  return t.length > 0 ? t : null;
}

const COMPANY_SUFFIXES = [
  "ltd", "limited", "plc", "llp", "lp", "inc", "incorporated",
  "corp", "corporation", "co", "company", "gmbh", "sa", "srl",
];

/**
 * Normalise a customer name for matching. Lowercases, collapses
 * whitespace, strips trailing punctuation, removes one trailing company
 * suffix. Returns null for empty/falsy.
 */
function normaliseName(raw: string | undefined): string | null {
  if (!raw) return null;
  let t = raw.trim().toLowerCase().replace(/[.,]/g, "").replace(/\s+/g, " ");
  // Strip one trailing suffix if present
  for (const suffix of COMPANY_SUFFIXES) {
    if (t.endsWith(` ${suffix}`)) {
      t = t.slice(0, -1 - suffix.length).trim();
      break;
    }
  }
  return t.length > 0 ? t : null;
}

/** The match key used to bucket invoices from different ledgers. */
function matchKeyFor(invoice: Invoice): string | null {
  return normaliseEmail(invoice.customerEmail) ?? normaliseName(invoice.customerName);
}

// ── Public types ───────────────────────────────────────────────────────────

export interface CounterpartyLedgerExposure {
  clientId:         string;
  clientName:       string;
  invoiceCount:     number;
  outstandingTotal: number;
  overdueCount:     number;
  oldestDaysOverdue: number;
}

export interface Counterparty {
  /** Stable key (the match key). */
  id:                  string;
  /** Best display name we saw across ledgers. */
  displayName:         string;
  /** First non-empty email we saw, if any. */
  email?:              string;
  /** True when the match was made on email rather than name. */
  matchedByEmail:      boolean;
  ledgers:             CounterpartyLedgerExposure[];
  totalOutstanding:    number;
  totalInvoices:       number;
  totalOverdue:        number;
  oldestDaysOverdue:   number;
  /** Quick verdict to colour the row. */
  riskLabel:           "watch" | "high" | "critical";
}

export interface InvoicesByClient {
  client:   ClientLike;
  invoices: Invoice[];
}

// ── Builder ────────────────────────────────────────────────────────────────

/**
 * Build the cross-ledger counterparty graph from per-client invoice
 * lists. Only counterparties that appear in 2+ ledgers are returned.
 * Sorted by totalOutstanding desc.
 */
export function buildCounterpartyGraph(
  perClient: InvoicesByClient[],
): Counterparty[] {
  // Bucket per key: key → list of (clientId, clientName, invoice)
  const buckets = new Map<
    string,
    Array<{
      clientId:    string;
      clientName:  string;
      invoice:     Invoice;
    }>
  >();
  // Cache "best name" / "first email" per key
  const meta = new Map<string, { displayName: string; email?: string; matchedByEmail: boolean }>();

  for (const { client, invoices } of perClient) {
    for (const invoice of invoices) {
      // Skip closed/paid items — exposure means OPEN exposure.
      if (invoice.amountOutstanding <= 0) continue;
      if (invoice.status === "paid" || invoice.status === "do_not_chase") continue;

      const key = matchKeyFor(invoice);
      if (!key) continue;
      const matchedByEmail = !!normaliseEmail(invoice.customerEmail);

      const bucket = buckets.get(key) ?? [];
      bucket.push({ clientId: client.id, clientName: client.name, invoice });
      buckets.set(key, bucket);

      if (!meta.has(key)) {
        meta.set(key, {
          displayName:    invoice.customerName,
          email:          normaliseEmail(invoice.customerEmail) ?? undefined,
          matchedByEmail,
        });
      } else if (matchedByEmail) {
        // Upgrade the meta if a later invoice carries an email
        const m = meta.get(key)!;
        m.email = m.email ?? normaliseEmail(invoice.customerEmail) ?? undefined;
        m.matchedByEmail = true;
      }
    }
  }

  // Now collapse each bucket into a Counterparty, but only when present in 2+ ledgers
  const out: Counterparty[] = [];
  for (const [key, rows] of buckets.entries()) {
    const ledgerMap = new Map<string, CounterpartyLedgerExposure>();
    for (const row of rows) {
      const existing = ledgerMap.get(row.clientId) ?? {
        clientId:         row.clientId,
        clientName:       row.clientName,
        invoiceCount:     0,
        outstandingTotal: 0,
        overdueCount:     0,
        oldestDaysOverdue: 0,
      };
      existing.invoiceCount += 1;
      existing.outstandingTotal += row.invoice.amountOutstanding;
      if (row.invoice.daysOverdue > 0) existing.overdueCount += 1;
      if (row.invoice.daysOverdue > existing.oldestDaysOverdue) {
        existing.oldestDaysOverdue = row.invoice.daysOverdue;
      }
      ledgerMap.set(row.clientId, existing);
    }

    if (ledgerMap.size < 2) continue; // not cross-ledger

    const ledgers = Array.from(ledgerMap.values()).sort(
      (a, b) => b.outstandingTotal - a.outstandingTotal,
    );
    const totalOutstanding  = ledgers.reduce((s, l) => s + l.outstandingTotal, 0);
    const totalInvoices     = ledgers.reduce((s, l) => s + l.invoiceCount, 0);
    const totalOverdue      = ledgers.reduce((s, l) => s + l.overdueCount, 0);
    const oldestDaysOverdue = ledgers.reduce((s, l) => Math.max(s, l.oldestDaysOverdue), 0);

    const m = meta.get(key)!;
    out.push({
      id:                key,
      displayName:       m.displayName,
      email:             m.email,
      matchedByEmail:    m.matchedByEmail,
      ledgers,
      totalOutstanding,
      totalInvoices,
      totalOverdue,
      oldestDaysOverdue,
      riskLabel:         riskLabelFor(totalOutstanding, oldestDaysOverdue, totalOverdue),
    });
  }

  return out.sort((a, b) => b.totalOutstanding - a.totalOutstanding);
}

function riskLabelFor(
  totalOutstanding:  number,
  oldestDaysOverdue: number,
  totalOverdue:      number,
): Counterparty["riskLabel"] {
  if (totalOutstanding >= 25_000 || oldestDaysOverdue >= 60) return "critical";
  if (totalOutstanding >= 5_000 || oldestDaysOverdue >= 30 || totalOverdue >= 3) return "high";
  return "watch";
}
