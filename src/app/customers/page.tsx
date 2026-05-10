import { AppShell } from "@/components/app-shell";
import { CustomersTable, type CustomerRow } from "@/components/customers-table";
import { PageHeader } from "@/components/page-header";
import { demoInvoices } from "@/data/demo-invoices";
import { formatCurrency } from "@/lib/formatters";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Customers",
  description: "What you know about how each customer pays — feeds every recommendation.",
};

function aggregateCustomers(): CustomerRow[] {
  const map = new Map<string, { outstanding: number; count: number; oldest: number }>();
  for (const inv of demoInvoices) {
    if (inv.status === "Paid") continue;
    const key = inv.customerName;
    const cur = map.get(key) ?? { outstanding: 0, count: 0, oldest: 0 };
    cur.outstanding += inv.amount;
    cur.count += 1;
    cur.oldest = Math.max(cur.oldest, inv.daysOverdue ?? 0);
    map.set(key, cur);
  }
  return Array.from(map.entries())
    .map(([name, v]) => ({
      name,
      outstanding: v.outstanding,
      invoiceCount: v.count,
      oldest: v.oldest,
      risk: v.oldest > 60 ? "high" : v.oldest > 30 ? "med" : "low",
    }))
    .sort((a, b) => b.outstanding - a.outstanding);
}

export default function CustomersPage() {
  const rows = aggregateCustomers();
  const totalOutstanding = rows.reduce((s, r) => s + r.outstanding, 0);

  return (
    <AppShell>
      <div className="flex flex-col gap-5">
        <PageHeader
          kicker="Behaviour ledger"
          title="Customers"
          sub="What you know about how each customer pays — feeds every recommendation. Click a row to review their most pressing invoice."
        />

        {/* Summary stats */}
        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="zn-stat">
            <div className="zn-label">Customers</div>
            <div className="zn-stat-num mt-2">{rows.length}</div>
          </div>
          <div className="zn-stat">
            <div className="zn-label">Total outstanding</div>
            <div className="zn-stat-num mt-2" style={{ color: "var(--zn-accent)" }}>
              {formatCurrency(totalOutstanding)}
            </div>
          </div>
          <div className="zn-stat">
            <div className="zn-label">High risk</div>
            <div className="zn-stat-num mt-2" style={{ color: "var(--zn-risk)" }}>
              {rows.filter((r) => r.risk === "high").length}
            </div>
          </div>
          <div className="zn-stat">
            <div className="zn-label">Avg oldest invoice</div>
            <div className="zn-stat-num mt-2">
              {Math.round(rows.reduce((s, r) => s + r.oldest, 0) / Math.max(1, rows.length))}d
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="zn-card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <CustomersTable rows={rows} invoices={demoInvoices} />
          </div>
        </div>
      </div>
    </AppShell>
  );
}
