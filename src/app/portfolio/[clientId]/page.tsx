import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ZentraDashboard } from "@/components/zentra-dashboard";
import { Button } from "@/components/ui/button";
import { UpgradeScreen } from "@/components/access/upgrade-screen";
import { requireFeature, getRedirectOrUpgradePrompt } from "@/lib/access/features";
import { getUsageSnapshot, DEMO_ACCOUNT_ID } from "@/lib/usage/store";
import {
  demoBookkeeperClients,
  demoInvoices,
} from "@/lib/demo-data/zentra-demo-data";

// TODO: Replace params type with Next.js platform type when upgrading
export default async function PortfolioClientPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  // TODO: Replace DEMO_ACCOUNT_ID with session.user.accountId once auth is live
  const snapshot = getUsageSnapshot(DEMO_ACCOUNT_ID);
  const access = requireFeature(snapshot, "bookkeeper_portfolio");

  // Hard gate on the detail page — a non-bookkeeper plan user has no real
  // client IDs to drill into, and we don't want to expose demo client data
  // as if it were their own.
  if (!access.allowed) {
    const config = getRedirectOrUpgradePrompt(snapshot, "bookkeeper_portfolio")!;
    return (
      <AppShell>
        <div className="mb-4 flex items-center gap-2">
          <Button asChild variant="ghost" size="sm" className="-ml-2">
            <Link href="/portfolio">
              <ArrowLeft className="size-3" />
              Back to portfolio
            </Link>
          </Button>
        </div>
        <UpgradeScreen feature="bookkeeper_portfolio" config={config} />
      </AppShell>
    );
  }

  // TODO: Replace with DB query: getBookkeeperClient(bookkeeperBusinessId, clientId)
  const { clientId } = await params;
  const bookkeeperClient = demoBookkeeperClients.find(
    (c) => c.id === clientId,
  );

  if (!bookkeeperClient) notFound();

  // TODO: Replace with DB query: getInvoicesByBookkeeperClient(clientId)
  const clientInvoices = demoInvoices.filter(
    (inv) => inv.bookkeeperClientId === clientId,
  );

  return (
    <AppShell>
      {/* Breadcrumb */}
      <div className="mb-4 flex items-center gap-2">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/portfolio">
            <ArrowLeft className="size-3" />
            Back to portfolio
          </Link>
        </Button>
      </div>

      {/* Context banner */}
      <div className="mb-6 rounded-xl border border-black/8 bg-white dark:bg-[#211d17] px-4 py-3 text-sm text-neutral-700 dark:text-[#d8ccb5]">
        <strong>Bookkeeper view</strong> — collections plan for{" "}
        <strong>{bookkeeperClient.business.name}</strong>. Contact:{" "}
        {bookkeeperClient.primaryContactName} &middot;{" "}
        {bookkeeperClient.primaryContactEmail}
      </div>

      {/* Reuse the same ZentraDashboard, filtered to this client's invoices */}
      <ZentraDashboard initialInvoices={clientInvoices} />
    </AppShell>
  );
}
