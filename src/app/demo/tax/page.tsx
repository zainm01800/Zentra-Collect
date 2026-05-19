"use client";

/**
 * /demo/tax — year-end style summary using only fake demo data. Mirrors
 * the layout of the real /year-end page so visitors see exactly what
 * they get post-signup. SA103 box copy is disabled (purely visual).
 */

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import {
  demoMileageTrips,
  demoQuotes,
  demoCreditNotes,
  demoDirectIncome,
} from "@/lib/demo-data/demo-books-data";
import { calcMileageAllowance } from "@/lib/mileage";
import { estimateUkSelfEmployedTax } from "@/lib/tax/uk-self-employed";

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

// Mock invoiced income — typical small-services figure for a demo.
const DEMO_INVOICED_INCOME = 38_400;
const DEMO_INVOICED_VAT    = 7_680;
const DEMO_EXPENSES_TRACKED = 4_120;

export default function DemoTaxPage() {
  const [copiedBox, setCopiedBox] = useState<string | null>(null);

  function copyVal(box: string, value: number) {
    navigator.clipboard.writeText(fmtPlainGBP(value)).catch(() => {});
    setCopiedBox(box);
    setTimeout(() => setCopiedBox((c) => (c === box ? null : c)), 1500);
  }
  const directIncomeTotal = demoDirectIncome.reduce((s, d) => s + d.amount, 0);
  const totalMiles = demoMileageTrips.reduce((s, t) => s + t.miles, 0);
  const mileageAllowance = calcMileageAllowance(totalMiles).allowance;
  const creditedNet = demoCreditNotes.reduce((s, c) => s + c.amountNet, 0);
  const creditedVat = demoCreditNotes.reduce((s, c) => s + c.vatAmount, 0);

  const income     = Math.max(0, DEMO_INVOICED_INCOME + directIncomeTotal - creditedNet);
  const expenses   = DEMO_EXPENSES_TRACKED + mileageAllowance;
  const vatCharged = Math.max(0, DEMO_INVOICED_VAT - creditedVat);

  const estimate = estimateUkSelfEmployedTax(
    { income, expenses },
    "2026/27",
  );

  const sa103Rows: Array<{ box: string; label: string; value: number }> = [
    { box: "9",  label: "Your turnover (total income)",   value: income },
    { box: "20", label: "Total allowable expenses",       value: expenses },
    { box: "21", label: "Net profit",                     value: Math.max(0, estimate.netProfit) },
    { box: "22", label: "Net loss",                       value: Math.max(0, -estimate.netProfit) },
  ];

  return (
    <div className="space-y-6">
      <div>
        <p className="zn-section-label">Demo · Tax &amp; VAT</p>
        <h1 className="text-[28px] font-semibold tracking-[-0.02em] leading-[1.1] mt-1"
            style={{ color: "var(--zn-ink)" }}>
          Year-end summary
        </h1>
        <p className="mt-1 text-[13.5px]" style={{ color: "var(--zn-ink-3)" }}>
          Tax year 2026/27 · estimate only · sample data
        </p>
      </div>

      {/* Headline numbers */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Headline label="Income"            value={fmtGBP(income)} />
        <Headline label="Expenses"          value={fmtGBP(expenses)} />
        <Headline label="Net profit"        value={fmtGBP(estimate.netProfit)} highlight />
        <Headline label="Estimated tax"     value={fmtGBP(estimate.estimatedTaxOwed)} highlight />
        {vatCharged > 0 && (
          <Headline label="VAT charged"     value={fmtGBP(vatCharged)} />
        )}
        {vatCharged > 0 && (
          <Headline label="VAT to pay HMRC" value={fmtGBP(Math.max(0, vatCharged - 824))} highlight />
        )}
      </div>

      {/* What feeds in */}
      <div className="zn-card p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] mb-3"
           style={{ color: "var(--zn-ink-3)" }}>
          What's feeding into this estimate
        </p>
        <div className="space-y-2 text-[12.5px]">
          <Row label={`Invoiced income (8 sample invoices)`}                    value={fmtGBP(DEMO_INVOICED_INCOME)} />
          <Row label={`Direct income tagged from bank feed (${demoDirectIncome.length} txns)`} value={fmtGBP(directIncomeTotal)} />
          <Row label={`Credit notes issued (${demoCreditNotes.length})`}        value={`−${fmtPlainGBP(creditedNet)}`} muted />
          <Row label={`Total income`}                                           value={fmtGBP(income)} bold borderTop />
          <Row label={`Expenses tracked`}                                       value={fmtGBP(DEMO_EXPENSES_TRACKED)} />
          <Row label={`Mileage allowance (${totalMiles} mi × HMRC rates)`}      value={fmtGBP(mileageAllowance)} />
          <Row label={`Total expenses`}                                         value={fmtGBP(expenses)} bold borderTop />
        </div>
      </div>

      {/* SA103 boxes */}
      <div>
        <p className="text-[13px] font-bold uppercase tracking-wider mb-2"
           style={{ color: "var(--zn-ink-3)" }}>
          Copy to your SA103S return
        </p>
        <p className="text-[12px] mb-3" style={{ color: "var(--zn-ink-3)" }}>
          These are the boxes you fill in on HMRC&rsquo;s online Self Assessment short form.
        </p>
        <div className="zn-card overflow-hidden">
          <table className="w-full text-[13px]">
            <thead style={{ background: "var(--zn-surface-2)" }}>
              <tr className="text-[10.5px] uppercase tracking-wider"
                  style={{ color: "var(--zn-ink-3)" }}>
                <th className="text-left py-2 px-3 w-16">Box</th>
                <th className="text-left py-2 px-3">Description</th>
                <th className="text-right py-2 px-3 w-32">Value</th>
                <th className="w-10 print:hidden"></th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: "var(--zn-line-soft)" }}>
              {sa103Rows.map((r) => (
                <tr key={r.box}>
                  <td className="py-2 px-3 font-semibold" style={{ color: "var(--zn-ink-2)" }}>{r.box}</td>
                  <td className="py-2 px-3" style={{ color: "var(--zn-ink-2)" }}>{r.label}</td>
                  <td className="py-2 px-3 text-right tabular-nums font-medium"
                      style={{ color: "var(--zn-ink)" }}>{fmtPlainGBP(r.value)}</td>
                  <td className="py-2 px-3 text-right print:hidden">
                    <button type="button" onClick={() => copyVal(r.box, r.value)}
                      title="Copy value"
                      className="inline-flex items-center justify-center size-6 rounded hover:bg-black/5 transition-colors"
                      style={{ color: copiedBox === r.box ? "var(--zn-safe)" : "var(--zn-ink-3)" }}>
                      {copiedBox === r.box ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-[11.5px] rounded-lg px-3 py-2"
         style={{ background: "var(--zn-warn-soft)", color: "var(--zn-warn)" }}>
        Estimate only. Zentra is not a regulated accounting service. File via HMRC or hand these figures to your accountant.
      </p>
    </div>
  );
}

function Headline({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="zn-card p-4">
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.07em]"
         style={{ color: "var(--zn-ink-3)" }}>{label}</p>
      <p className={`mt-2 tabular-nums leading-none ${highlight ? "text-[22px] font-bold" : "text-[18px] font-semibold"}`}
         style={{ color: "var(--zn-ink)" }}>{value}</p>
    </div>
  );
}

function Row({ label, value, bold, muted, borderTop }: { label: string; value: string; bold?: boolean; muted?: boolean; borderTop?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1"
         style={{ borderTop: borderTop ? "1px solid var(--zn-line-soft)" : undefined, paddingTop: borderTop ? 8 : undefined }}>
      <span style={{ color: muted ? "var(--zn-ink-3)" : "var(--zn-ink-2)", fontWeight: bold ? 600 : undefined }}>
        {label}
      </span>
      <span className="tabular-nums"
            style={{ color: muted ? "var(--zn-ink-3)" : "var(--zn-ink)", fontWeight: bold ? 600 : undefined }}>
        {value}
      </span>
    </div>
  );
}
