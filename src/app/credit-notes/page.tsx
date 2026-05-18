import type { Metadata } from "next";
import { CreditNotesClient } from "@/components/credit-notes-client";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = {
  title: "Credit notes",
  description:
    "Issue credit notes for refunds, cancellations, or over-invoicing. Reduces taxable income and VAT.",
};

export default function CreditNotesPage() {
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        kicker=""
        title="Credit notes"
        sub="Issue a credit note when you refund a customer, cancel an invoice, or correct an over-invoice. Reduces your taxable income and VAT for the period."
      />
      <CreditNotesClient />
    </div>
  );
}
