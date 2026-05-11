"use client";

/**
 * financial-header.tsx
 *
 * Client wrapper for the financial overview section that sits above the AR
 * collections dashboard.  All server-computed data is received via props;
 * this component owns only the interactive state (sheet open/close, the ref
 * used to focus BankBalanceInput from the quick-action bar).
 *
 * Renders (top-to-bottom):
 *   1. BankBalanceInput + SafeToSpendCard  (2-col on md+)
 *   2. CashFlowForecast + MonthlySnapshot  (2-col on md+)
 *   3. Quick-action button row
 *   4. AddIncomeForm / AddInvoiceForm / AddBillForm sheets (portalled, invisible
 *      until their trigger button is pressed)
 */

import { useRef, useState } from "react";
import {
  FilePlus,
  Receipt,
  TrendingUp,
  Wallet,
} from "lucide-react";

import { BankBalanceInput, type BankBalanceInputHandle } from "@/components/bank-balance-input";
import { SafeToSpendCard }  from "@/components/safe-to-spend-card";
import { CashFlowForecast } from "@/components/cash-flow-forecast";
import { MonthlySnapshot }  from "@/components/monthly-snapshot";
import { AddIncomeForm }    from "@/components/add-income-form";
import { AddInvoiceForm }   from "@/components/add-invoice-form";
import { AddBillForm }      from "@/components/add-bill-form";

import type { FinancialSettings }  from "@/actions/financial-settings";
import type { SafeToSpendResult }  from "@/lib/finance/safe-to-spend";
import type { Invoice }            from "@/types/zentra";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FinancialHeaderProps {
  /** Full financial settings row, or null for first-time users. */
  financialSettings: FinancialSettings | null;
  /**
   * Pre-calculated safe-to-spend result. Undefined when no bank balance has
   * been set yet — SafeToSpendCard returns null in that case, keeping the
   * layout clean until the user sets up their balance.
   */
  safeToSpendResult?: SafeToSpendResult;
  /** Full invoice list — passed straight through to CashFlowForecast. */
  invoices: Invoice[];
  /** Monthly income totals from getMonthlyIncomeSummary(). */
  monthlyIncome: {
    totalThisMonth: number;
    totalLastMonth: number;
    invoiceIncome:  number;
    manualIncome:   number;
  };
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
  safeToSpendResult,
  invoices,
  monthlyIncome,
}: FinancialHeaderProps) {
  // ── Sheet open states ────────────────────────────────────────────────────

  const [addIncomeOpen,  setAddIncomeOpen]  = useState(false);
  const [addInvoiceOpen, setAddInvoiceOpen] = useState(false);
  const [addBillOpen,    setAddBillOpen]    = useState(false);

  // ── BankBalanceInput handle ──────────────────────────────────────────────

  const bankBalanceRef = useRef<BankBalanceInputHandle>(null);

  // ── Derived: treat balance as unset unless it was explicitly saved ────────
  //
  // The DB row defaults bank_balance to 0, so we distinguish "never set" from
  // "set to zero" by checking whether bank_balance_updated_at is populated.
  // BankBalanceInput receives null when balance has never been manually saved,
  // showing the "Add your bank balance to unlock Safe to Spend" prompt instead.

  const initialBalance: number | null = financialSettings?.bankBalanceUpdatedAt
    ? (financialSettings.bankBalance ?? null)
    : null;

  const lastUpdated: string | null =
    financialSettings?.bankBalanceUpdatedAt ?? null;

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <section className="mb-8 space-y-4">
      {/* ── Row 1: bank balance + safe to spend ─────────────────────── */}
      {/*
        BankBalanceInput is compact; SafeToSpendCard is wide — give the
        hero card 2/3 of the horizontal space on desktop.
      */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(260px,1fr)_2fr]">
        <BankBalanceInput
          ref={bankBalanceRef}
          initialBalance={initialBalance}
          lastUpdated={lastUpdated}
        />
        <SafeToSpendCard result={safeToSpendResult} />
      </div>

      {/* ── Row 2: cash-flow forecast + monthly snapshot ─────────────── */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <CashFlowForecast invoices={invoices} manualIncome={[]} />
        <MonthlySnapshot {...monthlyIncome} />
      </div>

      {/* ── Quick actions ────────────────────────────────────────────── */}
      {/*
        The row lives at the bottom of the financial section so the eye
        travels: position → health → forecast → act.  "Add invoice" is the
        primary action for this AR-focused app, so it carries the accent colour.
      */}
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
        <QuickActionButton
          icon={Wallet}
          label="Update balance"
          onClick={() => bankBalanceRef.current?.enterEdit()}
        />
      </div>

      {/* ── Sheets (portalled, rendered once, toggled via open prop) ─── */}
      <AddIncomeForm  open={addIncomeOpen}  onOpenChange={setAddIncomeOpen}  />
      <AddInvoiceForm open={addInvoiceOpen} onOpenChange={setAddInvoiceOpen} />
      <AddBillForm    open={addBillOpen}    onOpenChange={setAddBillOpen}    />
    </section>
  );
}
