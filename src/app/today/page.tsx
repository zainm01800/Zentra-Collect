/**
 * /today — the merged Dashboard + Chase plan landing.
 *
 * Stage 3 of the audit consolidation.
 *
 * Layout (above the fold):
 *   ┌── Hero ──────────────────────────────────────┐
 *   │ Today's top action (one line, one CTA)       │
 *   └──────────────────────────────────────────────┘
 *   ┌── Queue ────────────────┐ ┌── Sidebar ──┐
 *   │  Top 5 ranked actions    │ │ Cash + Tax  │
 *   │  + Promises/Disputes     │ └──────────────┘
 *   │  pills + View full queue │
 *   └──────────────────────────┘
 *
 * Below the fold (collapsed by default, expand persists in localStorage):
 *   - Cash flow forecast (4-week)
 *   - Payment patterns
 *   - Since-last-import diff
 *
 * /dashboard now redirects here. /chase-today stays as a deep "full
 * queue" view but is no longer in the sidebar.
 */

import { CheckoutSuccessBanner } from "@/components/checkout-success-banner";
import { OutcomeSummaryBar } from "@/components/outcome-summary-bar";
import { CashForecastCard } from "@/components/cash-forecast-card";
import { TaxEstimateWidget } from "@/components/tax-estimate-widget";
import { PaymentPatternsCard } from "@/components/payment-patterns-card";
import { TodayQueueWrapper } from "@/components/today-queue-wrapper";
import { TodayHeroAndPills } from "@/components/today-hero-and-pills";
import { CollapsibleInsights } from "@/components/today-collapsible-insights";
import { getInvoices } from "@/lib/api/db";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Today",
  description:
    "Today's recommended action plan — who to chase, what to send, what cash to expect.",
};

export default async function TodayPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const checkoutSuccess  = params.checkout_success  === "true";
  const importSyncFailed = params.import_sync_failed === "1";

  const dbInvoices = await getInvoices();

  return (
    <div className="flex flex-col gap-6">
      <CheckoutSuccessBanner
        checkoutSuccess={checkoutSuccess}
        importSyncFailed={importSyncFailed}
      />

      {/* Recovery stats — only visible once outcomes have been logged */}
      <OutcomeSummaryBar />

      {/* Hero + Promises / Disputes pills — derived client-side from invoices */}
      <TodayHeroAndPills />

      {/* Top of the fold: Top-5 queue (wide) + Cash/Tax sidebar (narrow) */}
      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0">
          <TodayQueueWrapper initialInvoices={dbInvoices.length ? dbInvoices : undefined} />
        </div>
        <aside className="flex flex-col gap-3">
          <TaxEstimateWidget />
          <CashForecastCard />
        </aside>
      </div>

      {/* Below the fold — collapsed by default, preference persists.
          Hidden entirely when there are no invoices because the inner
          PaymentPatternsCard has nothing to render, so expanding the
          toggle would reveal blank space (audit issue). */}
      {dbInvoices.length > 0 && (
        <CollapsibleInsights>
          <PaymentPatternsCard />
        </CollapsibleInsights>
      )}
    </div>
  );
}
