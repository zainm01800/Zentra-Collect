/**
 * Dashboard snapshot data — pure computations from server-fetched data.
 * Used by the dashboard page to produce compact at-a-glance cards for each
 * enabled module.
 */

import type { MonthlyIncomeSeries } from "@/actions/financial-settings";
import type { MonthlyExpenseSeries } from "@/actions/expenses";

// ── UK tax constants ─────────────────────────────────────────────────────────

const PERSONAL_ALLOWANCE  = 12_570;
const CLASS_4_LOWER_LIMIT =  12_570;
const CLASS_4_UPPER_LIMIT =  50_270;
const CLASS_4_RATE_LOWER  =      0.09;
const CLASS_4_RATE_UPPER  =      0.02;
const CLASS_2_NI_ANNUAL   =    179;

// ── Tax snapshot ─────────────────────────────────────────────────────────────

export interface TaxSnapshotData {
  /** Year-to-date taxable profit (income - expenses). */
  ytdProfit: number;
  /** Estimated tax owed on year-to-date profit. */
  ytdTaxEstimate: number;
  /** Days until next Self Assessment payment-on-account. */
  daysToNextSa: number;
  /** Friendly label for next SA payment, e.g. "31 January". */
  nextSaLabel: string;
  /** Description of the SA payment ("1st payment on account"). */
  nextSaDescription: string;
}

export function buildTaxSnapshot(
  incomeSeries: MonthlyIncomeSeries[],
  expenseSeries: MonthlyExpenseSeries[],
  taxRatePercent: number,
): TaxSnapshotData {
  const ytdIncome   = incomeSeries.reduce((sum, m) => sum + m.income, 0);
  const ytdExpenses = expenseSeries.reduce((sum, m) => sum + m.expenses, 0);
  const ytdProfit   = Math.max(0, ytdIncome - ytdExpenses);

  // Project to annual for tax bracket purposes
  const monthsCovered = Math.max(1, incomeSeries.length);
  const annualised    = (ytdProfit / monthsCovered) * 12;

  const incomeTax = Math.max(0, annualised - PERSONAL_ALLOWANCE) * (taxRatePercent / 100);
  let class4NI    = 0;
  if (annualised > CLASS_4_LOWER_LIMIT) {
    const lowerBand = (Math.min(annualised, CLASS_4_UPPER_LIMIT) - CLASS_4_LOWER_LIMIT) * CLASS_4_RATE_LOWER;
    const upperBand = Math.max(0, annualised - CLASS_4_UPPER_LIMIT) * CLASS_4_RATE_UPPER;
    class4NI = lowerBand + upperBand;
  }
  const class2NI         = annualised > PERSONAL_ALLOWANCE ? CLASS_2_NI_ANNUAL : 0;
  const annualLiability  = incomeTax + class4NI + class2NI;
  const ytdTaxEstimate   = (annualLiability / 12) * monthsCovered;

  // Next SA payment date
  const now = new Date();
  const y   = now.getUTCFullYear();
  const jan31     = Date.UTC(y, 0, 31);
  const jul31     = Date.UTC(y, 6, 31);
  const jan31Next = Date.UTC(y + 1, 0, 31);
  const target = now.getTime() <= jan31 ? { ts: jan31,     label: "31 January", desc: "1st payment on account" }
              :  now.getTime() <= jul31 ? { ts: jul31,     label: "31 July",    desc: "2nd payment on account" }
              :                           { ts: jan31Next, label: "31 January", desc: "1st payment on account" };

  const daysToNextSa = Math.ceil((target.ts - Date.now()) / 86_400_000);

  return {
    ytdProfit,
    ytdTaxEstimate,
    daysToNextSa,
    nextSaLabel:       target.label,
    nextSaDescription: target.desc,
  };
}

// ── Expenses snapshot ────────────────────────────────────────────────────────

export interface ExpensesSnapshotData {
  thisMonthTotal: number;
  lastMonthTotal: number;
  deltaPct:       number; // percent change vs last month, positive = up
  ytdTotal:       number;
  topCategory:    { name: string; total: number } | null;
}

export function buildExpensesSnapshot(
  expenseSeries: MonthlyExpenseSeries[],
  recentExpenses: Array<{ category: string; amount: number; date: string }>,
): ExpensesSnapshotData {
  const sorted = [...expenseSeries].sort((a, b) => a.yearMonth.localeCompare(b.yearMonth));
  const thisMonthTotal = sorted[sorted.length - 1]?.expenses ?? 0;
  const lastMonthTotal = sorted[sorted.length - 2]?.expenses ?? 0;
  const deltaPct = lastMonthTotal > 0
    ? ((thisMonthTotal - lastMonthTotal) / lastMonthTotal) * 100
    : 0;
  const ytdTotal = expenseSeries.reduce((sum, m) => sum + m.expenses, 0);

  // Top category from recent expenses
  const byCategory = new Map<string, number>();
  recentExpenses.forEach((e) => {
    byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + e.amount);
  });
  const topEntry = Array.from(byCategory.entries()).sort((a, b) => b[1] - a[1])[0];
  const topCategory = topEntry ? { name: topEntry[0], total: topEntry[1] } : null;

  return { thisMonthTotal, lastMonthTotal, deltaPct, ytdTotal, topCategory };
}

// ── MTD snapshot ─────────────────────────────────────────────────────────────

export interface MtdSnapshotData {
  /** Current quarter label, e.g. "Q3 2025/26". */
  currentQuarter: string;
  /** Income in the current quarter. */
  currentQuarterIncome: number;
  /** Days until the current quarter's submission deadline. */
  daysToDeadline: number;
  /** Friendly deadline date, e.g. "7 Aug 2026". */
  deadlineLabel: string;
}

export function buildMtdSnapshot(incomeSeries: MonthlyIncomeSeries[]): MtdSnapshotData {
  const now = new Date();
  const month = now.getUTCMonth(); // 0-11
  const year  = now.getUTCFullYear();

  // Quarter index: 0 = Apr-Jun, 1 = Jul-Sep, 2 = Oct-Dec, 3 = Jan-Mar
  const taxYearStart = month >= 3 ? year : year - 1;
  const monthsIntoTaxYear = (month - 3 + 12) % 12;
  const quarterIdx = Math.floor(monthsIntoTaxYear / 3);
  const quarterLabel = `Q${quarterIdx + 1} ${String(taxYearStart).slice(2)}/${String((taxYearStart + 1)).slice(2)}`;

  // Deadline: 1 month + 7 days after quarter end
  const quarterEndMonth = (3 + (quarterIdx + 1) * 3) % 12; // month after quarter end
  const deadlineYear    = quarterEndMonth < 4 ? taxYearStart + 1 : taxYearStart;
  const deadlineDate    = new Date(Date.UTC(deadlineYear, quarterEndMonth, 7));
  const daysToDeadline  = Math.ceil((deadlineDate.getTime() - Date.now()) / 86_400_000);
  const deadlineLabel   = deadlineDate.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

  // Sum income for the current quarter — last 3 entries of the series
  const lastThree = incomeSeries.slice(-3);
  const currentQuarterIncome = lastThree.reduce((sum, m) => sum + m.income, 0);

  return {
    currentQuarter: quarterLabel,
    currentQuarterIncome,
    daysToDeadline,
    deadlineLabel,
  };
}
