/**
 * Cash flow forecast from invoice data.
 *
 * Projects expected cash inflow over 30/60/90 days. Every invoice contributes:
 *   - To the time bucket where it's most likely to land (based on promise/due date + risk)
 *   - Weighted by a probability that decays with overdue days and customer risk
 *
 * This is deterministic — pure rules, no AI. Easy to explain to users.
 * AI prediction is a future upgrade path.
 */

import type { Invoice } from "@/types/cashpilot";
import { computeCustomerRiskMap, type RiskLevel } from "@/lib/risk-score";

// ── Types ─────────────────────────────────────────────────────────────────────

export type ForecastWindow = "30" | "60" | "90";

export interface CashForecast {
  /** Expected inflow within the next 30 days (probability-weighted £). */
  next30: number;
  /** Expected inflow 31–60 days (probability-weighted £). */
  next60: number;
  /** Expected inflow 61–90 days (probability-weighted £). */
  next90: number;
  /** Money at risk — long-overdue and from high-risk customers. */
  atRisk: number;
  /** Sum of all open invoice amounts (denominator for context). */
  totalOpen: number;
  /** Top 3 customers contributing to the upcoming inflow. */
  topPayers: Array<{
    customerName: string;
    expectedAmount: number;
    window: ForecastWindow;
  }>;
  /** ISO timestamp when this forecast was computed. */
  generatedAt: string;
}

// ── Probability model ─────────────────────────────────────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Probability that an invoice will actually be paid within its expected window.
 *
 * Tuned to be conservative — better to under-predict and have cash arrive
 * than over-predict and miss the runway.
 */
function paymentProbability(inv: Invoice, riskLevel: RiskLevel): number {
  // Promised payment with a date → strong signal
  if (inv.status === "Promised payment" && inv.promisedPaymentDate) {
    return riskLevel >= 4 ? 0.60 : 0.85;
  }

  // Disputed → almost no chance of timely payment
  if (inv.status === "Disputed") return 0.10;

  // Not yet due → most customers pay on time
  if (inv.daysOverdue <= 0) {
    return riskLevel >= 4 ? 0.60 : 0.90;
  }

  // Overdue — probability decays with overdue length and risk
  if (inv.daysOverdue <= 14)  return riskLevel >= 4 ? 0.50 : 0.70;
  if (inv.daysOverdue <= 30)  return riskLevel >= 4 ? 0.35 : 0.55;
  if (inv.daysOverdue <= 60)  return riskLevel >= 4 ? 0.20 : 0.40;
  if (inv.daysOverdue <= 90)  return riskLevel >= 4 ? 0.15 : 0.30;
  return riskLevel >= 4 ? 0.10 : 0.20;
}

/**
 * Decide which time-bucket window this invoice belongs in.
 * Returns "out" for invoices not expected within 90 days.
 */
function expectedWindow(
  inv: Invoice,
  riskLevel: RiskLevel,
): ForecastWindow | "out" {
  const now = Date.now();

  // 1) Promise date wins if present
  if (inv.promisedPaymentDate) {
    const daysToPromise = Math.floor(
      (new Date(inv.promisedPaymentDate).getTime() - now) / DAY_MS,
    );
    if (daysToPromise <= 30) return "30";
    if (daysToPromise <= 60) return "60";
    if (daysToPromise <= 90) return "90";
    return "out";
  }

  // 2) Not yet due → near the due date
  if (inv.daysOverdue <= 0 && inv.dueDate) {
    const daysToDue = Math.floor(
      (new Date(inv.dueDate).getTime() - now) / DAY_MS,
    );
    if (daysToDue <= 30) return "30";
    if (daysToDue <= 60) return "60";
    if (daysToDue <= 90) return "90";
    return "out";
  }

  // 3) Overdue — depends on risk and how late
  if (riskLevel >= 4) {
    // High-risk → longer collection cycle
    if (inv.daysOverdue <= 30) return "60";
    if (inv.daysOverdue <= 60) return "90";
    return "out";
  }
  if (inv.daysOverdue <= 14)  return "30";
  if (inv.daysOverdue <= 60)  return "60";
  if (inv.daysOverdue <= 120) return "90";
  return "out";
}

// ── Main ──────────────────────────────────────────────────────────────────────

/**
 * Compute the full cash forecast from an invoice list.
 * Safe to call on every render — O(n) over invoices.
 */
export function computeCashForecast(invoices: Invoice[]): CashForecast {
  const open = invoices.filter((inv) => inv.status !== "Paid");
  const riskMap = computeCustomerRiskMap(invoices);

  let next30 = 0;
  let next60 = 0;
  let next90 = 0;
  let atRisk = 0;
  let totalOpen = 0;

  // Sum expected amount per customer across all windows; track best window
  const perCustomer = new Map<
    string,
    { amount: number; window: ForecastWindow }
  >();

  for (const inv of open) {
    totalOpen += inv.amount;
    const riskLevel = (riskMap.get(inv.customerName)?.level ?? 3) as RiskLevel;

    const window = expectedWindow(inv, riskLevel);
    const prob = paymentProbability(inv, riskLevel);
    const expectedAmount = inv.amount * prob;

    if (window === "30") next30 += expectedAmount;
    else if (window === "60") next60 += expectedAmount;
    else if (window === "90") next90 += expectedAmount;

    // "At risk" — long-overdue (>30d), no promise, from high-risk customers
    if (
      inv.daysOverdue > 30 &&
      !inv.promisedPaymentDate &&
      riskLevel >= 4
    ) {
      atRisk += inv.amount;
    }

    // Track contribution per customer (use highest single contribution + its window)
    if (window !== "out" && expectedAmount > 0) {
      const existing = perCustomer.get(inv.customerName);
      const nextAmount = (existing?.amount ?? 0) + expectedAmount;
      // Bucket the customer in their largest single invoice's window
      const nextWindow =
        !existing || expectedAmount > existing.amount
          ? window
          : existing.window;
      perCustomer.set(inv.customerName, {
        amount: nextAmount,
        window: nextWindow,
      });
    }
  }

  const topPayers = Array.from(perCustomer.entries())
    .map(([customerName, { amount, window }]) => ({
      customerName,
      expectedAmount: Math.round(amount),
      window,
    }))
    .sort((a, b) => b.expectedAmount - a.expectedAmount)
    .slice(0, 3);

  return {
    next30:    Math.round(next30),
    next60:    Math.round(next60),
    next90:    Math.round(next90),
    atRisk:    Math.round(atRisk),
    totalOpen: Math.round(totalOpen),
    topPayers,
    generatedAt: new Date().toISOString(),
  };
}
