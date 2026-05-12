import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AgedDebtReport } from "@/components/aged-debt-report";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Aged debt — Zentra Flow",
  description: "Outstanding invoices broken down by how overdue they are.",
};

export default function AgedDebtPage() {
  return (
    <div className="space-y-6">
        <div>
          <Link
            href="/reports"
            className="inline-flex items-center gap-1.5 text-[12.5px] font-medium mb-4 transition-opacity hover:opacity-70"
            style={{ color: "var(--zn-ink-3)" }}
          >
            <ArrowLeft className="size-3.5" />
            Reports
          </Link>
          <p
            className="text-[10.5px] font-semibold uppercase tracking-[0.1em]"
            style={{ color: "var(--zn-ink-3)" }}
          >
            Finance
          </p>
          <h1
            className="mt-1 text-[26px] font-semibold tracking-[-0.02em]"
            style={{ color: "var(--zn-ink)" }}
          >
            Aged debt
          </h1>
          <p className="mt-1 text-[14px]" style={{ color: "var(--zn-ink-2)" }}>
            Every open invoice sorted by how long it has been outstanding. Export to CSV to share with your accountant or credit insurer.
          </p>
        </div>

        <AgedDebtReport />
      </div>
  );
}
