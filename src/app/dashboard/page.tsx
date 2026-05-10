import { AppShell } from "@/components/app-shell";
import { ZentraDashboard } from "@/components/zentra-dashboard";
import { CheckoutSuccessBanner } from "@/components/checkout-success-banner";
import { getInvoices } from "@/lib/api/db";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Your collections position at a glance — what's changed, what needs you today, and what cash is likely this week.",
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const checkoutSuccess = params.checkout_success === "true";
  const importSyncFailed = params.import_sync_failed === "1";

  const dbInvoices = await getInvoices();

  return (
    <AppShell>
      <CheckoutSuccessBanner
        checkoutSuccess={checkoutSuccess}
        importSyncFailed={importSyncFailed}
      />
      <ZentraDashboard initialInvoices={dbInvoices.length ? dbInvoices : undefined} />
    </AppShell>
  );
}
