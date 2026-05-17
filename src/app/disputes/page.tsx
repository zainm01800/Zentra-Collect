import { PageHeader } from "@/components/page-header";
import { ShieldAlert } from "lucide-react";
import { DisputeWorkflow } from "@/components/dispute-workflow";
import { demoCashpilotInvoices as demoInvoices } from "@/lib/demo-data/zentra-demo-data";
import { getDisputes, type DisputeRow } from "@/lib/api/db";
import { formatCurrency } from "@/lib/formatters";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Disputes & holds",
  description: "Invoices Zentra has paused chasing — and what's needed to unblock them.",
};

function buildDemoDisputes(): DisputeRow[] {
  return demoInvoices
    .filter((i) => i.status === "Disputed")
    .slice(0, 4)
    .map((inv, idx) => ({
      id: inv.id,
      customerName: inv.customerName,
      invoiceNumber: inv.invoiceNumber,
      amount: inv.amount,
      raised: new Date(Date.now() - (idx + 1) * 7 * 86400000).toISOString(),
      kind: ["Pricing query", "Goods not received", "Wrong PO", "Incorrect tax"][idx % 4],
      status: ["Awaiting evidence", "Customer reviewing", "Internal review", "Owner action"][idx % 4],
      note: [
        "Customer believes the line items don't match the original PO. Awaiting clarification from their AP.",
        "Customer says goods were not received in full. Awaiting delivery confirmation from their warehouse team.",
        "Invoice references an incorrect PO number. Correct PO sent — waiting for customer to reprocess.",
        "VAT applied at standard rate; customer claims they are exempt. Awaiting evidence of exemption certificate.",
      ][idx % 4],
      owner: ["Mo", "Sara", "Amir", "Mo"][idx % 4],
    }));
}

export default async function DisputesPage() {
  const dbDisputes = await getDisputes();
  const disputes: DisputeRow[] = dbDisputes.length ? dbDisputes : buildDemoDisputes();
  const isDemo = dbDisputes.length === 0;

  return (
    <div className="flex flex-col gap-5">
        <PageHeader
          kicker="Exceptions desk"
          title="Disputes & holds"
          sub="Invoices Zentra has paused chasing — and what's needed to unblock them."
        />

        {isDemo && (
          <div className="rounded-xl bg-zinc-100 border border-zinc-200 px-4 py-2.5 text-sm text-zinc-500">
            Showing sample data — import your invoices to track real disputes.
          </div>
        )}

        <div className="flex flex-col gap-3">
          {disputes.length === 0 ? (
            <div className="zn-card p-10 text-center">
              <p className="text-[#6b6253] dark:text-[#8a7d69]">No active disputes. 🎉</p>
            </div>
          ) : disputes.map((d) => (
            <div key={d.id} className="zn-card p-[18px]">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-3">
                  <div
                    className="size-9 rounded-[10px] inline-flex items-center justify-center flex-shrink-0"
                    style={{ background: "var(--zn-warn-soft)", color: "var(--zn-warn)" }}
                  >
                    <ShieldAlert className="size-4" />
                  </div>
                  <div>
                    <div className="text-[14px] font-semibold text-[#1d1813] dark:text-[#f0e8d5]">
                      {d.customerName} · <span className="zn-kind-tag">{d.invoiceNumber}</span>
                    </div>
                    <div className="text-[12px] text-[#6b6253] dark:text-[#8a7d69]">
                      Raised {new Date(d.raised).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} · {d.kind}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="text-[18px] font-semibold tabular-nums">{formatCurrency(d.amount)}</div>
                  <span
                    className="zn-chip"
                    style={{ background: "var(--zn-warn-soft)", color: "var(--zn-warn)", borderColor: "transparent" }}
                  >
                    {d.status}
                  </span>
                </div>
              </div>

              <div
                className="rounded-[10px] p-3 text-[13px] mb-2.5"
                style={{ background: "var(--zn-surface-2)", border: "1px solid var(--zn-line-soft)" }}
              >
                {d.note || "No notes recorded."}
              </div>

              <DisputeWorkflow
                disputeId={d.id}
                customerName={d.customerName}
                invoiceRef={d.invoiceNumber}
                amount={d.amount}
                owner={d.owner ?? undefined}
                isDemo={isDemo}
              />
            </div>
          ))}
        </div>
    </div>
  );
}
