"use client";

/**
 * financial-header.tsx
 *
 * Client wrapper for the financial overview section. Now derives the bank
 * balance from uploaded bank statements (localStorage `zentra.bankStatement.v1`)
 * instead of asking the user to type it in manually. Safe-to-spend is
 * computed client-side whenever a statement is available.
 *
 * Renders (top-to-bottom):
 *   1. DerivedBalanceCard + SafeToSpendCard  (2-col on md+)
 *   2. CashFlowForecast + MonthlySnapshot   (2-col on md+)
 *   3. Quick-action button row
 *   4. AddIncomeForm / AddInvoiceForm / AddBillForm sheets (portalled)
 */

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  FilePlus,
  Landmark,
  Receipt,
  TrendingUp,
  Upload,
} from "lucide-react";

import { SafeToSpendCard }  from "@/components/safe-to-spend-card";
import { CashFlowForecast } from "@/components/cash-flow-forecast";
import { MonthlySnapshot }  from "@/components/monthly-snapshot";
import { AddIncomeForm }    from "@/components/add-income-form";
import { AddInvoiceForm }   from "@/components/add-invoice-form";
import { AddBillForm }      from "@/components/add-bill-form";

import {
  calculateSafeToSpend,
  type SafeToSpendResult,
} from "@/lib/finance/safe-to-spend";
import { formatCurrency } from "@/lib/formatters";
import type { FinancialSettings } from "@/actions/financial-settings";
import type { Invoice }            from "@/types/zentra";

const BANK_STATEMENT_KEY = "zentra.bankStatement.v1";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ParsedTransaction {
  date:        string;
  description: string;
  amount:      number;
}

export interface FinancialHeaderProps {
  /** Full financial settings row, or null for first-time users. */
  financialSettings: FinancialSettings | null;
  /** Full invoice list — passed straight through to CashFlowForecast. */
  invoices: Invoice[];
  /** Monthly income totals from getMonthlyIncomeSummary(). */
  monthlyIncome: {
    totalThisMonth: number;
    totalLastMonth: number;
    invoiceIncome:  number;
    manualIncome:   number;
  };
  /**
   * When true, the Add Invoice sheet opens automatically on mount.
   * Used when the user arrives from /onboarding via the "add manually"
   * path (?new_invoice=1), so they can add their first invoice without
   * a second click.
   */
  autoOpenInvoiceForm?: boolean;
}

// ── Derived bank balance — read from localStorage bank statement ──────────────

interface DerivedBalance {
  /** Net cash position from the last uploaded statement. null when no statement. */
  balance:          number | null;
  /** Date of the most recent transaction in the statement. */
  lastTransactionDate: string | null;
  /** Number of transactions in the statement. */
  transactionCount: number;
}

function readDerivedBalance(): DerivedBalance {
  if (typeof window === "undefined") {
    return { balance: null, lastTransactionDate: null, transactionCount: 0 };
  }
  const raw = window.localStorage.getItem(BANK_STATEMENT_KEY);
  if (!raw) {
    return { balance: null, lastTransactionDate: null, transactionCount: 0 };
  }
  try {
    const txns = JSON.parse(raw) as ParsedTransaction[];
    if (!Array.isArray(txns) || txns.length === 0) {
      return { balance: null, lastTransactionDate: null, transactionCount: 0 };
    }
    const balance = txns.reduce((sum, t) => sum + (t.amount || 0), 0);
    const dates = txns
      .map((t) => t.date)
      .filter(Boolean)
      .sort();
    const lastTransactionDate = dates.length ? dates[dates.length - 1] : null;
    return { balance, lastTransactionDate, transactionCount: txns.length };
  } catch {
    return { balance: null, lastTransactionDate: null, transactionCount: 0 };
  }
}

// ── Quick-action button ───────────────────────────────────────────────────────

function QuickActionButton({
  icon: Icon,
  label,
  onClick,
  accent = false,
}: {
  icon:    React.ComponentType<{ className?: string }>;
  label:   string;
  onClick: () => void;
  accent?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-medium leading-none transition-colors ${
        accent ? "zn-pill-accent" : "zn-pill-ghost"
      }`}
    >
      <Icon className="size-3.5 shrink-0" />
      {label}
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function FinancialHeader({
  financialSettings,
  invoices,
  monthlyIncome,
  autoOpenInvoiceForm = false,
}: FinancialHeaderProps) {
  // ── Sheet open states ────────────────────────────────────────────────────

  const [addIncomeOpen,  setAddIncomeOpen]  = useState(false);
  const [addInvoiceOpen, setAddInvoiceOpen] = useState(false);
  const [addBillOpen,    setAddBillOpen]    = useState(false);

  // Open the invoice form on mount when the user arrives from onboarding
  // via the "add manually" path (?new_invoice=1).
  useEffect(() => {
    if (autoOpenInvoiceForm) {
      setAddInvoiceOpen(true);
    }
  }, [autoOpenInvoiceForm]);

  // ── Derived balance from uploaded bank statement (client-side) ───────────
  //
  // Bank balance is no longer manually entered — it's derived from the most
  // recent bank statement upload (`zentra.bankStatement.v1` in localStorage).
  // We re-read it on mount so the page picks up new statements without a refresh.

  const [derived, setDerived] = useState<DerivedBalance>({
    balance: null,
    lastTransactionDate: null,
    transactionCount: 0,
  });

  useEffect(() => {
    setDerived(readDerivedBalance());
    // Re-read when localStorage changes (e.g. user uploads a statement in another tab)
    const handler = (e: StorageEvent) => {
      if (e.key === BANK_STATEMENT_KEY) setDerived(readDerivedBalance());
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  // ── Compute safe-to-spend client-side once we have a balance ─────────────

  const safeToSpendResult: SafeToSpendResult | undefined = useMemo(() => {
    if (derived.balance === null) return undefined;
    return calculateSafeToSpend({
      bankBalance:    derived.balance,
      invoices,
      taxRatePercent: financialSettings?.taxRatePercent ?? 20,
      manualBills:    [],
    });
  }, [derived.balance, invoices, financialSettings?.taxRatePercent]);

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <section className="mb-8 space-y-4">
      {/* ── Row 1: derived balance + safe to spend ─────────────────── */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(260px,1fr)_2fr]">
        <DerivedBalanceCard derived={derived} />
        <SafeToSpendCard result={safeToSpendResult} />
      </div>

      {/* ── Row 2: cash-flow forecast + monthly snapshot ─────────────── */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <CashFlowForecast invoices={invoices} manualIncome={[]} />
        <MonthlySnapshot {...monthlyIncome} />
      </div>

      {/* ── Quick actions ────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <QuickActionButton
          icon={TrendingUp}
          label="Add income"
          onClick={() => setAddIncomeOpen(true)}
        />
        <QuickActionButton
          icon={FilePlus}
          label="Add invoice"
          onClick={() => setAddInvoiceOpen(true)}
          accent
        />
        <QuickActionButton
          icon={Receipt}
          label="Add bill"
          onClick={() => setAddBillOpen(true)}
        />
      </div>

      {/* ── Sheets (portalled, rendered once, toggled via open prop) ─── */}
      <AddIncomeForm  open={addIncomeOpen}  onOpenChange={setAddIncomeOpen}  />
      <AddInvoiceForm open={addInvoiceOpen} onOpenChange={setAddInvoiceOpen} />
      <AddBillForm    open={addBillOpen}    onOpenChange={setAddBillOpen}    />
    </section>
  );
}

// ── DerivedBalanceCard — auto-computed from bank statement uploads ───────────

function DerivedBalanceCard({ derived }: { derived: DerivedBalance }) {
  const hasStatement = derived.balance !== null;

  return (
    <div
      className="zn-card flex flex-col gap-2 p-5"
      style={{ background: "var(--zn-surface)", border: "1px solid var(--zn-line-soft)" }}
    >
      <div className="flex items-center gap-2">
        <div
          className="size-8 rounded-lg flex items-center justify-center"
          style={{ background: "var(--zn-bg-2)", color: "var(--zn-ink-2)" }}
        >
          <Landmark className="size-4" />
        </div>
        <div className="zn-label !p-0">Bank position</div>
      </div>

      {hasStatement ? (
        <>
          <div
            className="text-[26px] font-semibold tabular-nums leading-tight"
            style={{ color: derived.balance! >= 0 ? "var(--zn-ink)" : "var(--zn-risk)" }}
          >
            {formatCurrency(derived.balance!)}
          </div>
          <p className="text-[11.5px] leading-4" style={{ color: "var(--zn-ink-3)" }}>
            Net from {derived.transactionCount} transaction{derived.transactionCount === 1 ? "" : "s"}
            {derived.lastTransactionDate
              ? ` · last dated ${new Date(derived.lastTransactionDate).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}`
              : ""}
          </p>
          <Link
            href="/banking"
            className="inline-flex items-center gap-1 text-[11.5px] font-medium hover:underline mt-1 w-fit"
            style={{ color: "var(--zn-ink-3)" }}
          >
            Update from latest statement
            <ArrowRight className="size-3" />
          </Link>
        </>
      ) : (
        <>
          <div
            className="text-[15px] font-medium leading-tight"
            style={{ color: "var(--zn-ink-2)" }}
          >
            No statement uploaded
          </div>
          <p className="text-[12px] leading-5" style={{ color: "var(--zn-ink-3)" }}>
            Upload a CSV or Excel statement from your bank and Zentra will
            calculate your safe-to-spend automatically — no manual entry.
          </p>
          <Link
            href="/banking"
            className="inline-flex items-center gap-1.5 text-[12px] font-semibold rounded-full px-3 py-1.5 mt-1 w-fit"
            style={{ background: "var(--zn-ink)", color: "var(--zn-bg)" }}
          >
            <Upload className="size-3" />
            Upload statement
          </Link>
        </>
      )}
    </div>
  );
}
