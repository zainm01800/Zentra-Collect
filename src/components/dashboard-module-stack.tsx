"use client";

/**
 * DashboardModuleStack
 *
 * Composes module-specific snapshot cards into a single visual stack on the
 * dashboard. The user's enabled modules drive which snapshots appear, so a
 * tax-focused user lands and immediately sees their tax info without having
 * to navigate elsewhere.
 *
 * Order on screen:
 *   1. Cash flow (financial position section)
 *   2. Expenses
 *   3. Tax & MTD
 *   4. Reports
 *
 * Collections lives separately in <ZentraDashboard /> and is always rendered.
 */

import { useEffect, useState } from "react";

import { FinancialHeader }    from "@/components/financial-header";
import { ExpensesSnapshot }   from "@/components/snapshots/expenses-snapshot";
import { TaxSnapshot }        from "@/components/snapshots/tax-snapshot";
import { ReportsSnapshot }    from "@/components/snapshots/reports-snapshot";
import { readWorkspacePrefs, type WorkspacePrefs } from "@/lib/prefs";

import type { FinancialSettings }    from "@/actions/financial-settings";
import type { SafeToSpendResult }    from "@/lib/finance/safe-to-spend";
import type { Invoice }              from "@/types/zentra";
import type {
  TaxSnapshotData,
  MtdSnapshotData,
  ExpensesSnapshotData,
} from "@/lib/snapshots";

interface DashboardModuleStackProps {
  // Cash flow data
  financialSettings: FinancialSettings | null;
  safeToSpendResult?: SafeToSpendResult;
  invoices: Invoice[];
  monthlyIncome: {
    totalThisMonth: number;
    totalLastMonth: number;
    invoiceIncome:  number;
    manualIncome:   number;
  };
  autoOpenInvoiceForm?: boolean;

  // Module snapshot data
  taxData:      TaxSnapshotData;
  mtdData:      MtdSnapshotData;
  expensesData: ExpensesSnapshotData;
  ytdIncome:    number;
  ytdExpenses:  number;
}

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="mt-10 mb-4 flex items-center gap-4">
      <div className="flex-1 h-px" style={{ background: "var(--zn-line-soft)" }} />
      <span
        className="text-[10.5px] font-semibold uppercase tracking-[0.12em] flex-shrink-0"
        style={{ color: "var(--zn-ink-3)" }}
      >
        {label}
      </span>
      <div className="flex-1 h-px" style={{ background: "var(--zn-line-soft)" }} />
    </div>
  );
}

export function DashboardModuleStack(props: DashboardModuleStackProps) {
  const [prefs, setPrefs] = useState<WorkspacePrefs | null>(null);

  useEffect(() => {
    setPrefs(readWorkspacePrefs());
    function onPrefs(e: Event) {
      setPrefs((e as CustomEvent<WorkspacePrefs>).detail);
    }
    window.addEventListener("zentra:workspaceprefs", onPrefs);
    return () => window.removeEventListener("zentra:workspaceprefs", onPrefs);
  }, []);

  // Defer rendering until prefs are loaded — avoids flashing modules the user has disabled.
  if (!prefs) return null;

  const showCashflow = prefs.modules.cashflow && prefs.widgets.financialPanel;
  const showExpenses = prefs.modules.expenses;
  const showTax      = prefs.modules.tax;
  const showReports  = prefs.modules.reports;

  const anyEnabled = showCashflow || showExpenses || showTax || showReports;
  if (!anyEnabled) return null;

  return (
    <>
      {/* ── Cash flow / financial position ─────────────────────────── */}
      {showCashflow && (
        <>
          <SectionDivider label="Financial position" />
          <FinancialHeader
            financialSettings={props.financialSettings}
            safeToSpendResult={props.safeToSpendResult}
            invoices={props.invoices}
            monthlyIncome={props.monthlyIncome}
            autoOpenInvoiceForm={props.autoOpenInvoiceForm}
          />
        </>
      )}

      {/* ── Expenses ───────────────────────────────────────────────── */}
      {showExpenses && (
        <>
          <SectionDivider label="Expenses" />
          <ExpensesSnapshot data={props.expensesData} />
        </>
      )}

      {/* ── Tax & MTD ──────────────────────────────────────────────── */}
      {showTax && (
        <>
          <SectionDivider label="Tax & MTD" />
          <TaxSnapshot tax={props.taxData} mtd={props.mtdData} />
        </>
      )}

      {/* ── Reports ────────────────────────────────────────────────── */}
      {showReports && (
        <>
          <SectionDivider label="Reports" />
          <ReportsSnapshot
            ytdIncome={props.ytdIncome}
            ytdExpenses={props.ytdExpenses}
          />
        </>
      )}
    </>
  );
}
