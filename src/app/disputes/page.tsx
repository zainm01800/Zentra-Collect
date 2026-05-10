import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { Check, FileText, Mail, ShieldAlert } from "lucide-react";
import { demoInvoices } from "@/data/demo-invoices";
import { formatCurrency } from "@/lib/formatters";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Disputes & holds",
  description: "Invoices Zentra has paused chasing — and what's needed to unblock them.",
};

const DISPUTES = demoInvoices
  .filter((i) => i.status === "Disputed")
  .slice(0, 4)
  .map((inv, idx) => ({
    id: inv.id,
    customerName: inv.customerName,
    invoiceNumber: inv.invoiceNumber,
    amount: inv.amount,
    raised: new Date(Date.now() - (idx + 1) * 7 * 86400000),
    kind: ["Pricing query", "Goods not received", "Wrong PO", "Incorrect tax"][idx % 4],
    status: ["Awaiting evidence", "Customer reviewing", "Internal review", "Owner action"][idx % 4],
    note: "Customer believes the line items don't match the original PO. Awaiting clarification from their AP.",
    owner: ["Mo", "Sara", "Amir", "Mo"][idx % 4],
  }));

export default function DisputesPage() {
  return (
    <AppShell>
      <div className="flex flex-col gap-5">
        <PageHeader
          kicker="Exceptions desk"
          title="Disputes & holds"
          sub="Invoices Zentra has paused chasing — and what's needed to unblock them."
        />

        <div className="flex flex-col gap-3">
          {DISPUTES.length === 0 ? (
            <div className="zn-card p-10 text-center">
              <p className="text-[#6b6253]">No active disputes. 🎉</p>
            </div>
          ) : DISPUTES.map((d) => (
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
                    <div className="text-[14px] font-semibold text-[#1d1813]">
                      {d.customerName} · <span className="zn-kind-tag">{d.invoiceNumber}</span>
                    </div>
                    <div className="text-[12px] text-[#6b6253]">
                      Raised {d.raised.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} · {d.kind}
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
                style={{
                  background: "var(--zn-surface-2)",
                  border: "1px solid var(--zn-line-soft)",
                }}
              >
                {d.note}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button className="zn-pill zn-pill-ghost" style={{ height: 26, fontSize: 12, padding: "0 11px" }}>
                  <Mail className="size-3.5" /> Reply to customer
                </button>
                <button className="zn-pill zn-pill-ghost" style={{ height: 26, fontSize: 12, padding: "0 11px" }}>
                  <FileText className="size-3.5" /> Add evidence
                </button>
                <button className="zn-pill zn-pill-ghost" style={{ height: 26, fontSize: 12, padding: "0 11px" }}>
                  <Check className="size-3.5" /> Resolve & resume chase
                </button>
                <div className="flex-1" />
                <button className="zn-pill zn-pill-ghost" style={{ height: 26, fontSize: 12, padding: "0 11px" }}>
                  Owner · {d.owner}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
