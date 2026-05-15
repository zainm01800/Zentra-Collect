/**
 * Client AR report — computation lib.
 *
 * Pure functions that turn an invoice list into a structured summary suitable
 * for rendering as a printable PDF report a bookkeeper can send to their client.
 *
 * Works with both cashpilot.Invoice and zentra.Invoice via a permissive
 * minimal interface (matches the InvoiceForRisk pattern in risk-score.ts).
 */

// ── Permissive input type ─────────────────────────────────────────────────────

export interface InvoiceForReport {
  id?:               string;
  customerName:      string;
  invoiceNumber:     string;
  amount:            number;
  amountOutstanding?: number;
  dueDate?:          string;
  invoiceDate?:      string;
  daysOverdue:       number;
  status:            string;
  promisedPaymentDate?: string | null;
}

// ── Result types ──────────────────────────────────────────────────────────────

export interface AgedBucket {
  label:        "Current" | "1-30 days" | "31-60 days" | "61-90 days" | "90+ days";
  amount:       number;
  invoiceCount: number;
}

export interface ClientReport {
  /** Total outstanding across all open invoices. */
  totalOutstanding: number;
  /** Total of overdue (>0 days late) only. */
  totalOverdue:     number;
  /** Number of distinct customers with at least one open invoice. */
  customerCount:    number;
  /** Number of open invoices. */
  openInvoiceCount: number;
  /** Average days overdue (only counts invoices that ARE overdue). */
  averageDaysOverdue: number;
  /** Oldest open invoice in days. */
  oldestOverdueDays:  number;

  /** Aged-debt breakdown — always 5 buckets in order. */
  agedDebt:        AgedBucket[];

  /** Top 10 most overdue invoices (sorted by daysOverdue desc, then amount). */
  topOverdue:      InvoiceForReport[];

  /** Customers with the most outstanding (top 5). */
  topDebtors: Array<{
    customerName:     string;
    totalOutstanding: number;
    invoiceCount:     number;
    maxDaysOverdue:   number;
  }>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Outstanding amount preferring amountOutstanding when provided. */
function outstandingOf(inv: InvoiceForReport): number {
  return inv.amountOutstanding ?? inv.amount;
}

function isPaid(inv: InvoiceForReport): boolean {
  return inv.status.toLowerCase() === "paid";
}

function bucketFor(daysOverdue: number): AgedBucket["label"] {
  if (daysOverdue <= 0) return "Current";
  if (daysOverdue <= 30) return "1-30 days";
  if (daysOverdue <= 60) return "31-60 days";
  if (daysOverdue <= 90) return "61-90 days";
  return "90+ days";
}

// ── Main ──────────────────────────────────────────────────────────────────────

/**
 * Compute the full report from a list of invoices.
 * Pure function, O(n) over invoices. Safe to call on every render.
 */
export function computeClientReport(invoices: InvoiceForReport[]): ClientReport {
  const open = invoices.filter((inv) => !isPaid(inv));

  // ── Totals ────────────────────────────────────────────────────────────────
  let totalOutstanding = 0;
  let totalOverdue = 0;
  let oldestOverdueDays = 0;
  let overdueSumDays = 0;
  let overdueCount = 0;
  const customerSet = new Set<string>();

  for (const inv of open) {
    const out = outstandingOf(inv);
    totalOutstanding += out;
    customerSet.add(inv.customerName);
    if (inv.daysOverdue > 0) {
      totalOverdue += out;
      overdueSumDays += inv.daysOverdue;
      overdueCount += 1;
      if (inv.daysOverdue > oldestOverdueDays) oldestOverdueDays = inv.daysOverdue;
    }
  }

  // ── Aged buckets ──────────────────────────────────────────────────────────
  const bucketMap = new Map<AgedBucket["label"], AgedBucket>([
    ["Current",    { label: "Current",    amount: 0, invoiceCount: 0 }],
    ["1-30 days",  { label: "1-30 days",  amount: 0, invoiceCount: 0 }],
    ["31-60 days", { label: "31-60 days", amount: 0, invoiceCount: 0 }],
    ["61-90 days", { label: "61-90 days", amount: 0, invoiceCount: 0 }],
    ["90+ days",   { label: "90+ days",   amount: 0, invoiceCount: 0 }],
  ]);
  for (const inv of open) {
    const bucket = bucketMap.get(bucketFor(inv.daysOverdue))!;
    bucket.amount += outstandingOf(inv);
    bucket.invoiceCount += 1;
  }

  // ── Top overdue invoices ──────────────────────────────────────────────────
  const topOverdue = [...open]
    .filter((inv) => inv.daysOverdue > 0)
    .sort((a, b) => {
      if (b.daysOverdue !== a.daysOverdue) return b.daysOverdue - a.daysOverdue;
      return outstandingOf(b) - outstandingOf(a);
    })
    .slice(0, 10);

  // ── Top debtors ───────────────────────────────────────────────────────────
  const byCustomer = new Map<
    string,
    { totalOutstanding: number; invoiceCount: number; maxDaysOverdue: number }
  >();
  for (const inv of open) {
    const existing = byCustomer.get(inv.customerName) ?? {
      totalOutstanding: 0,
      invoiceCount: 0,
      maxDaysOverdue: 0,
    };
    existing.totalOutstanding += outstandingOf(inv);
    existing.invoiceCount += 1;
    if (inv.daysOverdue > existing.maxDaysOverdue) {
      existing.maxDaysOverdue = inv.daysOverdue;
    }
    byCustomer.set(inv.customerName, existing);
  }
  const topDebtors = Array.from(byCustomer.entries())
    .map(([customerName, stats]) => ({ customerName, ...stats }))
    .sort((a, b) => b.totalOutstanding - a.totalOutstanding)
    .slice(0, 5);

  return {
    totalOutstanding: Math.round(totalOutstanding),
    totalOverdue:     Math.round(totalOverdue),
    customerCount:    customerSet.size,
    openInvoiceCount: open.length,
    averageDaysOverdue: overdueCount > 0 ? Math.round(overdueSumDays / overdueCount) : 0,
    oldestOverdueDays,
    agedDebt:         Array.from(bucketMap.values()),
    topOverdue,
    topDebtors,
  };
}
