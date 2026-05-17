import { ImportGate } from "@/components/import-gate";
import { ImportPageClient } from "@/components/import-page-client";
import { PageHeader } from "@/components/page-header";
import { getIntegrationStatusAction } from "@/actions/integrations/sync";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Import",
  description:
    "Add overdue invoices to Zentra Collect — upload a CSV, drop in PDFs, or enter them manually.",
};

export default async function ImportPage() {
  // Check which integrations this user has connected, so the method picker
  // can surface a one-click sync card instead of requiring a CSV export.
  let connectedIntegrations: { xero: boolean; quickbooks: boolean; sage: boolean; freeagent: boolean } = {
    xero: false,
    quickbooks: false,
    sage: false,
    freeagent: false,
  };

  try {
    const status = await getIntegrationStatusAction();
    connectedIntegrations = {
      xero: status.xero.connected,
      quickbooks: status.quickbooks.connected,
      sage: status.sage.connected,
      freeagent: status.freeagent.connected,
    };
  } catch {
    // Non-fatal — fall back to CSV-only picker
  }

  return (
    <div className="flex flex-col gap-5 max-w-2xl">
      <PageHeader
        kicker="Get started"
        title="Add your invoices"
        sub="No accounting software needed. Import a spreadsheet, upload PDFs, or enter invoices by hand."
      />
      <ImportPageClient
        csvFlow={<ImportGate />}
        connectedIntegrations={connectedIntegrations}
      />
    </div>
  );
}
