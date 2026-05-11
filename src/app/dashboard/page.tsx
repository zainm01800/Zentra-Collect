import { AppShell }              from "@/components/app-shell";
import { ZentraDashboard }       from "@/components/zentra-dashboard";
import { CheckoutSuccessBanner } from "@/components/checkout-success-banner";
import { FinancialHeader }       from "@/components/financial-header";

import { getInvoices }                                    from "@/lib/api/db";
import { getFinancialSettings, getMonthlyIncomeSummary }  from "@/actions/financial-settings";
import { calculateSafeToSpend }                           from "@/lib/finance/safe-to-spend";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard",
  description:
    "Your collections position at a glance — what's changed, what needs you today, and what cash is likely this week.",
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const checkoutSuccess    = params.checkout_success  === "true";
  const importSyncFailed   = params.import_sync_failed === "1";
  const autoOpenNewInvoice = params.new_invoice === "1";

  // ── Server-side data fetching (all in parallel) ───────────────────────────

  const [dbInvoices, financialSettings, monthlyIncome] = await Promise.all([
    getInvoices(),
    getFinancialSettings(),
    getMonthlyIncomeSummary(),
  ]);

  // ── Safe-to-spend calculation ─────────────────────────────────────────────
  //
  // Only compute when a bank balance has been explicitly set
  // (bank_balance_updated_at populated).  When null, SafeToSpendCard renders
  // nothing — BankBalanceInput shows the "Add balance to unlock" prompt instead.

  const hasBankBalance = Boolean(financialSettings?.bankBalanceUpdatedAt);

  const safeToSpendResult = hasBankBalance
    ? calculateSafeToSpend({
        bankBalance:    financialSettings!.bankBalance,
        invoices:       dbInvoices,
        taxRatePercent: financialSettings!.taxRatePercent ?? 20,
        manualBills:    [], // will be fetched in a later iteration
      })
    : undefined;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <AppShell>
      <CheckoutSuccessBanner
        checkoutSuccess={checkoutSuccess}
        importSyncFailed={importSyncFailed}
      />

      {/* Financial position overview + quick-action bar */}
      <FinancialHeader
        financialSettings={financialSettings}
        safeToSpendResult={safeToSpendResult}
        invoices={dbInvoices}
        monthlyIncome={monthlyIncome}
        autoOpenInvoiceForm={autoOpenNewInvoice}
      />

      {/* Thin visual separator between the two sections */}
      <div
        className="mb-8 h-px w-full"
        style={{ background: "var(--zn-line-soft)" }}
      />

      {/* Existing AR collections dashboard — unchanged */}
      <ZentraDashboard initialInvoices={dbInvoices.length ? dbInvoices : undefined} />
    </AppShell>
  );
}
