import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ZentraDashboard } from "@/components/zentra-dashboard";
import { Button } from "@/components/ui/button";
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
      <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
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
