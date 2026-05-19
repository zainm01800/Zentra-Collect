"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Copy, Mail, Printer } from "lucide-react";
import {
  currentUkTaxYear,
  estimateUkSelfEmployedTax,
  ukTaxYearRange,
} from "@/lib/tax/uk-self-employed";
import { totalsForTaxYear, type TaxYearTotals } from "@/lib/tax/summary";

function fmtGBP(n: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency", currency: "GBP",
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(n);
}

function fmtPlainGBP(n: number): string {
  return new Intl.NumberFormat("en-GB", {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(n);
}

function fmtTaxYearWindow(taxYear: string): string {
  const { startIso, endIso } = ukTaxYearRange(taxYear);
  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  return `${fmt(startIso)} – ${fmt(endIso)}`;
}

export function YearEndClient({ initialTaxYear }: { initialTaxYear?: string }) {
  const [taxYear] = useState(initialTaxYear ?? currentUkTaxYear());
  const [totals, setTotals]   = useState<TaxYearTotals | null>(null);
  const [businessName, setBusinessName] = useState("");

  useEffect(() => {
    setTotals(totalsForTaxYear(taxYear));
    if (typeof window !== "undefined") {
      setBusinessName(window.localStorage.getItem("zentra.businessName") ?? "Your business");
    }
  }, [taxYear]);

  const estimate = useMemo(() => {
    if (!totals) return null;
    return estimateUkSelfEmployedTax(
      { income: totals.income, expenses: totals.expenses },
      taxYear,
    );
  }, [totals, taxYear]);

  function emailToAccountant() {
    if (!totals || !estimate) return;
    const window_ = fmtTaxYearWindow(taxYear);
    const lines = [
      `Year-end summary · ${businessName}`,
      `Tax year ${taxYear} (${window_})`,
      ``,
      `Income:                  ${fmtGBP(totals.income)}`,
      `Expenses tracked:        ${fmtGBP(totals.expenses)}`,
      `Net profit:              ${fmtGBP(estimate.netProfit)}`,
      `VAT charged (output):    ${fmtGBP(totals.vatCharged)}`,
      ``,
      `Income Tax (estimate):   ${fmtGBP(estimate.incomeTax.total)}`,
      `Class 4 NIC (estimate):  ${fmtGBP(estimate.nic.total)}`,
      `Estimated tax owed:      ${fmtGBP(estimate.estimatedTaxOwed)}`,
      ``,
      `Invoices counted:        ${totals.invoiceCount}`,
      `Expenses counted:        ${totals.expenseCount}`,
      ``,
      `Generated from Zentra Collect — estimate only. File via HMRC.`,
    ].join("\n");
    const subject = `Year-end summary ${taxYear} — ${businessName}`;
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines)}`;
  }

  if (!totals || !estimate) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center p-8">
        <p className="text-[13px]" style={{ color: "var(--zn-ink-3)" }}>Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100">
      {/* Toolbar — hidden in print */}
      <div className="max-w-[820px] mx-auto p-6 flex items-center justify-between print:hidden">
        <Link
          href="/tax-estimate"
          className="inline-flex items-center gap-1.5 text-[12.5px] font-medium hover:opacity-70"
          style={{ color: "var(--zn-ink-3)" }}
        >
          <ArrowLeft className="size-3.5" />
          Back to tax estimate
        </Link>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={emailToAccountant}
            className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-medium border border-neutral-300 hover:bg-neutral-50"
          >
            <Mail className="size-3.5" />
            Email to accountant
          </button>
          <button
            type="button"
            onClick={() => { if (typeof window !== "undefined") window.print(); }}
            className="inline-flex items-center gap-1.5 rounded-full bg-neutral-900 text-white px-4 py-2 text-[13px] font-semibold hover:bg-neutral-800"
          >
            <Printer className="size-3.5" />
            Save as PDF
          </button>
        </div>
      </div>

      {/* The page itself */}
      <div className="max-w-[820px] mx-auto px-10 py-8 print:py-0 print:px-12">
        <header className="border-b border-neutral-300 pb-6 mb-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
            Year-end summary
          </p>
          <h1 className="text-[28px] font-semibold mt-1 leading-tight">
            {businessName}
          </h1>
          <p className="mt-2 text-[14px] text-neutral-600">
            Tax year <strong>{taxYear}</strong> · {fmtTaxYearWindow(taxYear)}
          </p>
        </header>

        {/* Headline numbers */}
        <section className="grid grid-cols-2 gap-6 mb-8">
          <Headline label="Income"   value={fmtGBP(totals.income)} />
          <Headline label="Expenses" value={fmtGBP(totals.expenses)} />
          <Headline label="Net profit" value={fmtGBP(estimate.netProfit)} highlight />
          <Headline label="Estimated tax owed" value={fmtGBP(estimate.estimatedTaxOwed)} highlight />
          {totals.vatCharged > 0 && (
            <Headline label="VAT charged (output)" value={fmtGBP(totals.vatCharged)} />
          )}
        </section>

        {/* Detailed table */}
        <section className="mb-8">
          <h2 className="text-[13px] font-bold uppercase tracking-wider text-neutral-500 mb-3">
            Breakdown
          </h2>
          <table className="w-full text-[13px]">
            <tbody>
              <Row label="Total invoiced (accrual basis)"          value={fmtGBP(totals.income)} />
              <Row label="Allowable expenses"                       value={`(${fmtPlainGBP(totals.expenses)})`} />
              <Row label="Net profit"                               value={fmtGBP(estimate.netProfit)} bold borderTop />
              <Row label="Personal allowance applied"               value={`(${fmtPlainGBP(estimate.personalAllowanceApplied)})`} muted />
              <Row label="Income Tax · basic rate (20%)"            value={fmtGBP(estimate.incomeTax.basic.tax)}
                   sub={`on ${fmtGBP(estimate.incomeTax.basic.taxable)}`} />
              {estimate.incomeTax.higher.tax > 0 && (
                <Row label="Income Tax · higher rate (40%)"         value={fmtGBP(estimate.incomeTax.higher.tax)}
                     sub={`on ${fmtGBP(estimate.incomeTax.higher.taxable)}`} />
              )}
              {estimate.incomeTax.additional.tax > 0 && (
                <Row label="Income Tax · additional rate (45%)"     value={fmtGBP(estimate.incomeTax.additional.tax)}
                     sub={`on ${fmtGBP(estimate.incomeTax.additional.taxable)}`} />
              )}
              <Row label="Class 4 NIC · main rate (6%)"              value={fmtGBP(estimate.nic.main.nic)}
                   sub={`on ${fmtGBP(estimate.nic.main.profits)}`} />
              {estimate.nic.upper.nic > 0 && (
                <Row label="Class 4 NIC · upper rate (2%)"           value={fmtGBP(estimate.nic.upper.nic)}
                     sub={`on ${fmtGBP(estimate.nic.upper.profits)}`} />
              )}
              <Row label="Estimated total tax owed"                  value={fmtGBP(estimate.estimatedTaxOwed)} bold borderTop large />
            </tbody>
          </table>
        </section>

        {/* SA103 box mapping — short form for self-employed turnover <£90k.
            Numbers are estimates the user copies into the relevant SA103S
            boxes on their HMRC return. */}
        <Sa103BoxMap
          income={totals.income}
          expenses={totals.expenses}
          netProfit={estimate.netProfit}
          vatCharged={totals.vatCharged}
        />

        {/* Counts */}
        <section className="grid grid-cols-2 gap-6 mb-8 text-[12.5px] text-neutral-600">
          <div>
            <p className="font-semibold text-neutral-800">Invoices included</p>
            <p>{totals.invoiceCount} invoice{totals.invoiceCount === 1 ? "" : "s"} issued between {fmtTaxYearWindow(taxYear)}.</p>
          </div>
          <div>
            <p className="font-semibold text-neutral-800">Expenses included</p>
            <p>{totals.expenseCount} expense{totals.expenseCount === 1 ? "" : "s"} dated within the tax year.</p>
          </div>
        </section>

        {/* Warnings */}
        {estimate.warnings.length > 0 && (
          <section className="mb-8 rounded-lg border border-amber-200 bg-amber-50 p-4 text-[12px] leading-5 text-amber-900">
            <p className="font-semibold mb-1">Things to check with your accountant</p>
            <ul className="list-disc pl-5 space-y-1">
              {estimate.warnings.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          </section>
        )}

        {/* Footer */}
        <footer className="border-t border-neutral-200 pt-4 text-[11px] leading-5 text-neutral-500">
          <p>
            <strong>Estimate only.</strong> This summary is generated by Zentra Collect from the
            invoices and expenses you tracked. It is not a Self Assessment return and is not
            filed with HMRC. File via{" "}
            <a href="https://www.gov.uk/log-in-file-self-assessment-tax-return"
               target="_blank" rel="noopener noreferrer" className="underline">
              HMRC&rsquo;s online portal
            </a>
            {" "}or hand these numbers to your accountant. VAT, Class 2 NIC, the £100,000
            personal-allowance taper, Scottish income tax rates, dividends, capital gains, and
            pension contributions are not modelled.
          </p>
          <p className="mt-2 text-neutral-400">
            Generated by Zentra Collect on {new Date().toLocaleDateString("en-GB", {
              day: "numeric", month: "long", year: "numeric",
            })}.
          </p>
        </footer>
      </div>
    </div>
  );
}

/**
 * SA103S box mapping — the boxes a sole trader fills in on their UK
 * Self-Assessment short self-employment supplement (turnover < £90k).
 *
 * The numbers come from the tax-year totals; the user copies each
 * value into the matching box on HMRC's online return.
 *
 * Box references are from the SA103S (2024–25 version). They are
 * the same boxes used in successive years; HMRC changes the form
 * layout but the box numbering is stable.
 */
function Sa103BoxMap({
  income, expenses, netProfit, vatCharged,
}: {
  income:     number;
  expenses:   number;
  netProfit:  number;
  vatCharged: number;
}) {
  const [copied, setCopied] = useState<string | null>(null);

  function copy(label: string, value: number) {
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    navigator.clipboard.writeText(value.toFixed(2)).then(() => {
      setCopied(label);
      setTimeout(() => setCopied(null), 1500);
    });
  }

  const rows: Array<{ box: string; label: string; value: number }> = [
    { box: "9",  label: "Your turnover (total income)",       value: income },
    { box: "20", label: "Total allowable expenses",           value: expenses },
    { box: "21", label: "Net profit",                         value: Math.max(0, netProfit) },
    { box: "22", label: "Net loss (if expenses > income)",    value: Math.max(0, -netProfit) },
  ];

  return (
    <section className="mb-8">
      <h2 className="text-[13px] font-bold uppercase tracking-wider text-neutral-500 mb-3">
        Copy to your SA103S return
      </h2>
      <p className="text-[12px] text-neutral-600 mb-3 leading-5">
        Type these figures into the matching boxes on HMRC&rsquo;s online
        Self&nbsp;Assessment self-employment short form. Each box has a
        copy button — click to copy the value to your clipboard.
      </p>
      <div className="rounded-lg border border-neutral-300 overflow-hidden">
        <table className="w-full text-[13px]">
          <thead className="bg-neutral-100 text-[11px] uppercase tracking-wider text-neutral-600">
            <tr>
              <th className="text-left py-2 px-3 w-16">Box</th>
              <th className="text-left py-2 px-3">Description</th>
              <th className="text-right py-2 px-3 w-32">Value</th>
              <th className="text-right py-2 px-3 w-12 print:hidden hidden sm:table-cell"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.box} className="border-t border-neutral-200">
                <td className="py-2 px-3 font-semibold text-neutral-700">{r.box}</td>
                <td className="py-2 px-3 text-neutral-700">{r.label}</td>
                <td className="py-2 px-3 text-right tabular-nums font-medium">
                  {fmtPlainGBP(r.value)}
                </td>
                <td className="py-2 px-3 text-right print:hidden hidden sm:table-cell">
                  <button
                    type="button"
                    onClick={() => copy(r.box, r.value)}
                    aria-label={`Copy box ${r.box} value`}
                    className="inline-flex items-center justify-center size-6 rounded hover:bg-neutral-100 text-neutral-500 hover:text-neutral-800"
                  >
                    {copied === r.box
                      ? <Check className="size-3.5 text-emerald-600" />
                      : <Copy  className="size-3.5" />}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {vatCharged > 0 && (
        <p className="mt-3 text-[12px] text-neutral-600 leading-5">
          <strong>VAT-registered?</strong> Output VAT for the period is{" "}
          {fmtGBP(vatCharged)}. Enter this in Box 1 of your VAT return,
          adjusted for any input VAT on expenses.
        </p>
      )}
    </section>
  );
}

function Headline({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wider text-neutral-500">{label}</p>
      <p className={`mt-1 tabular-nums ${highlight ? "text-[26px] font-semibold" : "text-[22px] font-medium"}`}>
        {value}
      </p>
    </div>
  );
}

function Row({
  label, value, sub, bold, muted, borderTop, large,
}: {
  label: string;
  value: string;
  sub?: string;
  bold?: boolean;
  muted?: boolean;
  borderTop?: boolean;
  large?: boolean;
}) {
  return (
    <tr style={{ borderTop: borderTop ? "1px solid #d4d4d4" : undefined }}>
      <td className="py-2"
          style={{
            color: muted ? "#737373" : "#404040",
            fontWeight: bold ? 600 : undefined,
            fontSize: large ? 14 : undefined,
          }}>
        {label}
        {sub && (
          <span className="ml-2 text-[11px] text-neutral-500">{sub}</span>
        )}
      </td>
      <td className="py-2 text-right tabular-nums"
          style={{
            color: muted ? "#737373" : "#171717",
            fontWeight: bold ? 600 : undefined,
            fontSize: large ? 16 : undefined,
          }}>
        {value}
      </td>
    </tr>
  );
}
