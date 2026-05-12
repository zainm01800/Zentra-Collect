/**
 * src/app/tax/page.tsx
 *
 * Tax reserve page — shows how much income tax + NI the user should be
 * setting aside, progress toward the full-year estimate, a per-month
 * tracker, an expandable step-by-step calculation, and the next
 * Self Assessment payment-on-account due date.
 *
 * All calculation is done here on the server (pure functions); only the
 * expandable "Show calculation" section is client-interactive.
 */

import Link from "next/link";
import { FileText } from "lucide-react";
import {
  getFinancialSettings,
  getMonthlyIncomeSeries,
  type MonthlyIncomeSeries,
} from "@/actions/financial-settings";
import { getMonthlyExpenseSeries } from "@/actions/expenses";
import { TaxCalcDetails } from "@/components/tax-calc-details";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title:       "Tax reserve",
  description: "Track how much you should be setting aside for your tax bill.",
};

// ── UK tax constants (2024/25) ────────────────────────────────────────────────

const PERSONAL_ALLOWANCE  = 12_570;
const CLASS_4_LOWER_LIMIT =  12_570;
const CLASS_4_UPPER_LIMIT =  50_270;
const CLASS_4_RATE_LOWER  =      0.09; // 9 % on profits £12,570–£50,270
const CLASS_4_RATE_UPPER  =      0.02; // 2 % on profits above £50,270
const CLASS_2_NI_ANNUAL   =    179;    // £179 flat rate per year

// ── Pure calculation helpers ──────────────────────────────────────────────────

/** Income Tax: user's configured rate applied to income above the personal allowance. */
function calcIncomeTax(annual: number, ratePercent: number): number {
  return Math.max(0, annual - PERSONAL_ALLOWANCE) * (ratePercent / 100);
}

/** Class 4 NI for UK self-employed (banded rates). */
function calcClass4NI(annual: number): number {
  if (annual <= CLASS_4_LOWER_LIMIT) return 0;
  const lowerBand = (Math.min(annual, CLASS_4_UPPER_LIMIT) - CLASS_4_LOWER_LIMIT) * CLASS_4_RATE_LOWER;
  const upperBand = Math.max(0, annual - CLASS_4_UPPER_LIMIT) * CLASS_4_RATE_UPPER;
  return lowerBand + upperBand;
}

/** Class 2 NI: flat annual rate when profits exceed the Small Profits Threshold. */
function calcClass2NI(annual: number): number {
  return annual > PERSONAL_ALLOWANCE ? CLASS_2_NI_ANNUAL : 0;
}

/**
 * Return the number of complete calendar months elapsed since the start
 * of the current UK tax year (6 April), clamped to at least 1.
 */
function monthsElapsedInTaxYear(): number {
  const now  = new Date();
  const y    = now.getUTCFullYear();
  const m    = now.getUTCMonth() + 1; // 1-indexed
  const d    = now.getUTCDate();
  // Tax year starts on 6 April each year.
  const taxYearStartYear  = m > 4 || (m === 4 && d >= 6) ? y : y - 1;
  const taxYearStartMonth = 4; // April
  const elapsed = (y - taxYearStartYear) * 12 + m - taxYearStartMonth;
  return Math.max(1, elapsed);
}

/** Find the next UK Self Assessment payment-on-account due date. */
function nextSaPayment(): { isoDate: string; friendly: string; description: string } {
  const now  = new Date();
  const y    = now.getUTCFullYear();
  const make = (year: number, month: number, day: number) =>
    new Date(Date.UTC(year, month - 1, day));

  const jan31     = make(y,     1, 31);
  const jul31     = make(y,     7, 31);
  const jan31Next = make(y + 1, 1, 31);

  const pick = now <= jan31     ? { date: jan31,     friendly: "31 January",  desc: "1st payment on account" } :
               now <= jul31     ? { date: jul31,     friendly: "31 July",     desc: "2nd payment on account" } :
               /* else */         { date: jan31Next, friendly: "31 January",  desc: "1st payment on account" };

  return {
    isoDate:     pick.date.toISOString().slice(0, 10),
    friendly:    pick.friendly,
    description: pick.desc,
  };
}

/** Whole days until `isoDate` (YYYY-MM-DD). */
function daysUntilDate(isoDate: string): number {
  const target = new Date(`${isoDate}T00:00:00.000Z`);
  return Math.ceil((target.getTime() - Date.now()) / 86_400_000);
}

function fmtGBP(n: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency", currency: "GBP",
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(n);
}

// ── Sub-components ────────────────────────────────────────────────────────────

/** Amber banner: next SA payment on account date + days remaining. */
function NextPaymentBanner({
  friendly,
  description,
  daysLeft,
  estimated,
}: {
  friendly:    string;
  description: string;
  daysLeft:    number;
  estimated:   number;
}) {
  const urgent  = daysLeft <= 30;
  const warning = daysLeft <= 90;
  const bg      = urgent  ? "var(--zn-risk-soft)"  :
                  warning ? "var(--zn-warn-soft)"   : "var(--zn-info-soft)";
  const fg      = urgent  ? "var(--zn-risk)"        :
                  warning ? "var(--zn-warn)"         : "var(--zn-info)";
  const border  = urgent  ? "var(--zn-risk)"        :
                  warning ? "var(--zn-warn)"         : "var(--zn-info)";

  return (
    <div
      className="flex items-center justify-between gap-4 rounded-[12px] px-4 py-3.5"
      style={{ background: bg, border: `1px solid ${border}` }}
    >
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.09em]" style={{ color: fg }}>
          Next payment due
        </p>
        <p className="mt-0.5 text-[14px] font-semibold" style={{ color: fg }}>
          {friendly}{" "}
          <span
            className="text-[12px] font-medium"
            style={{ color: fg, opacity: 0.75 }}
          >
            — {description}
          </span>
        </p>
      </div>
      <div className="text-right flex-shrink-0">
        <p
          className="text-[22px] font-bold tabular-nums leading-none"
          style={{ color: fg }}
        >
          {daysLeft}
        </p>
        <p className="text-[10px] font-medium mt-0.5" style={{ color: fg, opacity: 0.75 }}>
          days away
        </p>
      </div>
    </div>
  );
}

/** Hero card: large "set aside so far" figure with a progress bar. */
function TaxHeroCard({
  setAside,
  totalLiability,
  progressPct,
  months,
}: {
  setAside:      number;
  totalLiability: number;
  progressPct:   number;
  months:        number;
}) {
  const empty = totalLiability <= 0;

  return (
    <div className="zn-card px-5 py-5">
      <span className="zn-label">Set aside so far</span>

      {/* Hero figure */}
      <p
        className="mt-3 text-[42px] font-bold leading-none tracking-tight"
        style={{
          color:              "var(--zn-warn)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {empty ? "—" : fmtGBP(setAside)}
      </p>

      {/* Context line */}
      <p className="mt-1.5 text-[12.5px]" style={{ color: "var(--zn-ink-3)" }}>
        {empty
          ? "No income recorded yet — add invoices to track your reserve."
          : `Month ${months} of 12 · estimated full-year liability ${fmtGBP(totalLiability)}`}
      </p>

      {/* Progress bar */}
      <div className="mt-4 space-y-1.5">
        <div
          className="h-[8px] w-full overflow-hidden rounded-full"
          style={{ background: "var(--zn-line)" }}
          role="progressbar"
          aria-valuenow={Math.round(progressPct)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${Math.round(progressPct)}% of estimated tax liability set aside`}
        >
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width:      `${Math.max(progressPct, progressPct > 0 ? 2 : 0)}%`,
              background: "var(--zn-warn)",
            }}
          />
        </div>
        <div className="flex justify-between">
          <span className="text-[11px]" style={{ color: "var(--zn-ink-3)" }}>£0</span>
          <span className="text-[11px]" style={{ color: "var(--zn-ink-3)" }}>
            {empty ? "—" : fmtGBP(totalLiability)} estimated
          </span>
        </div>
      </div>
    </div>
  );
}

/** A single row in the liability breakdown. */
function LiabilityRow({
  label,
  sub,
  amount,
  accentColor,
  visible  = true,
  negative = false,
}: {
  label:       string;
  sub:         string;
  amount:      number;
  accentColor: string;
  visible?:    boolean;
  negative?:   boolean;
}) {
  if (!visible) return null;
  return (
    <div
      className="flex items-center gap-4 py-3.5 pl-4"
      style={{ borderLeft: `3px solid ${accentColor}` }}
    >
      <div className="flex-1 min-w-0">
        <p className="text-[13.5px] font-semibold" style={{ color: "var(--zn-ink)" }}>
          {label}
        </p>
        <p className="text-[12px] mt-0.5" style={{ color: "var(--zn-ink-3)" }}>{sub}</p>
      </div>
      <p
        className="text-[15px] font-bold flex-shrink-0 tabular-nums"
        style={{ color: accentColor }}
      >
        {negative ? "−" : ""}{fmtGBP(amount)}
      </p>
    </div>
  );
}

/** Card showing the three tax/NI components. */
function LiabilityBreakdown({
  annualIncome,
  allowableExpenses,
  incomeTaxAmount,
  class4NI,
  class2NI,
  totalLiability,
  taxRatePercent,
  isGB,
}: {
  annualIncome:      number;
  allowableExpenses: number;
  incomeTaxAmount:   number;
  class4NI:          number;
  class2NI:          number;
  totalLiability:    number;
  taxRatePercent:    number;
  isGB:              boolean;
}) {
  const taxableProfit = Math.max(0, annualIncome - allowableExpenses);
  return (
    <div className="zn-card px-5 py-4">
      <span className="zn-label">Estimated annual liability</span>
      <p className="mt-1 text-[12.5px]" style={{ color: "var(--zn-ink-3)" }}>
        Based on {fmtGBP(annualIncome)} income
        {allowableExpenses > 0
          ? ` minus ${fmtGBP(allowableExpenses)} expenses = ${fmtGBP(taxableProfit)} taxable profit`
          : " in the last 12 months"}
      </p>

      <div
        className="mt-4 flex flex-col gap-3"
      >
        <LiabilityRow
          label="Allowable expenses"
          sub="Deducted from gross income to arrive at taxable profit"
          amount={allowableExpenses}
          accentColor="var(--zn-safe)"
          visible={allowableExpenses > 0}
          negative
        />
        <LiabilityRow
          label="Income Tax"
          sub={`${taxRatePercent}% on income above the £${PERSONAL_ALLOWANCE.toLocaleString("en-GB")} personal allowance`}
          amount={incomeTaxAmount}
          accentColor="var(--zn-warn)"
        />
        <LiabilityRow
          label="Class 4 National Insurance"
          sub="9% on profits £12,570–£50,270, then 2% above that"
          amount={class4NI}
          accentColor="var(--zn-risk)"
          visible={isGB && class4NI > 0}
        />
        <LiabilityRow
          label="Class 2 National Insurance"
          sub={`Flat £${CLASS_2_NI_ANNUAL}/year when profits exceed £${PERSONAL_ALLOWANCE.toLocaleString("en-GB")}`}
          amount={class2NI}
          accentColor="var(--zn-info)"
          visible={isGB && class2NI > 0}
        />
      </div>

      {/* Total row */}
      <div
        className="mt-4 flex items-center justify-between pt-4"
        style={{ borderTop: "1px solid var(--zn-line-soft)" }}
      >
        <span className="text-[13px] font-semibold" style={{ color: "var(--zn-ink)" }}>
          Total estimated
        </span>
        <span
          className="text-[18px] font-bold tabular-nums"
          style={{ color: "var(--zn-ink)" }}
        >
          {fmtGBP(totalLiability)}
        </span>
      </div>
    </div>
  );
}

/** Monthly tracker: bar chart for last 5 months. */
function MonthlyTracker({
  months,
  monthlyTarget,
  taxRatePercent,
}: {
  months:        MonthlyIncomeSeries[];
  monthlyTarget: number;
  taxRatePercent: number;
}) {
  const maxVal = Math.max(monthlyTarget, ...months.map((m) => m.income * taxRatePercent / 100), 1);

  return (
    <div className="zn-card px-5 py-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="zn-label">Monthly tracker</span>
          <p className="mt-1 text-[12.5px]" style={{ color: "var(--zn-ink-3)" }}>
            What you should have set aside each month
          </p>
        </div>
        {monthlyTarget > 0 && (
          <span
            className="text-[11px] font-medium flex-shrink-0 px-2 py-1 rounded-full"
            style={{
              background: "var(--zn-warn-soft)",
              color:      "var(--zn-warn)",
            }}
          >
            {fmtGBP(monthlyTarget)}/mo target
          </span>
        )}
      </div>

      <div className="mt-5 space-y-4">
        {months.map((m) => {
          const setAside  = m.income * taxRatePercent / 100;
          const metTarget = monthlyTarget > 0 && setAside >= monthlyTarget;
          const barWidth  = monthlyTarget > 0
            ? Math.min(100, (setAside / monthlyTarget) * 100)
            : (maxVal > 0 ? (setAside / maxVal) * 100 : 0);
          const barColor  = metTarget
            ? "var(--zn-safe)"
            : "var(--zn-risk)";
          const isEmpty   = m.income <= 0;

          return (
            <div key={m.yearMonth}>
              <div className="flex items-center justify-between mb-1.5">
                <span
                  className="text-[12px] font-medium"
                  style={{ color: "var(--zn-ink-2)" }}
                >
                  {m.label}
                </span>
                <div className="flex items-center gap-2">
                  {!isEmpty && monthlyTarget > 0 && (
                    <span
                      className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full leading-none"
                      style={{
                        background: metTarget ? "var(--zn-safe-soft)" : "var(--zn-risk-soft)",
                        color:      metTarget ? "var(--zn-safe)"      : "var(--zn-risk)",
                      }}
                    >
                      {metTarget ? "On track" : "Short"}
                    </span>
                  )}
                  <span
                    className="text-[12px] tabular-nums font-medium"
                    style={{ color: isEmpty ? "var(--zn-ink-3)" : "var(--zn-ink)" }}
                  >
                    {isEmpty ? "—" : fmtGBP(setAside)}
                  </span>
                </div>
              </div>

              {/* Bar track */}
              <div
                className="h-[6px] w-full overflow-hidden rounded-full"
                style={{ background: "var(--zn-line)" }}
              >
                {!isEmpty && (
                  <div
                    className="h-full rounded-full"
                    style={{
                      width:      `${Math.max(barWidth, barWidth > 0 ? 2 : 0)}%`,
                      background: barColor,
                    }}
                  />
                )}
              </div>

              {/* Target tick label — show only on first month to avoid repetition */}
              {m === months[0] && monthlyTarget > 0 && (
                <div
                  className="mt-1 text-[10.5px]"
                  style={{
                    color:       "var(--zn-ink-3)",
                    paddingLeft: `${Math.min(99, (monthlyTarget / maxVal) * 100)}%`,
                  }}
                >
                  target
                </div>
              )}
            </div>
          );
        })}
      </div>

      {months.every((m) => m.income <= 0) && (
        <p
          className="mt-4 text-[12.5px] text-center"
          style={{ color: "var(--zn-ink-3)" }}
        >
          No income recorded for these months yet.
        </p>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function TaxPage() {
  // Fetch settings, income, and expenses in parallel.
  const [settings, monthSeries, expSeries] = await Promise.all([
    getFinancialSettings(),
    getMonthlyIncomeSeries(12),
    getMonthlyExpenseSeries(12),
  ]);

  const taxRatePercent = settings?.taxRatePercent ?? 20;
  const countryCode    = settings?.countryCode    ?? "GB";
  const isGB           = countryCode === "GB";

  // ── Annual income estimate (sum of last 12 months) ─────────────────────────
  const annualIncome   = monthSeries.reduce((s, m) => s + m.income,   0);
  const annualExpenses = expSeries.reduce((s, e) => s + e.expenses, 0);

  // Taxable profit = income minus allowable expenses (floor at 0)
  const taxableProfit = Math.max(0, annualIncome - annualExpenses);

  // ── Tax liability components (on taxable profit, not gross income) ─────────
  const incomeTaxAmount = calcIncomeTax(taxableProfit, taxRatePercent);
  const class4NI        = isGB ? calcClass4NI(taxableProfit) : 0;
  const class2NI        = isGB ? calcClass2NI(taxableProfit) : 0;
  const totalLiability  = incomeTaxAmount + class4NI + class2NI;

  // ── Hero: pro-rated set-aside target for the current point in the tax year ─
  const months      = monthsElapsedInTaxYear();
  const setAside    = (months / 12) * totalLiability;
  const progressPct = totalLiability > 0
    ? Math.min(100, (setAside / totalLiability) * 100)
    : 0;

  // ── Monthly tracker: last 5 months ────────────────────────────────────────
  const last5Months  = monthSeries.slice(-5);
  const monthlyTarget = totalLiability / 12;

  // ── Next SA payment ───────────────────────────────────────────────────────
  const saPayment = nextSaPayment();
  const daysLeft  = daysUntilDate(saPayment.isoDate);

  // ── Data for the expandable calculation section ───────────────────────────
  const calcProps = {
    grossIncome:       annualIncome,
    allowableExpenses: annualExpenses,
    personalAllowance: PERSONAL_ALLOWANCE,
    taxableIncome:     Math.max(0, taxableProfit - PERSONAL_ALLOWANCE),
    incomeTaxAmount,
    taxRatePercent,
    class4NI,
    class2NI,
    totalLiability,
    isGB,
  };

  return (
    <div className="space-y-5">
        {/* ── Page heading ───────────────────────────────────────────────── */}
        <div>
          <h1
            className="text-[24px] font-semibold tracking-[-0.02em]"
            style={{ color: "var(--zn-ink)" }}
          >
            Tax reserve
          </h1>
          <p className="mt-0.5 text-[13.5px]" style={{ color: "var(--zn-ink-3)" }}>
            How much you should be setting aside, based on the last 12 months of income
          </p>
        </div>

        {/* ── 1. Next SA payment banner ─────────────────────────────────── */}
        <NextPaymentBanner
          friendly={saPayment.friendly}
          description={saPayment.description}
          daysLeft={daysLeft}
          estimated={totalLiability / 2}
        />

        {/* ── 2. Hero: set aside so far ──────────────────────────────────── */}
        <TaxHeroCard
          setAside={setAside}
          totalLiability={totalLiability}
          progressPct={progressPct}
          months={months}
        />

        {/* ── 3. Liability breakdown ─────────────────────────────────────── */}
        <LiabilityBreakdown
          annualIncome={annualIncome}
          allowableExpenses={annualExpenses}
          incomeTaxAmount={incomeTaxAmount}
          class4NI={class4NI}
          class2NI={class2NI}
          totalLiability={totalLiability}
          taxRatePercent={taxRatePercent}
          isGB={isGB}
        />

        {/* ── 4. Monthly tracker (last 5 months) ────────────────────────── */}
        <MonthlyTracker
          months={last5Months}
          monthlyTarget={monthlyTarget}
          taxRatePercent={taxRatePercent}
        />

        {/* ── 5. Expandable calculation (client component) ──────────────── */}
        <TaxCalcDetails {...calcProps} />

        {/* Year-end summary link */}
        <div className="flex justify-center">
          <Link
            href="/tax/summary"
            className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[12.5px] font-medium transition-colors hover:bg-[#f3ecd8] dark:hover:bg-[#2d2820]"
            style={{ borderColor: "var(--zn-line)", color: "var(--zn-ink-2)" }}
          >
            <FileText className="size-3.5" />
            View year-end summary
          </Link>
        </div>

        {/* Fine print */}
        <p className="text-[11.5px] text-center pb-2" style={{ color: "var(--zn-ink-3)" }}>
          Figures are estimates only and do not constitute tax advice.
          Tax rates shown are for the UK 2024/25 tax year.{" "}
          <a
            href="/settings"
            className="underline hover:no-underline"
            style={{ color: "var(--zn-ink-2)" }}
          >
            Update your tax rate in Settings.
          </a>
        </p>
      </div>
  );
}
