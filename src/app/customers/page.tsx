import { AppShell } from "@/components/app-shell";
import { CustomersView } from "@/components/customers-view";
import { PageHeader } from "@/components/page-header";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Customers",
  description: "Payment history and risk profile for every customer — click any name to see their open invoices and chase history.",
};

export default function CustomersPage() {
  return (
    <AppShell>
      <div className="flex flex-col gap-5">
        <PageHeader
          kicker="Collections"
          title="Customers"
          sub="Payment history and risk profile for every customer. Click any name to see open invoices, chase history, and behaviour notes."
        />
        <CustomersView />
      </div>
    </AppShell>
  );
}
