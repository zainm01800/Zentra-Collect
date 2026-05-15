/**
 * Customer payment risk scoring.
 *
 * Deterministic 1–5 score per customer, computed from their full invoice history.
 * Higher score = more likely to pay late or default.
 *
 * This is NOT an AI model — it's an explainable rules engine. Every score
 * carries a `reason` string so the user understands why a customer is rated
 * as they are. Easy to audit, easy to trust.
 *
 * Signals used:
 *   - Max / average days overdue across open invoices
 *   - Total chase count
 *   - Broken promises (promisedPaymentDate in past, invoice still open)
 *   - Number of disputed invoices
 *   - Relationship tag ("problematic payer")
 *   - Invoice volume (only fires for repeat patterns)
 */

import type { Invoice } from "@/types/cashpilot";

// ── Types ─────────────────────────────────────────────────────────────────────

export type RiskLevel = 1 | 2 | 3 | 4 | 5;
export type RiskLabel = "Low" | "Watch" | "Medium" | "High" | "Critical";

export interface CustomerRisk {
  customerName: string;
  level:        RiskLevel;
  label:        RiskLabel;
  /** Plain-English one-sentence explanation of the score. */
  reason:       string;
  /** Aggregate stats — useful for UI tooltips. */
  stats: {
    openInvoiceCount:   number;
    totalOutstanding:   number;
    averageDaysOverdue: number;
    maxDaysOverdue:     number;
    totalChaseCount:    number;
    brokenPromises:     number;
    disputedInvoices:   number;
  };
}

// ── Label mapping ─────────────────────────────────────────────────────────────

const LABELS: Record<RiskLevel, RiskLabel> = {
  1: "Low",
  2: "Watch",
  3: "Medium",
  4: "High",
  5: "Critical",
};

// ── Core scorer ───────────────────────────────────────────────────────────────

/**
 * Compute the risk score for one customer from their invoices.
 * Uses the most severe signal that fires — never averages signals,
 * because risk is dominated by the worst behaviour, not the average.
 */
export function computeCustomerRisk(
  customerName: string,
  customerInvoices: Invoice[],
): CustomerRisk {
  const open = customerInvoices.filter((inv) => inv.status !== "Paid");

  const openInvoiceCount = open.length;
  const totalOutstanding = open.reduce((sum, inv) => sum + inv.amount, 0);
  const averageDaysOverdue = openInvoiceCount > 0
    ? Math.round(
        open.reduce((sum, inv) => sum + Math.max(0, inv.daysOverdue), 0) /
          openInvoiceCount,
      )
    : 0;
  const maxDaysOverdue  = open.reduce((max, inv) => Math.max(max, inv.daysOverdue), 0);
  const totalChaseCount = open.reduce((sum, inv) => sum + inv.chaseCount, 0);

  // Broken promise: promise date is in the past AND invoice is still overdue.
  const brokenPromises = open.filter((inv) => {
    if (!inv.promisedPaymentDate) return false;
    return (
      new Date(inv.promisedPaymentDate).getTime() < Date.now() &&
      inv.daysOverdue > 0
    );
  }).length;

  const disputedInvoices = open.filter((inv) => inv.status === "Disputed").length;
  const isProblemPayer   = customerInvoices.some(
    (inv) => inv.relationshipType === "problematic payer",
  );

  // ── Scoring — take the worst signal, not the average ────────────────────
  let score: RiskLevel = 1;
  let reason = "";

  function bump(level: RiskLevel, why: string) {
    if (level > score) {
      score = level;
      reason = why;
    } else if (level === score && !reason) {
      reason = why;
    }
  }

  if (isProblemPayer) bump(4, "Tagged as problematic payer");

  if (brokenPromises >= 2) bump(5, `${brokenPromises} broken promises`);
  else if (brokenPromises >= 1) bump(4, "1 broken promise");

  if (maxDaysOverdue >= 90)      bump(5, `Invoice ${maxDaysOverdue} days overdue`);
  else if (maxDaysOverdue >= 60) bump(4, `Invoice ${maxDaysOverdue} days overdue`);
  else if (maxDaysOverdue >= 30) bump(3, `${maxDaysOverdue} days overdue`);

  if (totalChaseCount >= 5)      bump(4, `Chased ${totalChaseCount} times`);
  else if (totalChaseCount >= 3) bump(3, `Chased ${totalChaseCount} times`);

  if (disputedInvoices >= 1)
    bump(3, `${disputedInvoices} disputed invoice${disputedInvoices > 1 ? "s" : ""}`);

  if (averageDaysOverdue >= 30 && openInvoiceCount >= 2)
    bump(3, `Average ${averageDaysOverdue} days late across ${openInvoiceCount} invoices`);

  if (!reason) {
    reason =
      openInvoiceCount === 0
        ? "No open invoices"
        : maxDaysOverdue > 0
          ? "On-time payer with minor delays"
          : "On-time payer";
  }

  return {
    customerName,
    level: score,
    label: LABELS[score],
    reason,
    stats: {
      openInvoiceCount,
      totalOutstanding,
      averageDaysOverdue,
      maxDaysOverdue,
      totalChaseCount,
      brokenPromises,
      disputedInvoices,
    },
  };
}

/**
 * Build a risk profile for every unique customer in an invoice list.
 * Returns a Map keyed by customer name for O(1) lookup in render code.
 */
export function computeCustomerRiskMap(invoices: Invoice[]): Map<string, CustomerRisk> {
  const byCustomer = new Map<string, Invoice[]>();
  for (const inv of invoices) {
    const existing = byCustomer.get(inv.customerName) ?? [];
    existing.push(inv);
    byCustomer.set(inv.customerName, existing);
  }
  const out = new Map<string, CustomerRisk>();
  for (const [name, invs] of byCustomer) {
    out.set(name, computeCustomerRisk(name, invs));
  }
  return out;
}

// ── UI helpers ────────────────────────────────────────────────────────────────

/** Tailwind/CSS-ready colour token for each risk level. */
export function riskTone(level: RiskLevel): {
  bg: string;
  fg: string;
  border: string;
} {
  switch (level) {
    case 1: return { bg: "var(--zn-safe-soft)",   fg: "var(--zn-safe)",   border: "var(--zn-safe)" };
    case 2: return { bg: "var(--zn-surface-2)",   fg: "var(--zn-ink-2)",  border: "var(--zn-line)" };
    case 3: return { bg: "var(--zn-warn-soft)",   fg: "var(--zn-warn)",   border: "var(--zn-warn)" };
    case 4: return { bg: "var(--zn-risk-soft)",   fg: "var(--zn-risk)",   border: "var(--zn-risk)" };
    case 5: return { bg: "var(--zn-risk-soft)",   fg: "var(--zn-risk)",   border: "var(--zn-risk)" };
  }
}
