import type { Metadata } from "next";
import { QuotesClient } from "@/components/quotes-client";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = {
  title: "Quotes",
  description:
    "Draft quotes for clients, send them, and convert to invoices once accepted.",
};

export default function QuotesPage() {
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        kicker=""
        title="Quotes"
        sub="Draft a quote for a client. Once they accept it, one click converts it into a chase-able invoice."
      />
      <QuotesClient />
    </div>
  );
}
