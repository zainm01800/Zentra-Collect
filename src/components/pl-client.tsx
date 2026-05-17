"use client";

/**
 * Profit & Loss client — reads income from imported invoices and
 * allowable expenses from localStorage, calculates net profit for
 * a chosen UK tax year. Pure client-side; no server round-trip needed.
 */

import { useEffect, useMemo, useState } from "react";
import { TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp, Download } from "lucide-react";
import { currentUkTaxYear, ukTaxYearRange } from "@/lib/tax/uk-self-employed";
import { totalsForTaxYear } from "@/lib/tax/summary";
import { importedInvoicesStorageKey } from "@/lib/import/zentra-import";
import { readLocalAccount } from "@/lib/demo-auth";
import { readActiveClientId, clientInvoicesKey } from "@/lib/bookkeeper-clients";
import { subscribeToInvoiceChanges } from "@/lib/invoice-store";
import type { Invoice } from "@/types/zentra";

// ── Helpers ───────────────────────────────────────────────────────────────────

const GBP = (n: number) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);

const PCT = (n: number) =>
  new Intl.NumberFormat("en-GB", {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(n);

const BOOKKEEPER_PLANS = ["bookkeeper_starter", "bookkeeper_pro"];

interface ExpenseRow {
  category:    string;
  allowable:   number;
  notAllowable: number;
  review:      number;
}

function readExpensesByCategory(startMs: number, endMs: number): ExpenseRow[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem("zentra.expenses.v1");
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Array<{
      date: string; amount: number; category?: string; allowability?: string;
    }>;
    if (!Array.isArray(parsed)) return [];

    const byCategory: Record<string, ExpenseRow> = {};
    for (const e of parsed) {
      const d = new Date(e.date).getTime();
      if (!Number.isFinite(d) || d < startMs || d > endMs) continue;
      const cat = e.category || "Other";
      if (!byCategory[cat]) byCategory[cat] = { category: cat, allowable: 0, notAllowable: 0, review: 0 };
      const al = e.allowability ?? "allowable";
      if (al === "not-allowable") byCategory[cat].notAllowable += e.amount;
      else if (al === "review")   byCategory[cat].review       += e.amount;
      else                        byCategory[cat].allowable    += e.amount;
    }
    return Object.values(byCategory).sort((a, b) => b.allowable - a.allowable);
  } catch {
    return [];
  }
}

function readInvoiceBreakdown(startMs: number, endMs: number) {
  if (typeof window === "undefined") return { paid: 0, outstanding: 0, count: 0 };
  const account = readLocalAccount();
  let key = importedInvoicesStorageKey;
  if (account && BOOKKEEPER_PLANS.includes(account.planId)) {
    const clientId = readActiveClientId();
    if (clientId && clientId !== "all") key = clientInvoicesKey(clientId);
  }
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return { paid: 0, outstanding: 0, count: 0 };
    const invoices = JSON.parse(raw) as Invoice[];
    if (!Array.isArray(invoices)) return { paid: 0, outstanding: 0, count: 0 };

    let paid = 0, outstanding = 0, count = 0;
    for (const inv of invoices) {
      const d = new Date(inv.invoiceDate).getTime();
      if (!Number.isFinite(d) || d < startMs || d > endMs) continue;
      count++;
      if (inv.status === "paid") paid += inv.amount;
      else outstanding += inv.amount;
    }
    return { paid, outstanding, count };
  } catch {
    return { paid: 0, outstanding: 0, count: 0 };
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, positive }: {
  label: string; value: string; sub?: string; positive?: boolean;
}) {
  return (
    <div
      className="rounded-2xl px-5 py-4"
      style={{ background: "var(--zn-surface)", border: "1px solid var(--zn-line-soft)" }}
    >
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--zn-ink-3)" }}>
        {label}
      </p>
      <p
        className="mt-2 text-[32px] font-bold leading-none tabular-nums"
        style={{ color: positive === undefined ? "var(--zn-ink)" : positive ? "var(--zn-safe)" : "var(--zn-risk)" }}
      >
        {value}
      </p>
      {sub && (
        <p className="mt-1.5 text-[11.5px]" style={{ color: "var(--zn-ink-3)" }}>{sub}</p>
      )}
    </div>
  );
}

function SectionHeader({ label, amount, color }: { label: string; amount: number; color: string }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b" style={{ borderColor: "var(--zn-line)" }}>
      <span className="text-[13px] font-semibold" style={{ color: "var(--zn-ink)" }}>{label}</span>
      <span className="text-[15px] font-bold tabular-nums" style={{ color }}>{GBP(amount)}</span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function PLClient() {
  const currentYear = currentUkTaxYear();
  const prevYear    = (() => {
    const [start] = currentYear.split("/");
    const y = parseInt(start, 10) - 1;
    return `${y}/${String(y + 1).slice(-2)}`;
  })();

  const [taxYear, setTaxYear] = useState(currentYear);
  const [hydrated, setHydrated]  = useState(false);
  const [showExpenseDetail, setShowExpenseDetail] = useState(false);
  const [revision, setRevision] = useState(0);

  useEffect(() => { setHydrated(true); }, []);
  useEffect(() => subscribeToInvoiceChanges(() => setRevision((r) => r + 1)), []);

  const { startMs, endMs } = useMemo(() => {
    const { startIso, endIso } = ukTaxYearRange(taxYear);
    return {
      startMs: new Date(startIso).getTime(),
      endMs:   new Date(endIso).getTime() + 86_399_000,
    };
  }, [taxYear]);

  const totals       = useMemo(() => hydrated ? totalsForTaxYear(taxYear) : null, [hydrated, taxYear, revision]);
  const invoiceBrk   = useMemo(() => hydrated ? readInvoiceBreakdown(startMs, endMs) : null, [hydrated, startMs, endMs, revision]);
  const expenseRows  = useMemo(() => hydrated ? readExpensesByCategory(startMs, endMs) : [], [hydrated, startMs, endMs, revision]);

  const totalAllowable    = expenseRows.reduce((s, r) => s + r.allowable, 0);
  const totalNotAllowable = expenseRows.reduce((s, r) => s + r.notAllowable, 0);
  const totalReview       = expenseRows.reduce((s, r) => s + r.review, 0);
  const grossIncome       = totals ? totals.income : 0;
  const netProfit         = grossIncome - totalAllowable;
  const marginPct         = grossIncome > 0 ? netProfit / grossIncome : 0;

  function exportCSV() {
    const rows: string[][] = [
      ["Category", "Allowable (£)", "Not allowable (£)", "Review (£)"],
      ...expenseRows.map((r) => [r.category, String(r.allowable.toFixed(2)), String(r.notAllowable.toFixed(2)), String(r.review.toFixed(2))]),
      [],
      ["Income", String(grossIncome.toFixed(2))],
      ["Allowable expenses", String(totalAllowable.toFixed(2))],
      ["Net profit", String(netProfit.toFixed(2))],
    ];
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = `pl-${taxYear.replace("/", "-")}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  const empty = !totals || (totals.income === 0 && totals.expenseCount === 0);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 flex flex-col gap-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[26px] font-bold tracking-tight" style={{ color: "var(--zn-ink)" }}>
            Profit &amp; Loss
          </h1>
          <p className="mt-1 text-[13px]" style={{ color: "var(--zn-ink-3)" }}>
            Income vs allowable expenses · UK tax year
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Tax year selector */}
          <select
            value={taxYear}
            onChange={(e) => setTaxYear(e.target.value)}
            className="text-[13px] rounded-lg px-3 py-2 outline-none cursor-pointer"
            style={{
              background: "var(--zn-surface)",
              border: "1px solid var(--zn-line)",
              color: "var(--zn-ink)",
            }}
          >
            <option value={currentYear}>{currentYear} (current)</option>
            <option value={prevYear}>{prevYear}</option>
          </select>
          <button
            type="button"
            onClick={exportCSV}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-medium transition-colors hover:bg-black/5 dark:hover:bg-white/5"
            style={{ border: "1px solid var(--zn-line)", color: "var(--zn-ink-2)" }}
          >
            <Download className="size-3.5" />
            Export CSV
          </button>
        </div>
      </div>

      {empty ? (
        <div
          className="rounded-2xl px-6 py-12 text-center"
          style={{ background: "var(--zn-surface)", border: "1px solid var(--zn-line-soft)" }}
        >
          <p className="text-[15px] font-medium" style={{ color: "var(--zn-ink)" }}>No data for {taxYear}</p>
          <p className="mt-1.5 text-[13px]" style={{ color: "var(--zn-ink-3)" }}>
            Import invoices and add expenses to see your P&amp;L.
          </p>
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Income" value={GBP(grossIncome)} sub={`${invoiceBrk?.count ?? 0} invoices`} />
            <StatCard label="Allowable expenses" value={GBP(totalAllowable)} sub={`${expenseRows.filter(r => r.allowable > 0).length} categories`} />
            <StatCard
              label="Net profit"
              value={GBP(netProfit)}
              sub={`${PCT(marginPct)} margin`}
              positive={netProfit >= 0}
            />
            <StatCard
              label="Not allowable"
              value={GBP(totalNotAllowable + totalReview)}
              sub="Excluded from tax calc"
            />
          </div>

          {/* P&L statement */}
          <div
            className="rounded-2xl px-5 py-5 flex flex-col gap-0"
            style={{ background: "var(--zn-surface)", border: "1px solid var(--zn-line-soft)" }}
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] mb-3" style={{ color: "var(--zn-ink-3)" }}>
              Statement · {taxYear}
            </p>

            {/* Income */}
            <SectionHeader label="Income" amount={grossIncome} color="var(--zn-safe)" />
            <div className="py-2 flex flex-col gap-1.5 mb-2">
              <div className="flex justify-between text-[13px]">
                <span style={{ color: "var(--zn-ink-2)" }}>Invoiced (paid)</span>
                <span className="tabular-nums" style={{ color: "var(--zn-ink)" }}>{GBP(invoiceBrk?.paid ?? 0)}</span>
              </div>
              {(invoiceBrk?.outstanding ?? 0) > 0 && (
                <div className="flex justify-between text-[13px]">
                  <span style={{ color: "var(--zn-ink-3)" }}>Invoiced (outstanding)</span>
                  <span className="tabular-nums" style={{ color: "var(--zn-ink-3)" }}>{GBP(invoiceBrk?.outstanding ?? 0)}</span>
                </div>
              )}
            </div>

            {/* Allowable expenses */}
            <SectionHeader label="Allowable expenses" amount={-totalAllowable} color="var(--zn-risk)" />
            <div className="py-2 flex flex-col gap-1.5 mb-2">
              {expenseRows.filter((r) => r.allowable > 0).length === 0 ? (
                <p className="text-[13px]" style={{ color: "var(--zn-ink-3)" }}>No allowable expenses recorded.</p>
              ) : (
                <>
                  {(showExpenseDetail ? expenseRows.filter(r => r.allowable > 0) : expenseRows.filter(r => r.allowable > 0).slice(0, 4)).map((row) => (
                    <div key={row.category} className="flex justify-between text-[13px]">
                      <span style={{ color: "var(--zn-ink-2)" }}>{row.category}</span>
                      <span className="tabular-nums" style={{ color: "var(--zn-ink)" }}>{GBP(row.allowable)}</span>
                    </div>
                  ))}
                  {expenseRows.filter(r => r.allowable > 0).length > 4 && (
                    <button
                      type="button"
                      onClick={() => setShowExpenseDetail((v) => !v)}
                      className="flex items-center gap-1 text-[12px] mt-1"
                      style={{ color: "var(--zn-ink-3)" }}
                    >
                      {showExpenseDetail ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
                      {showExpenseDetail ? "Show less" : `Show all ${expenseRows.filter(r => r.allowable > 0).length} categories`}
                    </button>
                  )}
                </>
              )}
            </div>

            {/* Net profit */}
            <div
              className="flex items-center justify-between rounded-xl px-4 py-3.5 mt-1"
              style={{ background: netProfit >= 0 ? "var(--zn-safe-soft)" : "var(--zn-risk-soft)" }}
            >
              <div className="flex items-center gap-2">
                {netProfit > 0
                  ? <TrendingUp className="size-4" style={{ color: "var(--zn-safe)" }} />
                  : netProfit < 0
                    ? <TrendingDown className="size-4" style={{ color: "var(--zn-risk)" }} />
                    : <Minus className="size-4" style={{ color: "var(--zn-ink-3)" }} />
                }
                <span className="text-[13px] font-semibold" style={{ color: netProfit >= 0 ? "var(--zn-safe)" : "var(--zn-risk)" }}>
                  Net profit
                </span>
              </div>
              <span
                className="text-[18px] font-bold tabular-nums"
                style={{ color: netProfit >= 0 ? "var(--zn-safe)" : "var(--zn-risk)" }}
              >
                {GBP(netProfit)}
              </span>
            </div>

            {/* Non-allowable note */}
            {totalNotAllowable + totalReview > 0 && (
              <p className="mt-3 text-[11.5px] px-1" style={{ color: "var(--zn-ink-3)" }}>
                {GBP(totalNotAllowable)} not-allowable + {GBP(totalReview)} under review excluded from expense total.
                &nbsp;<a href="/expenses" className="underline underline-offset-2">Review in Expenses →</a>
              </p>
            )}
          </div>

          {/* Disclaimer */}
          <p className="text-[11px] text-center" style={{ color: "var(--zn-ink-3)" }}>
            Estimate only. Income uses accrual basis (invoice date). Consult your accountant for filing purposes.
          </p>
        </>
      )}
    </div>
  );
}
