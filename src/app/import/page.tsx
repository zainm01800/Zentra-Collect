import { ImportGate } from "@/components/import-gate";
import { ImportPageClient } from "@/components/import-page-client";
import { PageHeader } from "@/components/page-header";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Import",
  description:
    "Add overdue invoices to Zentra Collect — upload a CSV, drop in PDFs, or enter them manually.",
};

export default function ImportPage() {
  return (
    <div className="flex flex-col gap-5 max-w-2xl">
      <PageHeader
        kicker="Get started"
        title="Add your invoices"
        sub="No accounting software needed. Import a spreadsheet, upload PDFs, or enter invoices by hand."
      />
      <ImportPageClient csvFlow={<ImportGate />} />
    </div>
  );
}
