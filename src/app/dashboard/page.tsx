import { ZentraDashboard }             from "@/components/zentra-dashboard";
import { CheckoutSuccessBanner }       from "@/components/checkout-success-banner";
import { DashboardGreeting }           from "@/components/dashboard-greeting";
import { DashboardEmptyModules }       from "@/components/dashboard-empty-modules";
import { DashboardModuleStack }        from "@/components/dashboard-module-stack";
import { OutcomeSummaryBar }           from "@/components/outcome-summary-bar";
import { WorkspaceSetupBanner }        from "@/components/workspace-setup-banner";

import { getInvoices }                                       from "@/lib/api/db";
import {
  getFinancialSettings,
  getMonthlyIncomeSummary,
  getMonthlyIncomeSeries,
} from "@/actions/financial-settings";
import {
  getMonthlyExpenseSeries,
  getExpenses,
} from "@/actions/expenses";
import { calculateSafeToSpend }                              from "@/lib/finance/safe-to-spend";
import {
  buildTaxSnapshot,
  buildExpensesSnapshot,
  buildMtdSnapshot,
} from "@/lib/snapshots";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard",
  description:
    "Your collections, cash flow, expenses, tax and reports — adapted to the modules you've enabled.",
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const checkoutSuccess    = params.checkout_success   === "true";
  const importSyncFailed   = params.import_sync_failed === "1";
  const autoOpenNewInvoice = params.new_invoice        === "1";

  const [
    dbInvoices,
    financialSettings,
    monthlyIncome,
    incomeSeries,
    expenseSeries,
    recentExpenses,
  ] = await Promise.all([
    getInvoices(),
    getFinancialSettings(),
    getMonthlyIncomeSummary(),
    getMonthlyIncomeSeries(12),
    getMonthlyExpenseSeries(12),
    getExpenses(3),
  ]);

  const hasBankBalance = Boolean(financialSettings?.bankBalanceUpdatedAt);
  const taxRatePercent = financialSettings?.taxRatePercent ?? 20;

  const safeToSpendResult = hasBankBalance
    ? calculateSafeToSpend({
        bankBalance:    financialSettings!.bankBalance,
        invoices:       dbInvoices,
        taxRatePercent,
        manualBills:    [],
      })
    : undefined;

  const taxData      = buildTaxSnapshot(incomeSeries, expenseSeries, taxRatePercent);
  const mtdData      = buildMtdSnapshot(incomeSeries);
  const expensesData = buildExpensesSnapshot(expenseSeries, recentExpenses);
  const ytdIncome    = incomeSeries.reduce((sum, m) => sum + m.income, 0);
  const ytdExpenses  = expenseSeries.reduce((sum, m) => sum + m.expenses, 0);

  return (
    <>
      <CheckoutSuccessBanner
        checkoutSuccess={checkoutSuccess}
        importSyncFailed={importSyncFailed}
      />
      <DashboardGreeting />
      <OutcomeSummaryBar />
      <WorkspaceSetupBanner />
      <DashboardEmptyModules />
      <ZentraDashboard initialInvoices={dbInvoices.length ? dbInvoices : undefined} />
      <DashboardModuleStack
        financialSettings={financialSettings}
        safeToSpendResult={safeToSpendResult}
        invoices={dbInvoices}
        monthlyIncome={monthlyIncome}
        autoOpenInvoiceForm={autoOpenNewInvoice}
        taxData={taxData}
        mtdData={mtdData}
        expensesData={expensesData}
        ytdIncome={ytdIncome}
        ytdExpenses={ytdExpenses}
      />
    </>
  );
}
