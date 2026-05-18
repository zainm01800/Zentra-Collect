import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CustomerStatement } from "@/components/customer-statement";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Statement of account",
};

export default async function CustomerStatementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="max-w-3xl space-y-5 print:max-w-none print:space-y-0">
        <Link
          href={`/customers/${id}`}
          className="inline-flex items-center gap-1.5 text-[12.5px] font-medium transition-opacity hover:opacity-70 print:hidden"
          style={{ color: "var(--zn-ink-3)" }}
        >
          <ArrowLeft className="size-3.5" />
          Back to customer
        </Link>

        <CustomerStatement customerId={id} />
    </div>
  );
}
