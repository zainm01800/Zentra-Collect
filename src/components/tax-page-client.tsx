"use client";

/**
 * Client-side tax page — reads income and expenses from localStorage so
 * the page shows real data in demo / offline mode (no Supabase required).
 * Mirrors the calculation logic from src/app/tax/page.tsx but uses
 * totalsForTaxYear() + a client-built monthly series instead of server actions.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { FileText } from "lucide-react";
import { TaxCalcDetails } from "@/components/tax-calc-details";
import { totalsForTaxYear } from "@/lib/tax/summary";
import { currentUkTaxYear } from "@/lib/tax/uk-self-employed";
import { importedInvoicesStorageKey } from "@/lib/import/zentra-import";
import { readActiveClientId, clientInvoicesKey } from "@/lib/bookkeeper-clients";
import { readLocalAccount } from "@/lib/demo-auth";
import { subscribeToInvoiceChanges } from "@/lib/invoice-store";
import type { Invoice } from "@/types/zentra";

// ── UK tax constants (2025/26) ────────────────────────────────────────────────
const PERSONAL_ALLOWANCE  = 12_570;
const CLASS_4_LOWER_LIMIT = 12_570;
const CLASS_4_UPPER_LIMIT = 50_270;
const CLASS_4_RATE_LOWER  = 0.06;
const CLASS_4_RATE_UPPER  = 0.02;
const CLASS_2_NI_ANNUAL   = 0;
const BOOKKEEPER_PLAN_IDS = ["bookkeeper_starter", "bookkeeper_pro"];

// ── Pure calculation helpers ──────────────────────────────────────────────────

function calcIncomeTax(annual: number, ratePercent: number): number {
  return Math.max(0, annual - PERSONAL_ALLOWANCE) * (ratePercent / 100);
}
function calcClass4NI(annual: number): number {
  if (annual <= CLASS_4_LOWER_LIMIT) return 0;
  const lower = (Math.min(annual, CLASS_4_UPPER_LIMIT) - CLASS_4_LOWER_LIMIT) * CLASS_4_RATE_LOWER;
  const upper = Math.max(0, annual - CLASS_4_UPPER_LIMIT) * CLASS_4_RATE_UPPER;
  return lower + upper;
}
function calcClass2NI(annual: number): number {
  return annual > PERSONAL_ALLOWANCE ? CLASS_2_NI_ANNUAL : 0;
}
function monthsElapsedInTaxYear(): number {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth() + 1;
  const d = now.getUTCDate();
  const startYear = m > 4 || (m === 4 && d >= 6) ? y : y - 1;
  return Math.max(1, (y - startYear) * 12 + m - 4);
}
function nextSaPayment() {
  const now = new Date();
  const y = now.getUTCFullYear();
  const make = (yr: number, mo: number, da: number) => new Date(Date.UTC(yr, mo - 1, da));
  const jan31 = make(y, 1, 31);
  const jul31 = make(y, 7, 31);
  const jan31Next = make(y + 1, 1, 31);
  const pick =
    now <= jan31 ? { date: jan31, friendly: `31 January ${y}`, desc: "1st payment on account" } :
    now <= jul31 ? { date: jul31, friendly: `31 July ${y}`,     desc: "2nd payment on account" } :
                  { date: jan31Next, friendly: `31 January ${y + 1}`, desc: "1st payment on account" };
  return {
    isoDate:     pick.date.toISOString().slice(0, 10),
    friendly:    pick.friendly,
    description: pick.desc,
  };
}
function daysUntilDate(isoDate: string): number {
  return Math.ceil((new Date(`${isoDate}T00:00:00.000Z`).getTime() - Date.now()) / 86_400_000);
}
function fmtGBP(n: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency", currency: "GBP",
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(n);
}

// ── Monthly series builder ────────────────────────────────────────────────────

interface MonthlyItem {
  yearMonth: string;
  label:     string;
  income:    number;
}

function readInvoicesFromStorage(): Invoice[] {
  if (typeof window === "undefined") return [];
  try {
    const account = readLocalAccount();
    let key = importedInvoicesStorageKey;
    if (account && BOOKKEEPER_PLAN_IDS.includes(account.planId)) {
      const activeId = readActiveClientId();
      if (activeId && activeId !== "all") key = clientInvoicesKey(activeId);
    }
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function buildMonthlyIncomeSeries(n: number): MonthlyItem[] {
  const invoices = readInvoicesFromStorage();
  const now = new Date();
  const result: MonthlyItem[] = [];

  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const yearMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("en-GB", { month: "short", year: "numeric" });

    const income = invoices
      .filter((inv) => {
        const id = new Date(inv.invoiceDate);
        if (isNaN(id.getTime())) return false;
        const ym = `${id.getFullYear()}-${String(id.getMonth() + 1).padStart(2, "0")}`;
        return ym === yearMonth;
      })
      .reduce((s, inv) => s + (inv.amount ?? 0), 0);

    result.push({ yearMonth, label, income });
  }
  return result;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function NextPaymentBanner({
  friendly, description, daysLeft,
}: { friendly: string; description: string; daysLeft: number }) {
  const urgent  = daysLeft <= 30;
  const warning = daysLeft <= 90;
  const bg     = urgent  ? "var(--zn-risk-soft)"  : warning ? "var(--zn-warn-soft)"  : "var(--zn-info-soft)";
  const fg     = urgent  ? "var(--zn-risk)"        : warning ? "var(--zn-warn)"        : "var(--zn-info)";
  const border = urgent  ? "var(--zn-risk)"        : warning ? "var(--zn-warn)"        : "var(--zn-info)";

  return (
    <div className="flex items-center justify-between gap-4 rounded-[12px] px-4 py-3.5"
         style={{ background: bg, border: `1px solid ${border}` }}>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.09em]" style={{ color: fg }}>
          Next payment due
        </p>
        <p className="mt-0.5 text-[14px] font-semibold" style={{ color: fg }}>
          {friendly}{" "}
          <span className="text-[12px] font-medium" style={{ color: fg, opacity: 0.75 }}>
            — {description}
          </span>
        </p>
      </div>
      <div className="text-right flex-shrink-0">
        <p className="text-[22px] font-bold tabular-nums leading-none" style={{ color: fg }}>{daysLeft}</p>
        <p className="text-[10px] font-medium mt-0.5" style={{ color: fg, opacity: 0.75 }}>days away</p>
      </div>
    </div>
  );
}

function TaxHeroCard({ setAside, totalLiability, progressPct, months }: {
  setAside: number; totalLiability: number; progressPct: number; months: number;
}) {
  const empty = totalLiability <= 0;
  return (
    <div className="zn-card px-5 py-5">
      <span className="zn-label">Set aside so far</span>
      <p className="mt-3 text-[42px] font-bold leading-none tracking-tight"
         style={{ color: "var(--zn-warn)", fontVariantNumeric: "tabular-nums" }}>
        {empty ? "—" : fmtGBP(setAside)}
      </p>
      <p className="mt-1.5 text-[12.5px]" style={{ color: "var(--zn-ink-3)" }}>
        {empty
          ? "No income recorded yet — add invoices to track your reserve."
          : `Month ${months} of 12 · estimated full-year liability ${fmtGBP(totalLiability)}`}
      </p>
      <div className="mt-4 space-y-1.5">
        <div className="h-[8px] w-full overflow-hidden rounded-full" style={{ background: "var(--zn-line)" }}
             role="progressbar" aria-valuenow={Math.round(progressPct)} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full transition-all duration-700"
               style={{ width: `${Math.max(progressPct, progressPct > 0 ? 2 : 0)}%`, background: "var(--zn-warn)" }} />
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

function LiabilityRow({ label, sub, amount, accentColor, visible = true, negative = false }: {
  label: string; sub: string; amount: number; accentColor: string; visible?: boolean; negative?: boolean;
}) {
  if (!visible) return null;
  return (
    <div className="flex items-center gap-4 py-3.5 pl-4" style={{ borderLeft: `3px solid ${accentColor}` }}>
      <div className="flex-1 min-w-0">
        <p className="text-[13.5px] font-semibold" style={{ color: "var(--zn-ink)" }}>{label}</p>
        <p className="text-[12px] mt-0.5" style={{ color: "var(--zn-ink-3)" }}>{sub}</p>
      </div>
      <p className="text-[15px] font-bold flex-shrink-0 tabular-nums" style={{ color: accentColor }}>
        {negative ? "−" : ""}{fmtGBP(amount)}
      </p>
    </div>
  );
}

function LiabilityBreakdown({ annualIncome, allowableExpenses, incomeTaxAmount, class4NI, class2NI,
  totalLiability, taxRatePercent, isGB }: {
  annualIncome: number; allowableExpenses: number; incomeTaxAmount: number;
  class4NI: number; class2NI: number; totalLiability: number; taxRatePercent: number; isGB: boolean;
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
      <div className="mt-4 flex flex-col gap-3">
        <LiabilityRow label="Allowable expenses"
          sub="Deducted from gross income to arrive at taxable profit"
          amount={allowableExpenses} accentColor="var(--zn-safe)"
          visible={allowableExpenses > 0} negative />
        <LiabilityRow label="Income Tax"
          sub={`${taxRatePercent}% on income above the £${PERSONAL_ALLOWANCE.toLocaleString("en-GB")} personal allowance`}
          amount={incomeTaxAmount} accentColor="var(--zn-warn)" />
        <LiabilityRow label="Class 4 National Insurance"
          sub="6% on profits £12,570–£50,270, then 2% above that"
          amount={class4NI} accentColor="var(--zn-risk)" visible={isGB && class4NI > 0} />
        <LiabilityRow label="Class 2 National Insurance"
          sub={`Flat £${CLASS_2_NI_ANNUAL}/year when profits exceed £${PERSONAL_ALLOWANCE.toLocaleString("en-GB")}`}
          amount={class2NI} accentColor="var(--zn-info)" visible={isGB && class2NI > 0} />
      </div>
      <div className="mt-4 flex items-center justify-between pt-4"
           style={{ borderTop: "1px solid var(--zn-line-soft)" }}>
        <span className="text-[13px] font-semibold" style={{ color: "var(--zn-ink)" }}>Total estimated</span>
        <span className="text-[18px] font-bold tabular-nums" style={{ color: "var(--zn-ink)" }}>
          {fmtGBP(totalLiability)}
        </span>
      </div>
    </div>
  );
}

function KpiSummaryTile({ label, value, sub, valueColor }: {
  label: string; value: string; sub?: string; valueColor?: string;
}) {
  return (
    <div
      className="rounded-[10px] px-4 py-3.5"
      style={{ background: "var(--zn-surface)", border: "1px solid var(--zn-line-soft)" }}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.1em]" style={{ color: "var(--zn-ink-3)" }}>
        {label}
      </p>
      <p className="mt-1.5 text-[20px] font-bold tabular-nums leading-none" style={{ color: valueColor ?? "var(--zn-ink)" }}>
        {value}
      </p>
      {sub && <p className="mt-1 text-[11px]" style={{ color: "var(--zn-ink-3)" }}>{sub}</p>}
    </div>
  );
}

function VatSection({ annualIncome, annualExpenses }: { annualIncome: number; annualExpenses: number }) {
  const VAT_THRESHOLD = 90_000;
  const STANDARD_RATE = 0.20;
  const pct           = Math.min(100, (annualIncome / VAT_THRESHOLD) * 100);
  const overThreshold = annualIncome >= VAT_THRESHOLD;
  const approaching   = !overThreshold && annualIncome >= VAT_THRESHOLD * 0.75;
  const outputVat     = annualIncome * STANDARD_RATE;
  const inputVat      = annualExpenses * STANDARD_RATE;
  const vatPayable    = Math.max(0, outputVat - inputVat);
  const barColor = overThreshold ? "var(--zn-risk)" : approaching ? "var(--zn-warn)" : "var(--zn-safe)";
  const badgeBg  = overThreshold ? "var(--zn-risk-soft)"  : approaching ? "var(--zn-warn-soft)"  : "var(--zn-safe-soft)";
  const badgeFg  = overThreshold ? "var(--zn-risk)"       : approaching ? "var(--zn-warn)"       : "var(--zn-safe)";
  const badge    = overThreshold ? "Above threshold"       : approaching ? "Approaching threshold" : "Below threshold";

  return (
    <div className="zn-card px-5 py-4">
      <div className="flex items-center justify-between gap-3 mb-1">
        <span className="zn-label">VAT position (estimate)</span>
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
              style={{ background: badgeBg, color: badgeFg }}>
          {badge}
        </span>
      </div>
      <p className="text-[12px] mb-4" style={{ color: "var(--zn-ink-3)" }}>
        Rolling 12-month income vs £{VAT_THRESHOLD.toLocaleString("en-GB")} VAT registration threshold
      </p>
      <div>
        <div className="flex justify-between text-[12px] mb-1.5">
          <span style={{ color: "var(--zn-ink-2)" }}>{fmtGBP(annualIncome)}</span>
          <span style={{ color: "var(--zn-ink-3)" }}>£{VAT_THRESHOLD.toLocaleString("en-GB")} limit</span>
        </div>
        <div className="h-[8px] w-full rounded-full overflow-hidden" style={{ background: "var(--zn-line)" }}>
          <div className="h-full rounded-full transition-all duration-700"
               style={{ width: `${Math.max(pct, pct > 0 ? 2 : 0)}%`, background: barColor }} />
        </div>
      </div>
      {annualIncome >= 1_000 && (
        <div className="mt-4 pt-4 flex flex-col gap-2" style={{ borderTop: "1px solid var(--zn-line-soft)" }}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--zn-ink-3)" }}>
            If VAT registered (standard rate 20%)
          </p>
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Output VAT",  value: outputVat,  sub: "On income" },
              { label: "Input VAT",   value: inputVat,   sub: "On expenses" },
              { label: "VAT payable", value: vatPayable, sub: "Net estimate" },
            ].map(({ label, value, sub }) => (
              <div key={label} className="rounded-xl px-3 py-2.5" style={{ background: "var(--zn-surface-2)" }}>
                <p className="text-[10.5px]" style={{ color: "var(--zn-ink-3)" }}>{label}</p>
                <p className="text-[15px] font-bold tabular-nums mt-0.5" style={{ color: "var(--zn-ink)" }}>
                  {fmtGBP(value)}
                </p>
                <p className="text-[10px]" style={{ color: "var(--zn-ink-3)" }}>{sub}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      {overThreshold && (
        <p className="mt-3 text-[12px] rounded-lg px-3 py-2"
           style={{ background: "var(--zn-risk-soft)", color: "var(--zn-risk)" }}>
          Your rolling income exceeds the VAT threshold. If not already registered, contact your accountant.
        </p>
      )}
      <p className="mt-3 text-[11px]" style={{ color: "var(--zn-ink-3)" }}>
        Estimate only. Assumes standard rate VAT. Flat-rate, cash accounting, and partial exemption are not modelled.
      </p>
    </div>
  );
}

function MonthlyTracker({ months, monthlyTarget, taxRatePercent }: {
  months: MonthlyItem[]; monthlyTarget: number; taxRatePercent: number;
}) {
  const maxVal = Math.max(monthlyTarget, ...months.map((m) => (m.income * taxRatePercent) / 100), 1);
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
          <span className="text-[11px] font-medium flex-shrink-0 px-2 py-1 rounded-full"
                style={{ background: "var(--zn-warn-soft)", color: "var(--zn-warn)" }}>
            {fmtGBP(monthlyTarget)}/mo target
          </span>
        )}
      </div>
      <div className="mt-5 space-y-4">
        {months.map((m) => {
          const setAside  = (m.income * taxRatePercent) / 100;
          const metTarget = monthlyTarget > 0 && setAside >= monthlyTarget;
          const barWidth  = monthlyTarget > 0
            ? Math.min(100, (setAside / monthlyTarget) * 100)
            : maxVal > 0 ? (setAside / maxVal) * 100 : 0;
          const barColor  = metTarget ? "var(--zn-safe)" : "var(--zn-risk)";
          const isEmpty   = m.income <= 0;

          return (
            <div key={m.yearMonth}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[12px] font-medium" style={{ color: "var(--zn-ink-2)" }}>{m.label}</span>
                <div className="flex items-center gap-2">
                  {!isEmpty && monthlyTarget > 0 && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full leading-none"
                          style={{
                            background: metTarget ? "var(--zn-safe-soft)" : "var(--zn-risk-soft)",
                            color:      metTarget ? "var(--zn-safe)"      : "var(--zn-risk)",
                          }}>
                      {metTarget ? "On track" : "Short"}
                    </span>
                  )}
                  <span className="text-[12px] tabular-nums font-medium"
                        style={{ color: isEmpty ? "var(--zn-ink-3)" : "var(--zn-ink)" }}>
                    {isEmpty ? "—" : fmtGBP(setAside)}
                  </span>
                </div>
              </div>
              <div className="h-[6px] w-full overflow-hidden rounded-full" style={{ background: "var(--zn-line)" }}>
                {!isEmpty && (
                  <div className="h-full rounded-full"
                       style={{ width: `${Math.max(barWidth, barWidth > 0 ? 2 : 0)}%`, background: barColor }} />
                )}
              </div>
              {m === months[0] && monthlyTarget > 0 && (
                <div className="mt-1 text-[10.5px]"
                     style={{ color: "var(--zn-ink-3)", paddingLeft: `${Math.min(99, (monthlyTarget / maxVal) * 100)}%` }}>
                  target
                </div>
              )}
            </div>
          );
        })}
      </div>
      {months.every((m) => m.income <= 0) && (
        <p className="mt-4 text-[12.5px] text-center" style={{ color: "var(--zn-ink-3)" }}>
          No income recorded for these months yet.
        </p>
      )}
    </div>
  );
}

// ── Main client component ─────────────────────────────────────────────────────

export default function TaxPageClient() {
  const taxRatePercent = 20; // default; Settings page lets users change this in Supabase
  const isGB = true;

  const [annualIncome, setAnnualIncome]     = useState(0);
  const [annualExpenses, setAnnualExpenses] = useState(0);
  const [monthSeries, setMonthSeries]       = useState<MonthlyItem[]>([]);

  function reload() {
    const taxYear = currentUkTaxYear();
    const totals  = totalsForTaxYear(taxYear);
    setAnnualIncome(totals.income);
    setAnnualExpenses(totals.expenses);
    setMonthSeries(buildMonthlyIncomeSeries(12));
  }

  useEffect(() => {
    reload();
    return subscribeToInvoiceChanges(reload);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const taxableProfit   = Math.max(0, annualIncome - annualExpenses);
  const incomeTaxAmount = calcIncomeTax(taxableProfit, taxRatePercent);
  const class4NI        = isGB ? calcClass4NI(taxableProfit) : 0;
  const class2NI        = isGB ? calcClass2NI(taxableProfit) : 0;
  const totalLiability  = incomeTaxAmount + class4NI + class2NI;

  const months      = monthsElapsedInTaxYear();
  const setAside    = (months / 12) * totalLiability;
  const progressPct = totalLiability > 0 ? Math.min(100, (setAside / totalLiability) * 100) : 0;

  const last5Months   = monthSeries.slice(-5);
  const monthlyTarget = totalLiability / 12;

  const saPayment = nextSaPayment();
  const daysLeft  = daysUntilDate(saPayment.isoDate);

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

  const outputVatTop   = annualIncome  * 0.20;
  const inputVatTop    = annualExpenses * 0.20;
  const vatPayableTop  = Math.max(0, outputVatTop - inputVatTop);
  const marginPctTop   = annualIncome > 0 ? Math.round((taxableProfit / annualIncome) * 100) : 0;
  const hasData        = annualIncome > 0 || annualExpenses > 0;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[24px] font-semibold tracking-[-0.02em]" style={{ color: "var(--zn-ink)" }}>
            Tax
          </h1>
          <p className="mt-0.5 text-[13.5px]" style={{ color: "var(--zn-ink-3)" }}>
            What you&rsquo;ll owe and how much to set aside. Estimate only — file via HMRC.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-[8px] px-3.5 py-2 text-[13px] font-medium border transition-colors"
            style={{ borderColor: "var(--zn-line-soft)", background: "var(--zn-surface)", color: "var(--zn-ink-2)" }}
            onClick={() => window.print()}
          >
            Download PDF
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-semibold transition-colors"
            style={{ background: "var(--zn-ink)", color: "var(--zn-surface)" }}
            onClick={() => {
              const subject = encodeURIComponent("Tax estimate summary — Zentra Collect");
              const body = encodeURIComponent(
                `Hi,\n\nPlease find my tax estimate summary below:\n\nAnnual income: ${annualIncome > 0 ? "£" + Math.round(annualIncome).toLocaleString("en-GB") : "—"}\nBusiness expenses: ${annualExpenses > 0 ? "£" + Math.round(annualExpenses).toLocaleString("en-GB") : "—"}\nEstimated tax owed: £${Math.round(totalLiability).toLocaleString("en-GB")}\n\nGenerated by Zentra Collect. Figures are estimates only — not financial advice.\n\nBest regards`
              );
              window.location.href = `mailto:?subject=${subject}&body=${body}`;
            }}
          >
            Send to accountant
          </button>
        </div>
      </div>

      {/* 6-KPI summary strip — only shown when data exists */}
      {hasData && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <KpiSummaryTile
            label="Total income"
            value={fmtGBP(annualIncome)}
            sub="Invoiced this tax year"
            valueColor="var(--zn-safe)"
          />
          <KpiSummaryTile
            label="Business expenses"
            value={fmtGBP(annualExpenses)}
            sub="Allowable expenses"
          />
          <KpiSummaryTile
            label="Net profit"
            value={fmtGBP(taxableProfit)}
            sub={`${marginPctTop}% margin`}
            valueColor={taxableProfit >= 0 ? "var(--zn-safe)" : "var(--zn-risk)"}
          />
          <KpiSummaryTile
            label="Est. tax owed"
            value={fmtGBP(totalLiability)}
            sub={`@ ${taxRatePercent}% basic rate`}
            valueColor="var(--zn-warn)"
          />
          <KpiSummaryTile
            label="VAT reclaimable"
            value={fmtGBP(inputVatTop)}
            sub="Input VAT on expenses"
          />
          <KpiSummaryTile
            label="VAT to pay HMRC"
            value={fmtGBP(vatPayableTop)}
            sub="Net of reclaimable"
            valueColor={vatPayableTop > 0 ? "var(--zn-risk)" : undefined}
          />
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Link href="/tax-estimate"
              className="group rounded-xl p-4 transition-colors hover:bg-[var(--zn-surface-2)]"
              style={{ background: "var(--zn-surface)", border: "1px solid var(--zn-line-soft)" }}>
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--zn-ink-3)" }}>
            Tax estimate
          </p>
          <p className="mt-1 text-[14px] font-semibold" style={{ color: "var(--zn-ink)" }}>
            What you&rsquo;ll owe this tax year →
          </p>
          <p className="mt-1 text-[12.5px] leading-5" style={{ color: "var(--zn-ink-3)" }}>
            Income Tax + Class 4 NIC on your invoiced income minus tracked expenses.
          </p>
        </Link>
        <div className="rounded-xl p-4"
             style={{ background: "var(--zn-surface-2)", border: "1px solid var(--zn-line-soft)" }}>
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--zn-ink-3)" }}>
            Tax reserve
          </p>
          <p className="mt-1 text-[14px] font-semibold" style={{ color: "var(--zn-ink)" }}>
            How much to set aside each month ↓
          </p>
          <p className="mt-1 text-[12.5px] leading-5" style={{ color: "var(--zn-ink-3)" }}>
            Cash reserve tracker, payment-on-account dates, savings progress.
          </p>
        </div>
      </div>

      <NextPaymentBanner
        friendly={saPayment.friendly}
        description={saPayment.description}
        daysLeft={daysLeft}
      />

      <TaxHeroCard
        setAside={setAside}
        totalLiability={totalLiability}
        progressPct={progressPct}
        months={months}
      />

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

      <MonthlyTracker
        months={last5Months}
        monthlyTarget={monthlyTarget}
        taxRatePercent={taxRatePercent}
      />

      <VatSection annualIncome={annualIncome} annualExpenses={annualExpenses} />

      <TaxCalcDetails {...calcProps} />

      <div className="flex justify-center">
        <Link href="/tax/summary"
              className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[12.5px] font-medium transition-colors hover:bg-[#f3ecd8] dark:hover:bg-[#2d2820]"
              style={{ borderColor: "var(--zn-line)", color: "var(--zn-ink-2)" }}>
          <FileText className="size-3.5" />
          View year-end summary
        </Link>
      </div>

      <p className="text-[11.5px] text-center pb-2" style={{ color: "var(--zn-ink-3)" }}>
        Figures are estimates only and do not constitute tax advice.
        Tax rates shown are estimates for the current UK tax year.{" "}
        <a href="/settings" className="underline hover:no-underline" style={{ color: "var(--zn-ink-2)" }}>
          Update your tax rate in Settings.
        </a>
      </p>
    </div>
  );
}
