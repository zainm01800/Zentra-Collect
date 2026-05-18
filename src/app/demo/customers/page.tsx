"use client";

/**
 * src/app/demo/customers/page.tsx
 *
 * Demo customer view — shows sample customers with their invoice summary.
 * No auth, no uploads, purely hardcoded demo data.
 */

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Users, X, Mail } from "lucide-react";
import { demoInvoices, demoCustomers } from "@/lib/demo-data/zentra-demo-data";
import type { Customer, Invoice } from "@/types/zentra";

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

const STATUS_COLORS: Record<string, string> = {
  Overdue: "var(--zn-risk)",
  "Chased": "var(--zn-warn)",
  "Chased 2×": "var(--zn-warn)",
  "Promise to Pay": "var(--zn-safe)",
  Disputed: "var(--zn-risk)",
  Paid: "var(--zn-ink-3)",
};

// Summarise invoices per customer
const customerRows = demoCustomers.map((customer) => {
  const invs = demoInvoices.filter((inv) => inv.customerId === customer.id);
  const open = invs.filter((inv) => inv.status !== "paid" && inv.amountOutstanding > 0);
  const overdue = open.filter((inv) => inv.daysOverdue > 0);
  const outstanding = open.reduce((s, inv) => s + inv.amountOutstanding, 0);
  const maxOverdue = Math.max(0, ...overdue.map((inv) => inv.daysOverdue));
  return { customer, invs, open, overdue, outstanding, maxOverdue };
}).sort((a, b) => b.outstanding - a.outstanding);

function CustomerDrawer({
  row,
  onClose,
}: {
  row: (typeof customerRows)[number] | null;
  onClose: () => void;
}) {
  if (!row) return null;
  const { customer, invs, outstanding, maxOverdue, overdue } = row;
  const rel = (customer.relationshipType as string) ?? "";
  const relLabel = RELATIONSHIP_LABELS[rel] ?? rel;
  const relColors = RELATIONSHIP_COLORS[rel] ?? { color: "var(--zn-ink-3)", bg: "var(--zn-surface-2)" };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/20"
        onClick={onClose}
      />
      {/* Drawer */}
      <div
        className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-[420px] overflow-y-auto flex flex-col"
        style={{ background: "var(--zn-surface)", borderLeft: "1px solid var(--zn-line)" }}
      >
        {/* Header */}
        <div
          className="flex items-start justify-between gap-3 px-5 py-4 border-b sticky top-0"
          style={{ background: "var(--zn-surface)", borderColor: "var(--zn-line-soft)" }}
        >
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.07em]" style={{ color: "var(--zn-ink-3)" }}>
              Customer profile
            </p>
            <h2 className="text-[17px] font-semibold mt-0.5 truncate" style={{ color: "var(--zn-ink)" }}>
              {customer.name}
            </h2>
            <span
              className="inline-block rounded-full px-2.5 py-0.5 text-[10.5px] font-semibold mt-1"
              style={{ background: relColors.bg, color: relColors.color }}
            >
              {relLabel}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-black/5 mt-0.5 shrink-0"
            aria-label="Close"
          >
            <X className="size-4" style={{ color: "var(--zn-ink-3)" }} />
          </button>
        </div>

        <div className="flex flex-col gap-5 px-5 py-5">
          {/* Contact */}
          <div className="flex flex-col gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.07em]" style={{ color: "var(--zn-ink-3)" }}>
              Contact
            </p>
            {customer.apContactName && (
              <p className="text-[13px]" style={{ color: "var(--zn-ink-2)" }}>
                {customer.apContactName}
                {customer.contactRole && <span style={{ color: "var(--zn-ink-3)" }}> · {customer.contactRole}</span>}
              </p>
            )}
            {customer.apEmail ? (
              <a
                href={`mailto:${customer.apEmail}`}
                className="inline-flex items-center gap-1.5 text-[13px]"
                style={{ color: "var(--zn-ink-2)" }}
              >
                <Mail className="size-3.5 shrink-0" style={{ color: "var(--zn-ink-3)" }} />
                {customer.apEmail}
              </a>
            ) : (
              <p className="text-[12.5px]" style={{ color: "var(--zn-risk)" }}>No email on file</p>
            )}
          </div>

          {/* Summary */}
          <div
            className="grid grid-cols-3 gap-3 rounded-xl p-4"
            style={{ background: "var(--zn-surface-2)", border: "1px solid var(--zn-line-soft)" }}
          >
            <div className="text-center">
              <p className="text-[20px] font-semibold tabular-nums" style={{ color: outstanding > 0 ? "var(--zn-risk)" : "var(--zn-ink-3)" }}>
                {outstanding > 0 ? fmtGBP(outstanding) : "—"}
              </p>
              <p className="text-[10.5px] mt-0.5" style={{ color: "var(--zn-ink-3)" }}>Outstanding</p>
            </div>
            <div className="text-center">
              <p className="text-[20px] font-semibold tabular-nums" style={{ color: overdue.length > 0 ? "var(--zn-warn)" : "var(--zn-ink-3)" }}>
                {maxOverdue > 0 ? `${maxOverdue}d` : "—"}
              </p>
              <p className="text-[10.5px] mt-0.5" style={{ color: "var(--zn-ink-3)" }}>Max overdue</p>
            </div>
            <div className="text-center">
              <p className="text-[20px] font-semibold tabular-nums" style={{ color: "var(--zn-ink)" }}>
                {invs.length}
              </p>
              <p className="text-[10.5px] mt-0.5" style={{ color: "var(--zn-ink-3)" }}>Invoices</p>
            </div>
          </div>

          {/* Notes */}
          {customer.customerNotes && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.07em] mb-1.5" style={{ color: "var(--zn-ink-3)" }}>
                Notes
              </p>
              <p className="text-[13px] leading-relaxed" style={{ color: "var(--zn-ink-2)" }}>
                {customer.customerNotes}
              </p>
            </div>
          )}

          {/* Invoice list */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.07em] mb-2" style={{ color: "var(--zn-ink-3)" }}>
              Invoices
            </p>
            <div className="flex flex-col divide-y rounded-xl overflow-hidden" style={{ border: "1px solid var(--zn-line-soft)", borderColor: "var(--zn-line-soft)" }}>
              {invs.length === 0 ? (
                <p className="px-4 py-3 text-[12.5px]" style={{ color: "var(--zn-ink-3)" }}>No invoices</p>
              ) : invs.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between gap-3 px-4 py-3" style={{ borderColor: "var(--zn-line-soft)" }}>
                  <div className="min-w-0">
                    <p className="text-[12.5px] font-medium" style={{ color: "var(--zn-ink)" }}>{inv.invoiceNumber}</p>
                    <p className="text-[11.5px] mt-0.5" style={{ color: "var(--zn-ink-3)" }}>
                      Due {inv.dueDate ?? "—"}
                      {inv.daysOverdue > 0 && <span style={{ color: "var(--zn-risk)" }}> · {inv.daysOverdue}d overdue</span>}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[13px] font-semibold tabular-nums" style={{ color: "var(--zn-ink)" }}>
                      {fmtGBP(inv.amountOutstanding)}
                    </p>
                    <p
                      className="text-[10.5px] mt-0.5"
                      style={{ color: STATUS_COLORS[inv.status as string] ?? "var(--zn-ink-3)" }}
                    >
                      {inv.status}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer CTA */}
        <div
          className="mt-auto px-5 py-4 border-t"
          style={{ borderColor: "var(--zn-line-soft)" }}
        >
          <Link href="/login?mode=signup" className="zn-pill w-full justify-center">
            Import your own data <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </div>
    </>
  );
}

export default function DemoCustomersPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedRow = customerRows.find((r) => r.customer.id === selectedId) ?? null;

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
            {demoCustomers.length} sample customers · sorted by outstanding balance · click any row to view details
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
            const isSelected = selectedId === customer.id;

            return (
              <button
                key={customer.id}
                type="button"
                onClick={() => setSelectedId(isSelected ? null : customer.id)}
                className="w-full text-left grid grid-cols-1 sm:grid-cols-[1fr_auto_auto_auto_120px] gap-2 sm:gap-4 px-5 py-3.5 transition-colors hover:bg-black/[0.025] cursor-pointer"
                style={isSelected ? { background: "var(--zn-surface-2)" } : undefined}
              >
                {/* Name + contact */}
                <div className="min-w-0">
                  <p className="text-[13px] font-medium truncate" style={{ color: "var(--zn-ink)" }}>
                    {customer.name}
                  </p>
                  {customer.apContactName && (
                    <p className="text-[11.5px] mt-0.5 truncate" style={{ color: "var(--zn-ink-3)" }}>
                      {customer.apContactName}
                      {customer.apEmail && ` · ${customer.apEmail}`}
                    </p>
                  )}
                  {!customer.apEmail && (
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
              </button>
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

      {/* Customer detail drawer */}
      <CustomerDrawer row={selectedRow} onClose={() => setSelectedId(null)} />
    </div>
  );
}
