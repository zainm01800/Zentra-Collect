import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CustomerDetail } from "@/components/customers-view";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Customer",
};

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="flex flex-col gap-5 max-w-3xl">
        {/* Back */}
        <Link
          href="/customers"
          className="flex items-center gap-1.5 text-[12.5px] font-medium w-fit transition-colors hover:opacity-70"
          style={{ color: "var(--zn-ink-3)" }}
        >
          <ArrowLeft className="size-3.5" />
          All customers
        </Link>

        {/* Detail panel */}
        <CustomerDetail customerId={id} />
      </div>
  );
}
