"use client";

/**
 * src/app/demo/customers/page.tsx
 *
 * Demo customer view — shows sample customers with their invoice summary.
 * No auth, no uploads, purely hardcoded demo data.
 */

import Link from "next/link";
import { ArrowRight, Users } from "lucide-react";
import { demoInvoices, demoCustomers } from "@/lib/demo-data/zentra-demo-data";

function fmtGBP(n: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency", currency: "GBP",
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(n);
}

const RELATIONSHIP_LABELS: Record<string, string> = {
  "regular customer": "Regular",
  "slow payer": "Slow payer",
  "new customer": "New",
  "problematic payer": "Problematic",
  "high-value customer": "High value",
  "strategic account": "Strategic",
  "do not chase": "Do not chase",
};

const RELATIONSHIP_COLORS: Record<string, { color: string; bg: string }> = {
  "regular customer":  { color: "var(--zn-ink-3)", bg: "var(--zn-surface-2)" },
  "slow payer":        { color: "var(--zn-warn)",   bg: "var(--zn-warn-soft)" },
  "new customer":      { color: "var(--zn-ink-3)", bg: "var(--zn-surface-2)" },
  "problematic payer": { color: "var(--zn-risk)",   bg: "var(--zn-risk-soft)" },
  "high-value customer":{ color: "var(--zn-ink-2)", bg: "var(--zn-surface-2)" },
  "strategic account": { color: "var(--zn-ink-2)", bg: "var(--zn-surface-2)" },
  "do not chase":      { color: "var(--zn-ink-3)", bg: "var(--zn-surface-2)" },
};

// Summarise invoices per customer
const customerRows = demoCustomers.map((customer) => {
  const invs = demoInvoices.filter((inv) => inv.customerId === customer.id);
  const open = invs.filter((inv) => inv.status !== "paid" && inv.amountOutstanding > 0);
  const overdue = open.filter((inv) => inv.daysOverdue > 0);
  const outstanding = open.reduce((s, inv) => s + inv.amountOutstanding, 0);
  const maxOverdue = Math.max(0, ...overdue.map((inv) => inv.daysOverdue));
  return { customer, open, overdue, outstanding, maxOverdue };
}).sort((a, b) => b.outstanding - a.outstanding);

export default function DemoCustomersPage() {
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="zn-section-label">Demo · Customers</p>
          <h1
            className="text-[28px] font-semibold tracking-[-0.02em] leading-[1.1] mt-1"
            style={{ color: "var(--zn-ink)" }}
          >
            Customers
          </h1>
          <p className="mt-1 text-[13.5px]" style={{ color: "var(--zn-ink-3)" }}>
            {demoCustomers.length} sample customers · sorted by outstanding balance
          </p>
        </div>
        <Link href="/login?mode=signup" className="zn-pill">
          Import your data <ArrowRight className="size-3.5" />
        </Link>
      </div>

      {/* Table */}
      <div className="zn-card overflow-hidden">
        <div
          className="hidden sm:grid grid-cols-[1fr_auto_auto_auto_120px] gap-4 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.06em] border-b"
          style={{ color: "var(--zn-ink-3)", borderColor: "var(--zn-line-soft)", background: "var(--zn-bg-2)" }}
        >
          <span>Customer</span>
          <span className="text-right">Open invoices</span>
          <span className="text-right">Overdue</span>
          <span className="text-right">Outstanding</span>
          <span>Type</span>
        </div>

        <div className="divide-y" style={{ borderColor: "var(--zn-line-soft)" }}>
          {customerRows.map(({ customer, open, overdue, outstanding, maxOverdue }) => {
            const rel = (customer.relationshipType as string) ?? "";
            const relLabel = RELATIONSHIP_LABELS[rel] ?? rel;
            const relColors = RELATIONSHIP_COLORS[rel] ?? { color: "var(--zn-ink-3)", bg: "var(--zn-surface-2)" };

            return (
              <div
                key={customer.id}
                className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto_auto_120px] gap-2 sm:gap-4 px-5 py-3.5"
              >
                {/* Name + contact */}
                <div className="min-w-0">
                  <p className="text-[13px] font-medium truncate" style={{ color: "var(--zn-ink)" }}>
                    {customer.name}
                  </p>
                  {customer.apContactName && (
                    <p className="text-[11.5px] mt-0.5 truncate" style={{ color: "var(--zn-ink-3)" }}>
                      {customer.apContactName}
                      {customer.apContactEmail && ` · ${customer.apContactEmail}`}
                    </p>
                  )}
                  {!customer.apContactEmail && (
                    <p className="text-[11.5px] mt-0.5" style={{ color: "var(--zn-risk)" }}>
                      No email on file
                    </p>
                  )}
                </div>

                {/* Open invoices */}
                <div className="hidden sm:flex items-center justify-end text-[12.5px] tabular-nums" style={{ color: "var(--zn-ink-2)" }}>
                  {open.length}
                </div>

                {/* Overdue */}
                <div className="hidden sm:flex items-center justify-end text-[12.5px] tabular-nums" style={{ color: overdue.length > 0 ? "var(--zn-risk)" : "var(--zn-ink-3)" }}>
                  {overdue.length > 0 ? `${overdue.length} (${maxOverdue}d)` : "—"}
                </div>

                {/* Outstanding */}
                <div className="hidden sm:flex items-center justify-end text-[13px] font-semibold tabular-nums" style={{ color: "var(--zn-ink)" }}>
                  {outstanding > 0 ? fmtGBP(outstanding) : <span style={{ color: "var(--zn-ink-3)" }}>—</span>}
                </div>

                {/* Relationship type */}
                <div className="flex items-center">
                  <span
                    className="rounded-full px-2.5 py-0.5 text-[10.5px] font-semibold"
                    style={{ background: relColors.bg, color: relColors.color }}
                  >
                    {relLabel}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* CTA */}
      <div
        className="flex items-center gap-4 rounded-[12px] px-5 py-4"
        style={{ background: "var(--zn-surface-2)", border: "1px solid var(--zn-line)" }}
      >
        <Users className="size-5 shrink-0" style={{ color: "var(--zn-ink-3)" }} />
        <div className="flex-1 min-w-0">
          <p className="text-[13.5px] font-semibold" style={{ color: "var(--zn-ink)" }}>
            Your own customers would appear here
          </p>
          <p className="text-[12.5px] mt-0.5" style={{ color: "var(--zn-ink-3)" }}>
            Import your AR ageing CSV and Zentra builds your customer list automatically — with contact details, outstanding balances, and behaviour profiles.
          </p>
        </div>
        <Link href="/login?mode=signup" className="zn-pill shrink-0 text-[12px]" style={{ height: 32 }}>
          Start free trial <ArrowRight className="size-3" />
        </Link>
      </div>
    </div>
  );
}
