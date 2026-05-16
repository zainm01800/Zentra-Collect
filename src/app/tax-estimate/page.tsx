import { PageHeader } from "@/components/page-header";
import { TaxEstimateView } from "./view";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tax estimate",
  description:
    "Estimate your UK Self Assessment tax owed for the year — Income Tax + Class 4 NIC for sole traders.",
};

export default function TaxEstimatePage() {
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        kicker="Books"
        title="Tax estimate"
        sub="Estimate your Self Assessment liability for the year. Numbers come from your invoices and expenses. Estimate only — file via HMRC or your accountant."
      />
      <TaxEstimateView />
    </div>
  );
}
