import { ClientReportView } from "@/components/client-report-view";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AR Report",
  description: "Printable accounts-receivable summary for this client.",
};

export default async function ClientReportPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;

  return (
    <div className="py-2">
      <ClientReportView clientIdOverride={clientId} />
    </div>
  );
}
