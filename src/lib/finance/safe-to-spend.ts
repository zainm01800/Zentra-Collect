/**
 * safe-to-spend.ts
 *
 * Pure calculation module for the "safe to spend" feature.
 * No runtime dependencies — only the Invoice type from src/types/zentra.ts.
 *
 * The headline number answers: "Given my bank balance, tax obligations, and
 * bills that must be paid this week, how much can I actually spend right now?"
 *
 *   safeToSpend = bankBalance − taxSetAside − billsDueSoon
 *
 * Invoice data enriches the result with forward-looking context
 * (expected cash this week / month, at-risk receivables) but does NOT
 * feed into the safeToSpend formula itself — incoming money that hasn't
 * landed yet is never counted as spendable.
 */

import type { Invoice } from "@/types/zentra";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SafeToSpendInput {
  /** Current bank balance in the account's currency. */
  bankBalance: number;
  /**
   * All invoices for the account. Paid and do-not-chase invoices are
   * filtered out internally before any aggregation.
   */
  invoices: Invoice[];
  /**
   * Tax rate as a percentage (e.g. 20 for 20 %).
   * Defaults to 20 (UK basic-rate approximation).
   *
   * This is a conservative flat-rate reserve — it does not account for
   * personal allowances, expense deductions, or tax bands. Users should
   * consult a qualified accountant for their actual liability.
   */
  taxRatePercent?: number;
  /** Upcoming bills the user has manually recorded. */
  manualBills: { description: string; amount: number; dueDate: string }[];
  /**
   * ISO date string (YYYY-MM-DD or full ISO-8601) used as "today" for all
   * date-window calculations. Defaults to the current UTC date when omitted.
   * Passing an explicit date makes results deterministic in tests.
   */
  referenceDate?: string;
}

export interface SafeToSpendResult {
  /** Headline number: how much of the bank balance is safe to spend now. */
  safeToSpend: number;
  /** Amount reserved for tax: bankBalance × taxRatePercent / 100. */
  taxSetAside: number;
  /**
   * Total of manual bills whose due date falls on or before
   * referenceDate + 7 days (including already-overdue bills).
   */
  billsDueSoon: number;
  /**
   * Outstanding amount across invoices overdue by more than 45 days.
   * Shown as a caution — long-overdue cash may not arrive soon.
   */
  overdueAtRisk: number;
  /**
   * Outstanding amount on invoices with a due date within the next 7 days
   * (future-due only; already-overdue invoices are excluded here).
   */
  expectedThisWeek: number;
  /**
   * Outstanding amount on invoices with a due date within the next 30 days
   * (future-due only; already-overdue invoices are excluded here).
   */
  expectedThisMonth: number;
  /** Traffic-light status for UI colouring. */
  statusLabel: "safe" | "caution" | "low";
  /** Short plain-English message to display beneath the headline number. */
  statusMessage: string;
  /**
   * Ordered components that make up the safe-to-spend figure, suitable for
   * rendering a waterfall / breakdown card in the UI.
   *
   * type "income"    — positive contributors (bank balance, expected receipts)
   * type "reserve"   — money set aside but not spent (tax)
   * type "deduction" — committed outgoings that reduce what's spendable
   */
  breakdown: {
    label: string;
    amount: number;
    type: "income" | "deduction" | "reserve";
  }[];
}

// ── Internal constants ────────────────────────────────────────────────────────

/** Default UK basic-rate tax approximation. */
const DEFAULT_TAX_RATE_PERCENT = 20;

/** Invoices overdue beyond this threshold are flagged as "at risk". */
const AT_RISK_OVERDUE_DAYS = 45;

/**
 * Bills due within this many days of the reference date are included in
 * billsDueSoon (including already-overdue bills, i.e. daysUntilDue < 0).
 */
const BILLS_WINDOW_DAYS = 7;

/** Window for expectedThisWeek. */
const EXPECTED_WEEK_DAYS = 7;

/** Window for expectedThisMonth. */
const EXPECTED_MONTH_DAYS = 30;

// Status thresholds expressed as a fraction of bankBalance.
const SAFE_THRESHOLD = 0.4;
const CAUTION_THRESHOLD = 0.2;

const STATUS_MESSAGES: Record<"safe" | "caution" | "low", string> = {
  safe: "You're in a safe zone",
  caution: "Spend carefully this week",
  low: "Keep spending low right now",
};

// ── Internal date helpers ─────────────────────────────────────────────────────

/**
 * Parse an ISO date string to a UTC midnight Date object.
 * Strips the time component so all comparisons are date-only and
 * unaffected by the host system's local timezone or DST.
 */
function parseUtcDate(iso: string): Date {
  // Slice to "YYYY-MM-DD" regardless of whether a time part is present.
  return new Date(`${iso.slice(0, 10)}T00:00:00.000Z`);
}

/**
 * Return the signed number of whole days from Date `a` to Date `b`.
 * Positive when `b` is in the future relative to `a`.
 */
function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

/** Return today expressed as a UTC midnight Date. */
function utcToday(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

// ── Exported helpers ──────────────────────────────────────────────────────────

/**
 * Calculate the tax set-aside amount for a given gross balance and rate.
 *
 * This is a flat-percentage estimate — a conservative buffer, not a precise
 * tax liability. It does not account for allowances, expenses, or tax bands.
 *
 * @param grossIncome    Gross income or bank balance to calculate tax on.
 * @param taxRatePercent Tax rate as a percentage (e.g. 20 for 20 %).
 * @returns              Amount to set aside for tax. Returns 0 for non-positive inputs.
 *
 * @example estimateTaxSetAside(10_000, 20)  → 2_000
 * @example estimateTaxSetAside(3_500, 20)   → 700
 * @example estimateTaxSetAside(0, 20)       → 0
 */
export function estimateTaxSetAside(grossIncome: number, taxRatePercent: number): number {
  if (grossIncome <= 0 || taxRatePercent <= 0) return 0;
  return grossIncome * (taxRatePercent / 100);
}

/**
 * Derive a traffic-light status label from the safe-to-spend amount
 * relative to the original bank balance.
 *
 * Thresholds:
 *   safeToSpend > bankBalance × 0.40  →  "safe"     (40 %+ of balance remains)
 *   safeToSpend > bankBalance × 0.20  →  "caution"  (20–40 % of balance remains)
 *   otherwise                          →  "low"      (< 20 % of balance remains)
 *
 * A zero or negative bank balance always returns "low".
 *
 * @param safeToSpend The calculated safe-to-spend amount.
 * @param bankBalance The original bank balance used in the calculation.
 * @returns           Status label for UI colouring.
 *
 * @example getStatusFromBalance(5_000, 10_000)  →  "safe"    // 50 % > 40 %
 * @example getStatusFromBalance(2_500, 10_000)  →  "caution" // 25 % > 20 %
 * @example getStatusFromBalance(1_000, 10_000)  →  "low"     // 10 % < 20 %
 */
export function getStatusFromBalance(
  safeToSpend: number,
  bankBalance: number,
): "safe" | "caution" | "low" {
  if (bankBalance <= 0) return "low";
  if (safeToSpend > bankBalance * SAFE_THRESHOLD) return "safe";
  if (safeToSpend > bankBalance * CAUTION_THRESHOLD) return "caution";
  return "low";
}

// ── Main calculation ──────────────────────────────────────────────────────────

/**
 * Calculate how much of the current bank balance is genuinely safe to spend.
 *
 * **Formula**
 * ```
 * taxSetAside  = bankBalance × (taxRatePercent / 100)
 * billsDueSoon = sum of manual bills due within 7 days (including overdue)
 * safeToSpend  = max(0, bankBalance − taxSetAside − billsDueSoon)
 * ```
 *
 * **Invoice fields consumed**
 * - `dueDate`           – determines expected-this-week / month windows
 * - `daysOverdue`       – determines overdueAtRisk (> 45 days overdue)
 * - `amountOutstanding` – the cash value used in all aggregations
 * - `status`            – "paid" and "do_not_chase" are always excluded
 *
 * Invoice amounts are informational only and do not affect safeToSpend.
 * Cash that hasn't landed yet is never counted as spendable.
 *
 * @param input  See {@link SafeToSpendInput}.
 * @returns      See {@link SafeToSpendResult}.
 *
 * @example
 * // 1 — Healthy balance, no bills → "safe"
 * calculateSafeToSpend({
 *   bankBalance: 10_000,
 *   invoices: [],
 *   taxRatePercent: 20,
 *   manualBills: [],
 * });
 * // → { safeToSpend: 8_000, taxSetAside: 2_000, billsDueSoon: 0,
 * //     statusLabel: "safe", statusMessage: "You're in a safe zone", ... }
 *
 * @example
 * // 2 — Large bill due in 3 days eats most of the remaining balance → "caution"
 * calculateSafeToSpend({
 *   bankBalance: 5_000,
 *   invoices: [],
 *   taxRatePercent: 20,
 *   manualBills: [{ description: "VAT return", amount: 2_500, dueDate: "2026-05-14" }],
 *   referenceDate: "2026-05-11",
 * });
 * // → { safeToSpend: 1_500, taxSetAside: 1_000, billsDueSoon: 2_500,
 * //     statusLabel: "caution", statusMessage: "Spend carefully this week", ... }
 * //   (1_500 / 5_000 = 30 %, sits between 20 % and 40 % thresholds)
 *
 * @example
 * // 3 — Zero balance always returns "low" with all zeroes
 * calculateSafeToSpend({
 *   bankBalance: 0,
 *   invoices: [],
 *   taxRatePercent: 20,
 *   manualBills: [],
 * });
 * // → { safeToSpend: 0, taxSetAside: 0, billsDueSoon: 0,
 * //     statusLabel: "low", statusMessage: "Keep spending low right now", ... }
 */
export function calculateSafeToSpend(input: SafeToSpendInput): SafeToSpendResult {
  const {
    bankBalance,
    invoices,
    taxRatePercent = DEFAULT_TAX_RATE_PERCENT,
    manualBills,
    referenceDate,
  } = input;

  const ref = referenceDate ? parseUtcDate(referenceDate) : utcToday();

  // ── Tax reserve ─────────────────────────────────────────────────────────────

  const taxSetAside = estimateTaxSetAside(bankBalance, taxRatePercent);

  // ── Bills due within the next 7 days (including already-overdue) ─────────────

  const billsDueSoon = manualBills.reduce<number>((sum, bill) => {
    const daysUntilDue = daysBetween(ref, parseUtcDate(bill.dueDate));
    // Include bills that are already overdue (< 0) or due within the window.
    if (daysUntilDue <= BILLS_WINDOW_DAYS) {
      return sum + Math.max(0, bill.amount);
    }
    return sum;
  }, 0);

  // ── Invoice aggregations ─────────────────────────────────────────────────────

  // Exclude paid and do-not-chase invoices from all calculations.
  const activeInvoices = invoices.filter(
    (inv) => inv.status !== "paid" && inv.status !== "do_not_chase",
  );

  // Overdue > 45 days: outstanding balance is at risk of not arriving soon.
  const overdueAtRisk = activeInvoices.reduce<number>((sum, inv) => {
    if (inv.daysOverdue > AT_RISK_OVERDUE_DAYS) {
      return sum + Math.max(0, inv.amountOutstanding);
    }
    return sum;
  }, 0);

  // Expected this week: invoices whose due date is 0–7 days from referenceDate.
  // Strictly future-due — already-overdue invoices are captured by overdueAtRisk.
  const expectedThisWeek = activeInvoices.reduce<number>((sum, inv) => {
    if (!inv.dueDate) return sum;
    const daysUntilDue = daysBetween(ref, parseUtcDate(inv.dueDate));
    if (daysUntilDue >= 0 && daysUntilDue <= EXPECTED_WEEK_DAYS) {
      return sum + Math.max(0, inv.amountOutstanding);
    }
    return sum;
  }, 0);

  // Expected this month: invoices whose due date is 0–30 days from referenceDate.
  const expectedThisMonth = activeInvoices.reduce<number>((sum, inv) => {
    if (!inv.dueDate) return sum;
    const daysUntilDue = daysBetween(ref, parseUtcDate(inv.dueDate));
    if (daysUntilDue >= 0 && daysUntilDue <= EXPECTED_MONTH_DAYS) {
      return sum + Math.max(0, inv.amountOutstanding);
    }
    return sum;
  }, 0);

  // ── Headline safe-to-spend ───────────────────────────────────────────────────

  // Floor at 0: the user can't spend a negative amount.
  const safeToSpend = Math.max(0, bankBalance - taxSetAside - billsDueSoon);

  // ── Status ───────────────────────────────────────────────────────────────────

  const statusLabel = getStatusFromBalance(safeToSpend, bankBalance);
  const statusMessage = STATUS_MESSAGES[statusLabel];

  // ── Breakdown ────────────────────────────────────────────────────────────────
  //
  // Always include the bank balance and tax reserve (even when zero) so the
  // card always shows at least two rows. Optional rows are added only when
  // their amount is non-zero, keeping the UI uncluttered.

  const breakdown: SafeToSpendResult["breakdown"] = [
    {
      label: "Bank balance",
      amount: bankBalance,
      type: "income",
    },
    {
      label: "Tax reserve",
      amount: taxSetAside,
      type: "reserve",
    },
  ];

  if (billsDueSoon > 0) {
    breakdown.push({
      label: "Bills due this week",
      amount: billsDueSoon,
      type: "deduction",
    });
  }

  if (expectedThisWeek > 0) {
    breakdown.push({
      label: "Expected this week",
      amount: expectedThisWeek,
      type: "income",
    });
  }

  if (expectedThisMonth > 0) {
    breakdown.push({
      label: "Expected this month",
      amount: expectedThisMonth,
      type: "income",
    });
  }

  if (overdueAtRisk > 0) {
    breakdown.push({
      label: `Overdue at risk (>${AT_RISK_OVERDUE_DAYS} days)`,
      amount: overdueAtRisk,
      type: "deduction",
    });
  }

  return {
    safeToSpend,
    taxSetAside,
    billsDueSoon,
    overdueAtRisk,
    expectedThisWeek,
    expectedThisMonth,
    statusLabel,
    statusMessage,
    breakdown,
  };
}
