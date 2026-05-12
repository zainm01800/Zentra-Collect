"use client";

/**
 * tax-calc-details.tsx
 *
 * Expandable "Show calculation" section for the tax reserve page.
 * Receives pre-computed values from the server component — no data
 * fetching here — and renders a step-by-step breakdown of the estimate.
 *
 * Deliberately avoids accounting jargon; every term is explained in plain
 * English and a disclaimer reminds users to verify with an accountant.
 */

import { useState } from "react";
import { ChevronDown, ChevronRight, Info } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface TaxCalcDetailsProps {
  grossIncome:       number;
  allowableExpenses?: number;
  personalAllowance: number;
  taxableIncome:     number;
  incomeTaxAmount:   number;
  taxRatePercent:    number;
  class4NI:          number;
  class2NI:          number;
  totalLiability:    number;
  isGB:              boolean;
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

function Row({
  label,
  value,
  sub,
  indent = false,
  deduction = false,
  total = false,
  color,
}: {
  label:      string;
  value:      number;
  sub?:       string;
  indent?:    boolean;
  deduction?: boolean;
  total?:     boolean;
  color?:     "warn" | "risk" | "info";
}) {
  const fg =
    color === "warn" ? "var(--zn-warn)" :
    color === "risk" ? "var(--zn-risk)" :
    color === "info" ? "var(--zn-info)" :
    total            ? "var(--zn-ink)"  :
    "var(--zn-ink-2)";

  return (
    <div
      className={`flex items-start justify-between gap-4 py-2 ${
        total ? "border-t" : ""
      } ${indent ? "pl-4" : ""}`}
      style={total ? { borderColor: "var(--zn-line-soft)" } : undefined}
    >
      <div className="min-w-0">
        <p
          className={`text-[13px] ${total ? "font-semibold" : "font-medium"}`}
          style={{ color: fg }}
        >
          {label}
        </p>
        {sub && (
          <p className="text-[11px] mt-0.5" style={{ color: "var(--zn-ink-3)" }}>
            {sub}
          </p>
        )}
      </div>
      <p
        className={`text-[13px] flex-shrink-0 tabular-nums ${
          total ? "font-semibold" : "font-medium"
        }`}
        style={{ color: fg }}
      >
        {deduction ? `− ${fmt(value)}` : fmt(value)}
      </p>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function TaxCalcDetails({
  grossIncome,
  allowableExpenses = 0,
  personalAllowance,
  taxableIncome,
  incomeTaxAmount,
  taxRatePercent,
  class4NI,
  class2NI,
  totalLiability,
  isGB,
}: TaxCalcDetailsProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="zn-card overflow-hidden">
      {/* Toggle button */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-4 transition-colors hover:bg-[#f3ecd8] dark:hover:bg-[#2d2820]"
      >
        <span
          className="text-[13.5px] font-semibold"
          style={{ color: "var(--zn-ink)" }}
        >
          Show calculation
        </span>
        <span className="flex items-center gap-1.5 text-[12px]" style={{ color: "var(--zn-ink-3)" }}>
          <span>{expanded ? "Collapse" : "How we got here"}</span>
          {expanded
            ? <ChevronDown className="size-3.5" />
            : <ChevronRight className="size-3.5" />
          }
        </span>
      </button>

      {/* Expandable body */}
      {expanded && (
        <div
          className="px-5 pb-5 pt-0"
          style={{ borderTop: "1px solid var(--zn-line-soft)" }}
        >
          {/* Step-by-step */}
          <div className="mt-3 space-y-0 divide-y" style={{ borderColor: "transparent" }}>
            <Row
              label="Gross income"
              sub="Income received in the last 12 months (invoices + other)"
              value={grossIncome}
            />
            <Row
              label="Personal allowance"
              sub="Tax-free income each year — you keep this free of income tax"
              value={personalAllowance}
              deduction
              indent
            />
            {allowableExpenses > 0 ? (
              <Row
                label="Allowable expenses"
                sub="Recorded business expenses deducted from gross income"
                value={allowableExpenses}
                deduction
                indent
              />
            ) : (
              <Row
                label="Expenses (none recorded)"
                sub="Add expenses on the Expenses page to reduce your estimate"
                value={0}
                deduction
                indent
              />
            )}
            <Row
              label="Taxable income"
              value={taxableIncome}
              total
            />

            {/* Tax components */}
            <div className="pt-3 space-y-0">
              <Row
                label={`Income tax at ${taxRatePercent}%`}
                sub="Applied to taxable income above the personal allowance"
                value={incomeTaxAmount}
                color="warn"
              />
              {isGB && class4NI > 0 && (
                <Row
                  label="Class 4 National Insurance"
                  sub="9% on profits £12,570–£50,270, then 2% above that"
                  value={class4NI}
                  color="risk"
                />
              )}
              {isGB && class2NI > 0 && (
                <Row
                  label="Class 2 National Insurance"
                  sub="Flat £179/year if profits exceed the Small Profits Threshold"
                  value={class2NI}
                  color="info"
                />
              )}
            </div>

            <Row
              label="Total estimated annual liability"
              value={totalLiability}
              total
            />
          </div>

          {/* Disclaimer */}
          <div
            className="mt-4 flex items-start gap-2 rounded-[8px] px-3 py-2.5"
            style={{
              background:  "var(--zn-surface-2)",
              border:      "1px solid var(--zn-line-soft)",
            }}
          >
            <Info className="size-3.5 flex-shrink-0 mt-0.5" style={{ color: "var(--zn-ink-3)" }} />
            <p className="text-[11.5px] leading-[1.6]" style={{ color: "var(--zn-ink-3)" }}>
              This is a rough estimate. It doesn&apos;t account for all allowances
              you may be entitled to, or any tax already paid.
              Check with your accountant before making any payment.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
