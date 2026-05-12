"use client";

/**
 * src/components/tax-year-summary-print.tsx
 *
 * Printable / shareable Self Assessment year-end summary card.
 * Receives all pre-computed values from the server component.
 * The "Print" button on the parent calls window.print().
 *
 * Uses @media print styles (via Tailwind's print: variant) so the
 * card fills the page cleanly when printed or saved as PDF.
 */

import { Info, Printer } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TaxYearSummaryProps {
  taxYear:          string;   // e.g. "2025/26"
  grossIncome:      number;
  totalExpenses:    number;
  taxableProfit:    number;
  personalAllow:    number;
  taxableIncome:    number;
  taxRatePercent:   number;
  incomeTax:        number;
  class4NI:         number;
  class2NI:         number;
  totalLiability:   number;
  monthlySetAside:  number;
  nextPayment:      string;   // e.g. "31 January 2026"
  isGB:             boolean;
}

// ── Formatter ─────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat("en-GB", {
    style:                 "currency",
    currency:              "GBP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SummaryRow({
  label,
  value,
  sub,
  bold   = false,
  neg    = false,
  color,
  topLine = false,
}: {
  label:    string;
  value:    number;
  sub?:     string;
  bold?:    boolean;
  neg?:     boolean;
  color?:   string;
  topLine?: boolean;
}) {
  const fg = color ?? (bold ? "var(--zn-ink)" : "var(--zn-ink-2)");
  return (
    <div
      className={`flex items-start justify-between gap-4 py-3 ${topLine ? "border-t" : ""}`}
      style={topLine ? { borderColor: "var(--zn-line-soft)" } : undefined}
    >
      <div className="min-w-0">
        <p
          className={`text-[13.5px] ${bold ? "font-semibold" : "font-medium"}`}
          style={{ color: fg }}
        >
          {label}
        </p>
        {sub && (
          <p className="text-[11.5px] mt-0.5" style={{ color: "var(--zn-ink-3)" }}>
            {sub}
          </p>
        )}
      </div>
      <p
        className={`text-[14px] flex-shrink-0 tabular-nums ${bold ? "font-bold" : "font-medium"}`}
        style={{ color: fg }}
      >
        {neg ? `− ${fmt(value)}` : fmt(value)}
      </p>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function TaxYearSummaryPrint({
  taxYear,
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
  nextPayment,
  isGB,
}: TaxYearSummaryProps) {
  const today = new Date().toLocaleDateString("en-GB", {
    day: "numeric", month: "long", year: "numeric",
  });

  return (
    <div
      className="zn-card overflow-hidden print:shadow-none print:border-none"
      style={{ pageBreakInside: "avoid" }}
    >
      {/* Header */}
      <div
        className="px-6 py-5"
        style={{ background: "var(--zn-bg-2)", borderBottom: "1px solid var(--zn-line-soft)" }}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p
              className="text-[10px] font-semibold uppercase tracking-[0.1em]"
              style={{ color: "var(--zn-ink-3)" }}
            >
              Self Assessment estimate
            </p>
            <h1
              className="mt-1 text-[22px] font-bold tracking-tight"
              style={{ color: "var(--zn-ink)" }}
            >
              Tax year {taxYear}
            </h1>
          </div>
          <div className="text-right flex flex-col items-end gap-2">
            <p className="text-[11px]" style={{ color: "var(--zn-ink-3)" }}>
              Generated {today}
            </p>
            <button
              type="button"
              onClick={() => window.print()}
              className="print:hidden flex items-center gap-1.5 text-[11.5px] font-medium px-3 py-1.5 rounded-full border transition-colors hover:bg-[#ece3cc] dark:hover:bg-[#28231c]"
              style={{ borderColor: "var(--zn-line)", color: "var(--zn-ink-2)" }}
            >
              <Printer className="size-3" />
              Print / PDF
            </button>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="px-6 pb-6">

        {/* Section 1 — Income & expenses */}
        <div className="mt-2">
          <p
            className="text-[10px] font-semibold uppercase tracking-[0.08em] pt-4 pb-1"
            style={{ color: "var(--zn-ink-3)" }}
          >
            Income &amp; expenses
          </p>
          <div className="divide-y" style={{ borderColor: "var(--zn-line-soft)" }}>
            <SummaryRow
              label="Gross income"
              sub="Total invoiced income in the last 12 months"
              value={grossIncome}
            />
            {totalExpenses > 0 && (
              <SummaryRow
                label="Allowable expenses"
                sub="Recorded business expenses"
                value={totalExpenses}
                neg
                color="var(--zn-safe)"
              />
            )}
            <SummaryRow
              label="Taxable profit"
              sub={totalExpenses > 0 ? "Gross income minus allowable expenses" : "No expenses recorded"}
              value={taxableProfit}
              bold
              topLine
            />
          </div>
        </div>

        {/* Section 2 — Tax calculation */}
        <div className="mt-2">
          <p
            className="text-[10px] font-semibold uppercase tracking-[0.08em] pt-4 pb-1"
            style={{ color: "var(--zn-ink-3)" }}
          >
            Tax calculation
          </p>
          <div className="divide-y" style={{ borderColor: "var(--zn-line-soft)" }}>
            <SummaryRow
              label="Personal allowance"
              sub={`£${personalAllow.toLocaleString("en-GB")} tax-free income threshold`}
              value={personalAllow}
              neg
              color="var(--zn-ink-3)"
            />
            <SummaryRow
              label="Taxable income"
              sub="Profit above the personal allowance"
              value={taxableIncome}
              bold
              topLine
            />
            <SummaryRow
              label={`Income Tax at ${taxRatePercent}%`}
              sub={`${taxRatePercent}% on taxable income above the personal allowance`}
              value={incomeTax}
              color="var(--zn-warn)"
            />
            {isGB && class4NI > 0 && (
              <SummaryRow
                label="Class 4 National Insurance"
                sub="9% on profits £12,570–£50,270, 2% above that"
                value={class4NI}
                color="var(--zn-risk)"
              />
            )}
            {isGB && class2NI > 0 && (
              <SummaryRow
                label="Class 2 National Insurance"
                sub="Flat £179/year"
                value={class2NI}
                color="var(--zn-info)"
              />
            )}
          </div>
        </div>

        {/* Total */}
        <div
          className="mt-4 rounded-[12px] px-4 py-4 flex items-center justify-between gap-4"
          style={{ background: "var(--zn-warn-soft)", border: "1px solid var(--zn-warn)" }}
        >
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--zn-warn)" }}>
              Estimated total liability
            </p>
            <p className="text-[12px] mt-0.5" style={{ color: "var(--zn-warn)", opacity: 0.8 }}>
              Income Tax{isGB ? " + NI contributions" : ""}
            </p>
          </div>
          <p
            className="text-[30px] font-bold tabular-nums leading-none"
            style={{ color: "var(--zn-warn)" }}
          >
            {totalLiability > 0 ? fmt(totalLiability) : "£0"}
          </p>
        </div>

        {/* Section 3 — Planning */}
        <div className="mt-4">
          <p
            className="text-[10px] font-semibold uppercase tracking-[0.08em] pb-1"
            style={{ color: "var(--zn-ink-3)" }}
          >
            Planning
          </p>
          <div className="divide-y" style={{ borderColor: "var(--zn-line-soft)" }}>
            <SummaryRow
              label="Monthly set-aside target"
              sub="To reach your full-year liability by year-end"
              value={monthlySetAside}
              color="var(--zn-ink-2)"
            />
            <div className="flex items-start justify-between gap-4 py-3">
              <div>
                <p className="text-[13.5px] font-medium" style={{ color: "var(--zn-ink-2)" }}>
                  Next payment on account
                </p>
                <p className="text-[11.5px] mt-0.5" style={{ color: "var(--zn-ink-3)" }}>
                  Self Assessment payment due date
                </p>
              </div>
              <p className="text-[13.5px] font-semibold flex-shrink-0" style={{ color: "var(--zn-ink)" }}>
                {nextPayment}
              </p>
            </div>
          </div>
        </div>

        {/* Disclaimer */}
        <div
          className="mt-5 flex items-start gap-2.5 rounded-[10px] px-3.5 py-3"
          style={{
            background: "var(--zn-surface-2)",
            border:     "1px solid var(--zn-line-soft)",
          }}
        >
          <Info className="size-3.5 flex-shrink-0 mt-0.5" style={{ color: "var(--zn-ink-3)" }} />
          <p className="text-[11.5px] leading-[1.6]" style={{ color: "var(--zn-ink-3)" }}>
            This is an <strong>estimate only</strong> based on the income and expenses recorded in Zentra.
            It does not account for all allowances, reliefs, or tax already paid.
            Check all figures with a qualified accountant before submitting your Self Assessment return.
          </p>
        </div>
      </div>
    </div>
  );
}
