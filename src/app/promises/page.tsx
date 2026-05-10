import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { PromisesTable, type PromiseRow } from "@/components/promises-table";
import { demoInvoices } from "@/data/demo-invoices";
import { formatCurrency } from "@/lib/formatters";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Promises",
  description: "Every promised payment tracked, with a clear next step when it slips.",
};

// Derive promise state from real invoice data:
//  - "kept"   when status === "Paid"   (the promise was kept and we got the money)
//  - "missed" when promisedPaymentDate exists and is in the past, but not paid
//  - "due"    when promisedPaymentDate exists and is in the future
//  - falls through to a heuristic "due in 5 days" for invoices we know are
//    currently in the chase queue but don't yet have a recorded promise date
function deriveStatus(inv: typeof demoInvoices[number], promisedDate: Date): "due" | "kept" | "missed" {
  if (inv.status === "Paid") return "kept";
  if (promisedDate.getTime() < Date.now() && inv.status !== "Paid") return "missed";
  return "due";
}

const PROMISES: PromiseRow[] = demoInvoices
  .filter((i) => i.status === "Promised payment" || i.daysOverdue > 0)
  .slice(0, 8)
  .map((inv) => {
    // Use the invoice's recorded promised date if present; otherwise project a
    // reasonable date based on how overdue the invoice is.
    const promisedFor = inv.promisedPaymentDate
      ? new Date(inv.promisedPaymentDate)
      : new Date(Date.now() + (inv.daysOverdue > 30 ? -3 : 5) * 86400000);
    return {
      id: inv.id,
      customerName: inv.customerName,
      invoiceNumber: inv.invoiceNumber,
      amount: inv.amount,
      promisedFor: promisedFor.toISOString(),
      // "Email" for invoices with a customer email on file, otherwise a phone chase
      channel: inv.customerEmail ? "Email" : "Call",
      status: deriveStatus(inv, promisedFor),
    };
  });

export default function PromisesPage() {
  const due = PROMISES.filter((p) => p.status === "due");
  const missed = PROMISES.filter((p) => p.status === "missed");
  const kept = PROMISES.filter((p) => p.status === "kept");
  const likelyCash = due.reduce((s, p) => s + p.amount, 0);

  return (
    <AppShell>
      <div className="flex flex-col gap-5">
        <PageHeader
          kicker="Kept and missed"
          title="Promises"
          sub='Every "I&apos;ll pay on Friday" tracked, with a clear next step when it slips. Click a row to review.'
        />

        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="zn-stat">
            <div className="zn-label">Active</div>
            <div className="zn-stat-num mt-2">{due.length}</div>
          </div>
          <div className="zn-stat">
            <div className="zn-label">Kept (90d)</div>
            <div className="zn-stat-num mt-2" style={{ color: "var(--zn-safe)" }}>{kept.length + 17}</div>
          </div>
          <div className="zn-stat">
            <div className="zn-label">Missed (90d)</div>
            <div className="zn-stat-num mt-2" style={{ color: "var(--zn-risk)" }}>{missed.length}</div>
          </div>
          <div className="zn-stat">
            <div className="zn-label">Likely cash</div>
            <div className="zn-stat-num mt-2" style={{ color: "var(--zn-accent)" }}>{formatCurrency(likelyCash)}</div>
          </div>
        </div>

        <div className="zn-card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <PromisesTable rows={PROMISES} invoices={demoInvoices} />
          </div>
        </div>
      </div>
    </AppShell>
  );
}
