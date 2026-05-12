import { PageHeader } from "@/components/page-header";
import { PromisesTable, type PromiseRow } from "@/components/promises-table";
import { demoCashpilotInvoices as demoInvoices } from "@/lib/demo-data/zentra-demo-data";
import { getPromises } from "@/lib/api/db";
import { formatCurrency } from "@/lib/formatters";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Promises",
  description: "Every promised payment tracked, with a clear next step when it slips.",
};

function buildDemoPromises(): PromiseRow[] {
  return demoInvoices
    .filter((i) => i.status === "Promised payment" || i.daysOverdue > 0)
    .slice(0, 8)
    .map((inv) => {
      const promisedFor = inv.promisedPaymentDate
        ? new Date(inv.promisedPaymentDate)
        : new Date(Date.now() + (inv.daysOverdue > 30 ? -3 : 5) * 86400000);
      let status: "due" | "kept" | "missed" = "due";
      if (inv.status === "Paid") status = "kept";
      else if (promisedFor.getTime() < Date.now()) status = "missed";
      return {
        id: inv.id,
        customerName: inv.customerName,
        invoiceNumber: inv.invoiceNumber,
        amount: inv.amount,
        promisedFor: promisedFor.toISOString(),
        channel: inv.customerEmail ? "Email" : "Call",
        status,
      };
    });
}

export default async function PromisesPage() {
  const dbPromises = await getPromises();
  const promises: PromiseRow[] = dbPromises.length ? dbPromises : buildDemoPromises();
  const isDemo = dbPromises.length === 0;

  const due = promises.filter((p) => p.status === "due");
  const missed = promises.filter((p) => p.status === "missed");
  const kept = promises.filter((p) => p.status === "kept");
  const likelyCash = due.reduce((s, p) => s + p.amount, 0);

  return (
    <div className="flex flex-col gap-5">
        <PageHeader
          kicker="Kept and missed"
          title="Promises"
          sub='Every "I&apos;ll pay on Friday" tracked, with a clear next step when it slips. Click a row to review.'
        />

        {isDemo && (
          <div className="rounded-xl bg-zinc-100 border border-zinc-200 px-4 py-2.5 text-sm text-zinc-500">
            Showing sample data — import your invoices to track real promises.
          </div>
        )}

        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="zn-stat">
            <div className="zn-label">Active</div>
            <div className="zn-stat-num mt-2">{due.length}</div>
          </div>
          <div className="zn-stat">
            <div className="zn-label">Kept (90d)</div>
            <div className="zn-stat-num mt-2" style={{ color: "var(--zn-safe)" }}>{kept.length + (isDemo ? 17 : 0)}</div>
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
            <PromisesTable rows={promises} invoices={demoInvoices} />
          </div>
        </div>
    </div>
  );
}
