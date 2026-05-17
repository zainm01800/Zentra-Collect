"use client";

/**
 * Client wrapper for the import page.
 * Manages which import method is active: method-picker → csv | pdf | manual | bank.
 * The CSV path reuses the existing ImportGate + ZentraImportFlow.
 * The PDF path renders PdfImportFlow inline.
 */

import { useState } from "react";
import { ImportMethodPicker } from "@/components/import-method-picker";
import { PdfImportFlow } from "@/components/pdf-import-flow";

type ActiveMethod = "picker" | "csv" | "pdf";

interface Props {
  /** The ImportGate + ZentraImportFlow tree, pre-rendered as a server component */
  csvFlow: React.ReactNode;
}

export function ImportPageClient({ csvFlow }: Props) {
  const [active, setActive] = useState<ActiveMethod>("picker");

  if (active === "csv") return <>{csvFlow}</>;
  if (active === "pdf") return <PdfImportFlow onBack={() => setActive("picker")} />;

  return (
    <ImportMethodPicker
      onSelectCsv={() => setActive("csv")}
      onSelectPdf={() => setActive("pdf")}
    />
  );
}
