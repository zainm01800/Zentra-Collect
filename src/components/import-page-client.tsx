"use client";

/**
 * Client wrapper for the import page.
 * Manages which import method is active: method-picker → csv | pdf | manual | bank | sync.
 * The CSV path reuses the existing ImportGate + ZentraImportFlow.
 * The PDF path renders PdfImportFlow inline.
 */

import { useState } from "react";
import { ImportMethodPicker } from "@/components/import-method-picker";
import { PdfImportFlow } from "@/components/pdf-import-flow";
import { IntegrationSyncFlow } from "@/components/integration-sync-flow";

type ActiveMethod = "picker" | "csv" | "pdf" | "sync_xero" | "sync_quickbooks" | "sync_sage" | "sync_freeagent";

export interface ConnectedIntegrations {
  xero: boolean;
  quickbooks: boolean;
  sage: boolean;
  freeagent: boolean;
}

interface Props {
  /** The ImportGate + ZentraImportFlow tree, pre-rendered as a server component */
  csvFlow: React.ReactNode;
  connectedIntegrations?: ConnectedIntegrations;
}

export function ImportPageClient({ csvFlow, connectedIntegrations }: Props) {
  const [active, setActive] = useState<ActiveMethod>("picker");

  if (active === "csv") return <>{csvFlow}</>;
  if (active === "pdf") return <PdfImportFlow onBack={() => setActive("picker")} />;
  if (active === "sync_xero") return <IntegrationSyncFlow provider="xero" onBack={() => setActive("picker")} />;
  if (active === "sync_quickbooks") return <IntegrationSyncFlow provider="quickbooks" onBack={() => setActive("picker")} />;
  if (active === "sync_sage") return <IntegrationSyncFlow provider="sage" onBack={() => setActive("picker")} />;
  if (active === "sync_freeagent") return <IntegrationSyncFlow provider="freeagent" onBack={() => setActive("picker")} />;

  return (
    <ImportMethodPicker
      onSelectCsv={() => setActive("csv")}
      onSelectPdf={() => setActive("pdf")}
      onSelectSync={(provider) => setActive(`sync_${provider}` as ActiveMethod)}
      connectedIntegrations={connectedIntegrations}
    />
  );
}
