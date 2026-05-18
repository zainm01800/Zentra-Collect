import type { Metadata } from "next";
import { MileageClient } from "@/components/mileage-client";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = {
  title: "Mileage",
  description:
    "Log business miles for Self-Assessment. HMRC mileage allowance applied automatically.",
};

export default function MileagePage() {
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        kicker=""
        title="Mileage"
        sub="Log business miles for Self-Assessment. HMRC rate applied automatically — 45p / mile for the first 10,000 miles, 25p after."
      />
      <MileageClient />
    </div>
  );
}
