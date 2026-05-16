import { NewInvoiceForm } from "./form";
import { PageHeader } from "@/components/page-header";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "New invoice",
  description:
    "Create an invoice with the customer payment portal embedded — customers pay, promise, or explain the delay in one tap.",
};

export default function NewInvoicePage() {
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        kicker="Invoicing"
        title="New invoice"
        sub="Create an invoice — the customer payment portal link is generated automatically and embedded in the share email."
      />
      <NewInvoiceForm />
    </div>
  );
}
