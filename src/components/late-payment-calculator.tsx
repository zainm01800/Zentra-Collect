"use client";

/**
 * UK Statutory Late Payment Interest Calculator
 *
 * Under the Late Payment of Commercial Debts (Interest) Act 1998:
 *   - B2B invoices only (not consumer debts)
 *   - Statutory rate = Bank of England Base Rate + 8%
 *   - Fixed compensation per invoice:
 *       £40  if debt < £1,000
 *       £70  if debt £1,000–£9,999.99
 *       £100 if debt ≥ £10,000
 *
 * Disclaimer is shown prominently — this is a calculator, not legal advice.
 */

import { useState, useMemo } from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft, Calculator, Copy, Check } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";

// ── Bank of England base rate (update when BoE changes rate) ─────────────────
const BOE_BASE_RATE = 4.5; // % — as of Q1 2026
const STATUTORY_INTEREST_RATE = BOE_BASE_RATE + 8; // = 12.5%

// ── Fixed compensation thresholds ─────────────────────────────────────────────
function compensationAmount(debtAmount: number): number {
  if (debtAmount < 1000) return 40;
  if (debtAmount < 10000) return 70;
  return 100;
}

// ── Interest calculation ───────────────────────────────────────────────────────
function calculateInterest(debtAmount: number, daysOverdue: number) {
  // Daily rate = annual rate / 365
  const dailyRate = STATUTORY_INTEREST_RATE / 100 / 365;
  const interest = debtAmount * dailyRate * daysOverdue;
  const compensation = compensationAmount(debtAmount);
  const total = debtAmount + interest + compensation;
  return { interest, compensation, total, dailyRate, annualRate: STATUTORY_INTEREST_RATE };
}

// ── Small copy button ─────────────────────────────────────────────────────────
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  function doCopy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <button
      type="button"
      onClick={doCopy}
      className="flex items-center gap-1 text-[11.5px] font-medium px-2 py-0.5 rounded-md transition-colors"
      style={{
        color: copied ? "var(--zn-safe)" : "var(--zn-ink-3)",
        background: "var(--zn-surface-2)",
        border: "1px solid var(--zn-line-soft)",
      }}
    >
      {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export function LatePaymentCalculator() {
  const [debtStr, setDebtStr]   = useState("");
  const [daysStr, setDaysStr]   = useState("");
  const [invoiceRef, setInvoiceRef] = useState("");

  const debtAmount  = parseFloat(debtStr.replace(/[£,]/g, "")) || 0;
  const daysOverdue = parseInt(daysStr, 10) || 0;
  const canCalc = debtAmount > 0 && daysOverdue > 0;

  const result = useMemo(
    () => (canCalc ? calculateInterest(debtAmount, daysOverdue) : null),
    [debtAmount, daysOverdue, canCalc],
  );

  // Draft demand paragraph (plain English, not legal advice)
  const draftParagraph = result
    ? `Under the Late Payment of Commercial Debts (Interest) Act 1998, we are entitled to claim statutory interest at ${result.annualRate}% per annum (Bank of England base rate + 8%) on overdue B2B invoices, plus a fixed compensation charge.${invoiceRef ? ` For invoice ${invoiceRef}` : " For this invoice"}, the debt of ${formatCurrency(debtAmount)} has been overdue for ${daysOverdue} day${daysOverdue !== 1 ? "s" : ""}. The statutory interest accrued is ${formatCurrency(result.interest)}, and the fixed compensation charge is ${formatCurrency(result.compensation)}. The total claim including the original debt is ${formatCurrency(result.total)}.`
    : "";

  return (
    <div className="flex flex-col gap-6 max-w-3xl mx-auto">
      {/* Back link */}
      <Link
        href="/tools"
        className="flex items-center gap-1.5 text-[13px] font-medium self-start"
        style={{ color: "var(--zn-ink-3)" }}
      >
        <ArrowLeft className="size-4" /> Tools
      </Link>

      {/* Header */}
      <section>
        <div className="zn-label mb-1.5">UK Late Payment Act 1998</div>
        <h1 className="zn-page-h1">Late payment interest calculator</h1>
        <p className="mt-1.5 text-[13.5px] max-w-[520px]" style={{ color: "var(--zn-ink-3)" }}>
          Calculate UK statutory interest and compensation on overdue B2B invoices.
          Current rate: BoE base rate ({BOE_BASE_RATE}%) + 8% = <strong>{STATUTORY_INTEREST_RATE}%</strong> per annum.
        </p>
      </section>

      {/* Disclaimer */}
      <div
        className="flex items-start gap-3 rounded-xl p-4 text-[12.5px] leading-relaxed"
        style={{
          background: "var(--zn-warn-soft)",
          border: "1px solid var(--zn-warn)",
          color: "var(--zn-ink-2)",
        }}
      >
        <AlertCircle className="size-4 flex-shrink-0 mt-0.5" style={{ color: "var(--zn-warn)" }} />
        <div>
          <strong>This is a calculator, not legal advice.</strong> Statutory late payment interest applies
          to B2B invoices only (not consumer debts). Always check the current BoE base rate and consult a
          solicitor before making a formal legal claim. Zentra is not liable for how you use this output.
        </div>
      </div>

      {/* Input form */}
      <div className="zn-card p-5 lg:p-6">
        <div className="flex items-center gap-2 mb-5">
          <Calculator className="size-4" style={{ color: "var(--zn-accent)" }} />
          <div className="text-[14px] font-semibold" style={{ color: "var(--zn-ink)" }}>Enter invoice details</div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {/* Debt amount */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-semibold uppercase tracking-[0.07em]" style={{ color: "var(--zn-ink-3)" }}>
              Amount outstanding (£)
            </label>
            <div className="relative">
              <span
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[14px] font-medium"
                style={{ color: "var(--zn-ink-3)" }}
              >£</span>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={debtStr}
                onChange={(e) => setDebtStr(e.target.value)}
                className="w-full rounded-lg border py-2.5 pl-8 pr-3 text-[15px] font-semibold outline-none"
                style={{
                  background: "var(--zn-bg-2)",
                  borderColor: "var(--zn-line)",
                  color: "var(--zn-ink)",
                }}
              />
            </div>
          </div>

          {/* Days overdue */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-semibold uppercase tracking-[0.07em]" style={{ color: "var(--zn-ink-3)" }}>
              Days overdue
            </label>
            <input
              type="number"
              min="1"
              step="1"
              placeholder="30"
              value={daysStr}
              onChange={(e) => setDaysStr(e.target.value)}
              className="w-full rounded-lg border py-2.5 px-3 text-[15px] font-semibold outline-none"
              style={{
                background: "var(--zn-bg-2)",
                borderColor: "var(--zn-line)",
                color: "var(--zn-ink)",
              }}
            />
          </div>

          {/* Optional invoice ref */}
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <label className="text-[12px] font-semibold uppercase tracking-[0.07em]" style={{ color: "var(--zn-ink-3)" }}>
              Invoice reference (optional — used in draft text)
            </label>
            <input
              type="text"
              placeholder="e.g. INV-2024-0042"
              value={invoiceRef}
              onChange={(e) => setInvoiceRef(e.target.value)}
              className="w-full rounded-lg border py-2.5 px-3 text-[14px] outline-none"
              style={{
                background: "var(--zn-bg-2)",
                borderColor: "var(--zn-line)",
                color: "var(--zn-ink)",
              }}
            />
          </div>
        </div>
      </div>

      {/* Results */}
      {result && (
        <div className="flex flex-col gap-4">
          {/* Breakdown */}
          <div className="zn-card p-5 lg:p-6">
            <div className="zn-label !p-0 mb-4">Calculation breakdown</div>

            <div className="flex flex-col divide-y" style={{ borderColor: "var(--zn-line-soft)" }}>
              {[
                { label: "Original debt",          value: formatCurrency(debtAmount),     muted: false },
                { label: `Interest (${result.annualRate}% p.a. × ${daysOverdue} days)`, value: `+ ${formatCurrency(result.interest)}`, muted: false },
                { label: "Fixed compensation charge", value: `+ ${formatCurrency(result.compensation)}`, muted: false },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between py-2.5">
                  <span className="text-[13px]" style={{ color: row.muted ? "var(--zn-ink-3)" : "var(--zn-ink-2)" }}>
                    {row.label}
                  </span>
                  <span className="text-[14px] font-semibold tabular-nums" style={{ color: "var(--zn-ink)" }}>
                    {row.value}
                  </span>
                </div>
              ))}
            </div>

            <div
              className="flex items-center justify-between mt-3 pt-3 rounded-xl p-3"
              style={{ background: "var(--zn-surface-2)", border: "1px solid var(--zn-line)" }}
            >
              <span className="text-[14px] font-semibold" style={{ color: "var(--zn-ink)" }}>
                Total claim (including original debt)
              </span>
              <span className="text-[22px] font-bold tabular-nums" style={{ color: "var(--zn-accent)" }}>
                {formatCurrency(result.total)}
              </span>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2.5">
              {[
                { label: "Interest accrued",    value: formatCurrency(result.interest) },
                { label: "Compensation charge", value: formatCurrency(result.compensation) },
                { label: "Daily rate",          value: `${(result.dailyRate * 100).toFixed(5)}%` },
              ].map((s) => (
                <div
                  key={s.label}
                  className="rounded-xl p-3"
                  style={{ background: "var(--zn-bg-2)", border: "1px solid var(--zn-line-soft)" }}
                >
                  <div className="zn-label !p-0 mb-1" style={{ fontSize: 10 }}>{s.label}</div>
                  <div className="text-[14px] font-semibold tabular-nums" style={{ color: "var(--zn-ink)" }}>{s.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Draft paragraph */}
          <div className="zn-card p-5 lg:p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="zn-label !p-0">Draft demand paragraph</div>
              <CopyButton text={draftParagraph} />
            </div>
            <p
              className="text-[13.5px] leading-relaxed italic rounded-lg p-3"
              style={{
                color: "var(--zn-ink-2)",
                background: "var(--zn-bg-2)",
                border: "1px solid var(--zn-line-soft)",
              }}
            >
              {draftParagraph}
            </p>
            <p className="mt-3 text-[11.5px] leading-relaxed" style={{ color: "var(--zn-ink-3)" }}>
              Review and adapt this text before sending. You are responsible for all communications with your customers. Zentra provides this as a starting point only.
            </p>
          </div>
        </div>
      )}

      {!canCalc && (
        <div
          className="rounded-xl p-8 text-center text-[13px]"
          style={{
            border: "1px dashed var(--zn-line)",
            color: "var(--zn-ink-3)",
          }}
        >
          Enter the outstanding amount and number of days overdue to see your calculation.
        </div>
      )}

      {/* Legal reference */}
      <div
        className="rounded-xl p-4 text-[12px] leading-relaxed"
        style={{ background: "var(--zn-surface-2)", color: "var(--zn-ink-3)", border: "1px solid var(--zn-line-soft)" }}
      >
        <strong style={{ color: "var(--zn-ink-2)" }}>Legal basis:</strong> Late Payment of Commercial Debts (Interest) Act 1998 (as amended). Applies to B2B contracts where no other interest rate has been agreed in writing. Consumer debts are subject to different rules. The BoE base rate shown ({BOE_BASE_RATE}%) is manually maintained — always verify against the{" "}
        <a
          href="https://www.bankofengland.co.uk/monetary-policy/the-interest-rate-bank-rate"
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
          style={{ color: "var(--zn-ink-2)" }}
        >
          Bank of England
        </a>{" "}
        before relying on this for a formal claim.
      </div>
    </div>
  );
}
