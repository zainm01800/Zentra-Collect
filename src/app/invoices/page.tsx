import { PageHeader } from "@/components/page-header";
import { InvoicesHub } from "./hub";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Invoices",
  description:
    "All your invoices in one place — open, paid, drafts. Create new or import an export.",
};

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        kicker=""
        title="Invoices"
        sub="All your invoices. Create, import, or pick one to chase."
      />
      <InvoicesHub
        initialTab={(params.tab as "open" | "paid" | "drafts" | undefined) ?? "open"}
        openCreate={params.create === "1"}
      />
    </div>
  );
}
