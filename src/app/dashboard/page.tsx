import { ZentraDashboard }       from "@/components/zentra-dashboard";
import { CheckoutSuccessBanner } from "@/components/checkout-success-banner";
import { FinancialHeader }       from "@/components/financial-header";
import { OutcomeSummaryBar }     from "@/components/outcome-summary-bar";
import { CashForecastCard }      from "@/components/cash-forecast-card";
import { PaymentPatternsCard }   from "@/components/payment-patterns-card";

import { getInvoices }                                    from "@/lib/api/db";
import { getFinancialSettings, getMonthlyIncomeSummary }  from "@/actions/financial-settings";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard",
  description:
    "Your financial position and collections plan in one view — bank balance, safe to spend, and who to chase today.",
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
  //
  // Note: bank balance is no longer fetched from financialSettings — it's
  // derived client-side from the uploaded bank statement (localStorage).
  // Safe-to-spend is computed in FinancialHeader once it has the balance.

  const [dbInvoices, financialSettings, monthlyIncome] = await Promise.all([
    getInvoices(),
    getFinancialSettings(),
    getMonthlyIncomeSummary(),
  ]);

  // ── Render ────────────────────────────────────────────────────────────────
  //
  // Order: financial position at the top (bank balance, safe to spend, cash
  // flow forecast, monthly snapshot), then collections (chase queue + KPIs).

  return (
    <>
      <CheckoutSuccessBanner
        checkoutSuccess={checkoutSuccess}
        importSyncFailed={importSyncFailed}
      />

      {/* Recovery stats — visible once outcomes have been logged */}
      <OutcomeSummaryBar />

      {/* ── Financial position — now at the top ── */}
      <div className="mb-6 flex items-center gap-4">
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
        invoices={dbInvoices}
        monthlyIncome={monthlyIncome}
        autoOpenInvoiceForm={autoOpenNewInvoice}
      />

      {/* ── Collections divider ── */}
      <div className="mt-12 mb-6 flex items-center gap-4">
        <span
          className="text-[10.5px] font-semibold uppercase tracking-[0.12em] flex-shrink-0"
          style={{ color: "var(--zn-ink-3)" }}
        >
          Collections
        </span>
        <div className="flex-1 h-px" style={{ background: "var(--zn-line-soft)" }} />
      </div>

      {/* Cash forecast — probability-weighted projection from invoice data */}
      <CashForecastCard />

      {/* Payment patterns — day-of-week analysis (auto-hides under 5 paid invoices) */}
      <PaymentPatternsCard />

      <ZentraDashboard initialInvoices={dbInvoices.length ? dbInvoices : undefined} />
    </>
  );
}
