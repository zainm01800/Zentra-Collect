"use client";

/**
 * financial-header.tsx
 *
 * Client wrapper for the financial overview section.
 *
 * Renders (top-to-bottom):
 *   1. CashFlowForecast + MonthlySnapshot   (2-col on md+)
 *   2. Quick-action button row
 *   3. AddIncomeForm / AddInvoiceForm / AddBillForm sheets (portalled)
 *
 * Bank balance + safe-to-spend were removed in favour of letting users
 * just upload a bank statement on /banking when they want that view.
 */

import { useEffect, useState } from "react";
import {
  FilePlus,
  Receipt,
  TrendingUp,
} from "lucide-react";

import { CashFlowForecast } from "@/components/cash-flow-forecast";
import { MonthlySnapshot }  from "@/components/monthly-snapshot";
import { AddIncomeForm }    from "@/components/add-income-form";
import { AddInvoiceForm }   from "@/components/add-invoice-form";
import { AddBillForm }      from "@/components/add-bill-form";

import type { FinancialSettings } from "@/actions/financial-settings";
import type { Invoice }            from "@/types/zentra";

// ── Types ─────────────────────────────────────────────────────────────────────

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
  financialSettings: _financialSettings,
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

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <section className="mb-8 space-y-4">
      {/* ── Cash-flow forecast + monthly snapshot ─────────────── */}
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
