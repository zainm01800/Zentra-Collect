/**
 * src/app/tax/summary/page.tsx
 *
 * Self Assessment year-end summary — a clean, printable one-pager showing
 * gross income, allowable expenses, taxable profit, personal allowance,
 * estimated income tax, NI, total liability, and next payment date.
 *
 * Designed to be shared with an accountant or kept as a record.
 */

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import {
  getFinancialSettings,
  getMonthlyIncomeSeries,
} from "@/actions/financial-settings";
import { getMonthlyExpenseSeries } from "@/actions/expenses";
import { TaxYearSummaryPrint } from "@/components/tax-year-summary-print";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Year-end summary — Tax",
  description: "Self Assessment year-end income and tax summary.",
};

// ── UK tax constants (2024/25) ────────────────────────────────────────────────
const PERSONAL_ALLOWANCE  = 12_570;
const CLASS_4_LOWER_LIMIT = 12_570;
const CLASS_4_UPPER_LIMIT = 50_270;
const CLASS_4_RATE_LOWER  = 0.09;
const CLASS_4_RATE_UPPER  = 0.02;
const CLASS_2_NI_ANNUAL   = 179;

function calcIncomeTax(profit: number, ratePercent: number) {
  return Math.max(0, profit - PERSONAL_ALLOWANCE) * (ratePercent / 100);
}
function calcClass4NI(profit: number) {
  if (profit <= CLASS_4_LOWER_LIMIT) return 0;
  const lower = (Math.min(profit, CLASS_4_UPPER_LIMIT) - CLASS_4_LOWER_LIMIT) * CLASS_4_RATE_LOWER;
  const upper = Math.max(0, profit - CLASS_4_UPPER_LIMIT) * CLASS_4_RATE_UPPER;
  return lower + upper;
}
function calcClass2NI(profit: number) {
  return profit > PERSONAL_ALLOWANCE ? CLASS_2_NI_ANNUAL : 0;
}

/** Current UK tax year label: e.g. "2025/26" */
function taxYearLabel(): string {
  const now = new Date();
  const m = now.getUTCMonth() + 1;
  const d = now.getUTCDate();
  const y = now.getUTCFullYear();
  const taxYear = m > 4 || (m === 4 && d >= 6) ? y : y - 1;
  return `${taxYear}/${String(taxYear + 1).slice(-2)}`;
}

function nextSaPaymentDate(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const jan31     = new Date(Date.UTC(y,     0, 31));
  const jul31     = new Date(Date.UTC(y,     6, 31));
  const jan31Next = new Date(Date.UTC(y + 1, 0, 31));
  const date = now <= jan31 ? jan31 : now <= jul31 ? jul31 : jan31Next;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

export default async function TaxSummaryPage() {
  const [settings, monthSeries, expSeries] = await Promise.all([
    getFinancialSettings(),
    getMonthlyIncomeSeries(12),
    getMonthlyExpenseSeries(12),
  ]);

  const taxRatePercent = settings?.taxRatePercent ?? 20;
  const countryCode    = settings?.countryCode    ?? "GB";
  const isGB           = countryCode === "GB";

  const grossIncome     = monthSeries.reduce((s, m) => s + m.income,   0);
  const totalExpenses   = expSeries.reduce((s, e) => s + e.expenses, 0);
  const taxableProfit   = Math.max(0, grossIncome - totalExpenses);
  const personalAllow   = PERSONAL_ALLOWANCE;
  const taxableIncome   = Math.max(0, taxableProfit - personalAllow);
  const incomeTax       = calcIncomeTax(taxableProfit, taxRatePercent);
  const class4NI        = isGB ? calcClass4NI(taxableProfit) : 0;
  const class2NI        = isGB ? calcClass2NI(taxableProfit) : 0;
  const totalLiability  = incomeTax + class4NI + class2NI;
  const monthlySetAside = totalLiability / 12;

  const summary = {
    taxYear:         taxYearLabel(),
    grossIncome,
    totalExpenses,
    taxableProfit,
    personalAllow,
    taxableIncome,
    taxRatePercent,
    incomeTax,
    class4NI,
    class2NI,
    totalLiability,
    monthlySetAside,
    nextPayment:     nextSaPaymentDate(),
    isGB,
  };

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto">
        {/* Back link — server-safe, no event handlers */}
        <div className="mb-6 print:hidden">
          <Link
            href="/tax"
            className="flex items-center gap-1.5 text-[12.5px] font-medium w-fit transition-opacity hover:opacity-70"
            style={{ color: "var(--zn-ink-3)" }}
          >
            <ArrowLeft className="size-3.5" />
            Tax reserve
          </Link>
        </div>

        {/* Print button lives inside the client component */}
        <TaxYearSummaryPrint {...summary} />
      </div>
    </AppShell>
  );
}
