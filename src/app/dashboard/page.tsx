import { AppShell }              from "@/components/app-shell";
import { ZentraDashboard }       from "@/components/zentra-dashboard";
import { CheckoutSuccessBanner } from "@/components/checkout-success-banner";
import { FinancialHeader }       from "@/components/financial-header";
import { OutcomeSummaryBar }     from "@/components/outcome-summary-bar";

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

      {/* Recovery stats — visible once outcomes have been logged */}
      <OutcomeSummaryBar />

      {/* ── Collections — primary purpose of the app ── */}
      <ZentraDashboard initialInvoices={dbInvoices.length ? dbInvoices : undefined} />

      {/* ── Financial position — secondary section ── */}
      <div
        className="mt-12 mb-6 flex items-center gap-4"
      >
        <div className="flex-1 h-px" style={{ background: "var(--zn-line-soft)" }} />
        <span
          className="text-[10.5px] font-semibold uppercase tracking-[0.12em] flex-shrink-0"
          style={{ color: "var(--zn-ink-3)" }}
        >
          Financial position
        </span>
        <div className="flex-1 h-px" style={{ background: "var(--zn-line-soft)" }} />
      </div>

      <FinancialHeader
        financialSettings={financialSettings}
        safeToSpendResult={safeToSpendResult}
        invoices={dbInvoices}
        monthlyIncome={monthlyIncome}
        autoOpenInvoiceForm={autoOpenNewInvoice}
      />
    </AppShell>
  );
}
