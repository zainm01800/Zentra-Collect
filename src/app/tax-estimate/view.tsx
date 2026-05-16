"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, FileText, ChevronLeft, ChevronRight } from "lucide-react";
import {
  currentUkTaxYear,
  estimateUkSelfEmployedTax,
  type TaxEstimateBreakdown,
} from "@/lib/tax/uk-self-employed";
import { totalsForTaxYear, type TaxYearTotals } from "@/lib/tax/summary";

function fmtGBP(n: number, opts: { fractionDigits?: number } = {}): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency", currency: "GBP",
    minimumFractionDigits: opts.fractionDigits ?? 2,
    maximumFractionDigits: opts.fractionDigits ?? 2,
  }).format(n);
}

function priorTaxYear(taxYear: string): string {
  const start = parseInt(taxYear.slice(0, 4), 10) - 1;
  return `${start}/${String(start + 1).slice(2)}`;
}

function nextTaxYear(taxYear: string): string {
  const start = parseInt(taxYear.slice(0, 4), 10) + 1;
  return `${start}/${String(start + 1).slice(2)}`;
}

export function TaxEstimateView() {
  const [taxYear, setTaxYear] = useState(() => currentUkTaxYear());
  const [useTradingAllowance, setUseTradingAllowance] = useState(false);
  const [otherIncome, setOtherIncome] = useState("0");
  const [totals, setTotals] = useState<TaxYearTotals | null>(null);

  useEffect(() => {
    setTotals(totalsForTaxYear(taxYear));
  }, [taxYear]);

  const estimate: TaxEstimateBreakdown | null = useMemo(() => {
    if (!totals) return null;
    return estimateUkSelfEmployedTax(
      {
        income:              totals.income,
        expenses:            totals.expenses,
        useTradingAllowance,
        otherTaxableIncome:  parseFloat(otherIncome) || 0,
      },
      taxYear,
    );
  }, [totals, useTradingAllowance, otherIncome, taxYear]);

  const isCurrent = taxYear === currentUkTaxYear();

  if (!totals || !estimate) {
    return <p className="text-[13px]" style={{ color: "var(--zn-ink-3)" }}>Loading…</p>;
  }

  return (
    <div className="space-y-5">
      {/* Tax year picker */}
      <div className="flex items-center justify-between gap-2 rounded-xl p-3"
           style={{ background: "var(--zn-surface)", border: "1px solid var(--zn-line-soft)" }}>
        <button
          type="button"
          onClick={() => setTaxYear(priorTaxYear(taxYear))}
          aria-label="Previous tax year"
          className="p-1.5 rounded hover:bg-black/5"
          style={{ color: "var(--zn-ink-2)" }}
        >
          <ChevronLeft className="size-4" />
        </button>
        <div className="text-center">
          <p className="text-[10.5px] uppercase tracking-wider"
             style={{ color: "var(--zn-ink-3)" }}>
            Tax year{isCurrent && " · current"}
          </p>
          <p className="text-[15px] font-semibold" style={{ color: "var(--zn-ink)" }}>
            6 April {taxYear.slice(0, 4)} – 5 April 20{taxYear.slice(-2)}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setTaxYear(nextTaxYear(taxYear))}
          disabled={taxYear === currentUkTaxYear()}
          aria-label="Next tax year"
          className="p-1.5 rounded hover:bg-black/5 disabled:opacity-30"
          style={{ color: "var(--zn-ink-2)" }}
        >
          <ChevronRight className="size-4" />
        </button>
      </div>

      {/* Hero — estimated tax owed */}
      <div className="rounded-2xl p-6"
           style={{ background: "var(--zn-surface)", border: "1px solid var(--zn-line-soft)" }}>
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em]"
           style={{ color: "var(--zn-ink-3)" }}>
          Estimated tax owed for {taxYear}
        </p>
        <p className="mt-2 text-[44px] sm:text-[56px] font-semibold leading-none tabular-nums"
           style={{ color: "var(--zn-ink)" }}>
          {fmtGBP(estimate.estimatedTaxOwed)}
        </p>
        <p className="mt-3 text-[13px] leading-6" style={{ color: "var(--zn-ink-3)" }}>
          Income Tax {fmtGBP(estimate.incomeTax.total)} + Class 4 NIC {fmtGBP(estimate.nic.total)}
          {" "}on a net profit of <strong>{fmtGBP(estimate.netProfit)}</strong>.
        </p>
        {estimate.warnings.length > 0 && (
          <div className="mt-4 space-y-2">
            {estimate.warnings.map((w, idx) => (
              <p key={idx} className="flex items-start gap-2 text-[12px] leading-5 rounded-lg px-3 py-2"
                 style={{ background: "var(--zn-warn-soft)", color: "var(--zn-warn)" }}>
                <AlertTriangle className="size-3.5 mt-0.5 shrink-0" />
                <span>{w}</span>
              </p>
            ))}
          </div>
        )}
      </div>

      {/* Input panel */}
      <div className="rounded-2xl p-5 grid gap-3 sm:grid-cols-2"
           style={{ background: "var(--zn-surface)", border: "1px solid var(--zn-line-soft)" }}>
        <Stat label="Income (invoiced)" value={fmtGBP(totals.income)}
              hint={`${totals.invoiceCount} invoice${totals.invoiceCount === 1 ? "" : "s"} in this tax year`} />
        <Stat label="Expenses tracked"  value={fmtGBP(totals.expenses)}
              hint={`${totals.expenseCount} expense${totals.expenseCount === 1 ? "" : "s"} in this tax year`} />
        <label className="flex items-center gap-2 text-[13px] py-2 sm:col-span-1"
               style={{ color: "var(--zn-ink-2)" }}>
          <input
            type="checkbox"
            checked={useTradingAllowance}
            onChange={(e) => setUseTradingAllowance(e.target.checked)}
          />
          Use £1,000 trading allowance instead of expenses
        </label>
        <label className="flex items-center gap-2 text-[13px] py-2 sm:col-span-1"
               style={{ color: "var(--zn-ink-2)" }}>
          Other taxable income:
          <input
            type="number"
            step="0.01"
            min="0"
            value={otherIncome}
            onChange={(e) => setOtherIncome(e.target.value)}
            className="rounded-md px-2 py-1 text-[13px] border bg-white w-24 tabular-nums"
            style={{ borderColor: "var(--zn-line)" }}
          />
        </label>
      </div>

      {/* Breakdown */}
      <div className="rounded-2xl p-5"
           style={{ background: "var(--zn-surface)", border: "1px solid var(--zn-line-soft)" }}>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] mb-3"
           style={{ color: "var(--zn-ink-3)" }}>
          Breakdown
        </p>
        <table className="w-full text-[13px]">
          <tbody>
            <Row label="Net profit"                              value={fmtGBP(estimate.netProfit)} />
            <Row label="Personal allowance applied"              value={fmtGBP(estimate.personalAllowanceApplied)} muted />
            <Row label="Income Tax · basic (20%)"                value={fmtGBP(estimate.incomeTax.basic.tax)}
                 sub={`on ${fmtGBP(estimate.incomeTax.basic.taxable)}`} />
            {estimate.incomeTax.higher.tax > 0 && (
              <Row label="Income Tax · higher (40%)"             value={fmtGBP(estimate.incomeTax.higher.tax)}
                   sub={`on ${fmtGBP(estimate.incomeTax.higher.taxable)}`} />
            )}
            {estimate.incomeTax.additional.tax > 0 && (
              <Row label="Income Tax · additional (45%)"         value={fmtGBP(estimate.incomeTax.additional.tax)}
                   sub={`on ${fmtGBP(estimate.incomeTax.additional.taxable)}`} />
            )}
            <Row label="Class 4 NIC · main (6%)"                  value={fmtGBP(estimate.nic.main.nic)}
                 sub={`on ${fmtGBP(estimate.nic.main.profits)}`} />
            {estimate.nic.upper.nic > 0 && (
              <Row label="Class 4 NIC · upper (2%)"               value={fmtGBP(estimate.nic.upper.nic)}
                   sub={`on ${fmtGBP(estimate.nic.upper.profits)}`} />
            )}
            <Row label="Estimated tax owed"
                 value={fmtGBP(estimate.estimatedTaxOwed)}
                 bold
                 borderTop />
          </tbody>
        </table>
      </div>

      {/* Disclaimer + next steps */}
      <div className="rounded-2xl p-5 text-[12.5px] leading-6"
           style={{ background: "var(--zn-warn-soft)", color: "var(--zn-warn)" }}>
        <p className="font-semibold flex items-center gap-1.5">
          <AlertTriangle className="size-3.5" />
          Estimate only — Zentra is not a regulated accounting service
        </p>
        <p className="mt-1">
          File your Self Assessment through{" "}
          <a href="https://www.gov.uk/log-in-file-self-assessment-tax-return"
             target="_blank" rel="noopener noreferrer" className="underline">
            HMRC&rsquo;s online portal
          </a>
          {" "}or hand these numbers to your accountant. Class 2 NIC, the £100k personal-allowance taper,
          Scottish rates, dividends, capital gains, and pension contributions are not modelled here.
        </p>
      </div>

      <div className="flex gap-3 flex-wrap">
        <Link
          href="/expenses"
          className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-medium border"
          style={{ borderColor: "var(--zn-line)", color: "var(--zn-ink-2)" }}
        >
          <FileText className="size-3.5" />
          Add an expense
        </Link>
        <Link
          href="/invoices/new"
          className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-medium border"
          style={{ borderColor: "var(--zn-line)", color: "var(--zn-ink-2)" }}
        >
          New invoice
        </Link>
      </div>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div>
      <p className="text-[10.5px] font-semibold uppercase tracking-wider"
         style={{ color: "var(--zn-ink-3)" }}>
        {label}
      </p>
      <p className="mt-1 text-[20px] font-semibold tabular-nums"
         style={{ color: "var(--zn-ink)" }}>
        {value}
      </p>
      <p className="mt-0.5 text-[11.5px]" style={{ color: "var(--zn-ink-3)" }}>
        {hint}
      </p>
    </div>
  );
}

function Row({
  label, value, sub, bold, muted, borderTop,
}: {
  label: string;
  value: string;
  sub?: string;
  bold?: boolean;
  muted?: boolean;
  borderTop?: boolean;
}) {
  return (
    <tr style={{ borderTop: borderTop ? "1px solid var(--zn-line-soft)" : undefined }}>
      <td className="py-2"
          style={{
            color: muted ? "var(--zn-ink-3)" : "var(--zn-ink-2)",
            fontWeight: bold ? 600 : undefined,
          }}>
        {label}
        {sub && (
          <span className="ml-2 text-[11px]" style={{ color: "var(--zn-ink-3)" }}>{sub}</span>
        )}
      </td>
      <td className="py-2 text-right tabular-nums"
          style={{
            color: muted ? "var(--zn-ink-3)" : "var(--zn-ink)",
            fontWeight: bold ? 600 : undefined,
            fontSize: bold ? 16 : undefined,
          }}>
        {value}
      </td>
    </tr>
  );
}
