import { AppShell } from "@/components/app-shell";
import { CustomersView } from "@/components/customers-view";
import { PageHeader } from "@/components/page-header";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Customers",
  description: "What you know about how each customer pays — feeds every recommendation.",
};

export default function CustomersPage() {
  return (
    <AppShell>
      <div className="flex flex-col gap-5">
        <PageHeader
          kicker="Behaviour ledger"
          title="Customers"
          sub="What you know about how each customer pays — feeds every recommendation."
        />
        <CustomersView />
      </div>
    </AppShell>
  );
}
