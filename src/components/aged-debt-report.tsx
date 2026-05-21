"use client";

/**
 * src/components/aged-debt-report.tsx
 *
 * Client component for the aged debt report.
 * Reads invoices from localStorage, buckets them by days overdue,
 * renders summary cards + full sortable table, and exports to CSV.
 */

import { useEffect, useState } from "react";
import { Download, AlertTriangle } from "lucide-react";
import { readInvoices, subscribeToInvoiceChanges } from "@/lib/invoice-store";
import type { Invoice } from "@/types/zentra";

// ── Buckets ───────────────────────────────────────────────────────────────────

export interface AgedBucket {
  label:    string;
  minDays:  number;
  maxDays:  number | null;  // null = unbounded
  color:    string;
  bgColor:  string;
}

const BUCKETS: AgedBucket[] = [
  { label: "Current",    minDays: -Infinity, maxDays: 0,  color: "var(--zn-ink-3)",  bgColor: "var(--zn-surface-2)" },
  { label: "1–30 days",  minDays: 1,         maxDays: 30, color: "var(--zn-warn)",    bgColor: "var(--zn-warn-soft)" },
  { label: "31–60 days", minDays: 31,        maxDays: 60, color: "var(--zn-risk)",    bgColor: "var(--zn-risk-soft)" },
  { label: "61–90 days", minDays: 61,        maxDays: 90, color: "var(--zn-risk)",    bgColor: "var(--zn-risk-soft)" },
  { label: "90+ days",   minDays: 91,        maxDays: null, color: "var(--zn-risk)",  bgColor: "var(--zn-risk-soft)" },
];

const STATUS_LABELS: Record<string, string> = {
  overdue:          "Overdue",
  current:          "Current",
  paid:             "Paid",
  disputed:         "Disputed",
  promised:         "Promised",
  do_not_chase:     "Don't chase",
  missed_promise:   "Missed promise",
  needs_ap_contact: "Needs AP contact",
  escalation:       "Escalation",
  written_off:      "Written off",
};

function humaniseStatus(status: string | null | undefined): string {
  if (!status) return "—";
  return STATUS_LABELS[status.toLowerCase()] ?? status;
}

function getBucket(daysOverdue: number): AgedBucket {
  for (const b of BUCKETS) {
    const inBucket = daysOverdue >= b.minDays && (b.maxDays === null || daysOverdue <= b.maxDays);
    if (inBucket) return b;
  }
  return BUCKETS[0];
}

// ── Formatters ────────────────────────────────────────────────────────────────

function fmtGBP(n: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}


// ── CSV export ────────────────────────────────────────────────────────────────

function exportCSV(invoices: Invoice[]) {
  const rows = [
    ["Customer", "Invoice #", "Issue Date", "Due Date", "Days Overdue", "Bucket", "Amount (£)", "Status"],
    ...invoices.map((inv) => {
      const bucket = getBucket(inv.daysOverdue);
      return [
        inv.customerName,
        inv.invoiceNumber,
        inv.invoiceDate,
        inv.dueDate,
        Math.max(0, inv.daysOverdue).toString(),
        bucket.label,
        inv.amount.toFixed(2),
        inv.status,
      ];
    }),
  ];

  const csv =
    "﻿" +  // UTF-8 BOM for Excel
    rows
      .map((r) =>
        r.map((cell) => {
          const s = String(cell ?? "");
          return s.includes(",") || s.includes('"') || s.includes("\n")
            ? `"${s.replace(/"/g, '""')}"` : s;
        }).join(","),
      )
      .join("\r\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `aged-debt-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Component ─────────────────────────────────────────────────────────────────

export function AgedDebtReport() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);

  useEffect(() => {
    setInvoices(readInvoices());
    return subscribeToInvoiceChanges(() => setInvoices(readInvoices()));
  }, []);

  // Only unpaid invoices in the report — handle both "paid" (zentra) and "Paid" (cashpilot demo data)
  const open = invoices.filter(
    (inv) => inv.status?.toLowerCase() !== "paid" && (inv.amountOutstanding ?? inv.amount) > 0,
  );

  const grandTotal   = open.reduce((s, inv) => s + inv.amount, 0);
  const overdueTotal = open.filter((i) => i.daysOverdue > 0).reduce((s, i) => s + i.amount, 0);

  const oldestDays  = open.length > 0 ? Math.max(...open.map((i) => i.daysOverdue)) : 0;
  const overdueCount = open.filter((i) => i.daysOverdue > 0).length;

  // Group open invoices by customer name, sorted by total descending
  const customerMap = open.reduce<Record<string, { name: string; invoices: Invoice[] }>>((acc, inv) => {
    const name = inv.customerName;
    if (!acc[name]) acc[name] = { name, invoices: [] };
    acc[name].invoices.push(inv);
    return acc;
  }, {});
  const customers = Object.values(customerMap).sort((a, b) =>
    b.invoices.reduce((s, i) => s + i.amount, 0) - a.invoices.reduce((s, i) => s + i.amount, 0)
  );

  return (
    <div className="space-y-6">

      {/* Top-line KPI strip — matches demo layout */}
      {open.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Total outstanding", value: fmtGBP(grandTotal),   sub: `${open.length} invoice${open.length === 1 ? "" : "s"}`, color: "var(--zn-ink)" },
            { label: "Overdue amount",    value: fmtGBP(overdueTotal),  sub: `${overdueCount} overdue invoice${overdueCount === 1 ? "" : "s"}`, color: "var(--zn-risk)" },
            { label: "Overdue invoices",  value: String(overdueCount),  sub: "Open and past due", color: overdueCount > 0 ? "var(--zn-risk)" : "var(--zn-ink)" },
            { label: "Oldest invoice",    value: oldestDays > 0 ? `${oldestDays} days` : "—", sub: "Days outstanding", color: oldestDays > 90 ? "var(--zn-risk)" : oldestDays > 30 ? "var(--zn-warn)" : "var(--zn-ink)" },
          ].map(({ label, value, sub, color }) => (
            <div key={label} className="rounded-[12px] px-4 py-4" style={{ background: "var(--zn-surface)", border: "1px solid var(--zn-line-soft)" }}>
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--zn-ink-3)" }}>{label}</p>
              <p className="mt-1.5 text-[22px] font-bold tabular-nums leading-none" style={{ color }}>{value}</p>
              <p className="mt-1 text-[11px]" style={{ color: "var(--zn-ink-3)" }}>{sub}</p>
            </div>
          ))}
        </div>
      )}

      {/* Overdue summary strip */}
      {overdueTotal > 0 && (
        <div
          className="flex items-center gap-3 rounded-[10px] px-4 py-3"
          style={{ background: "var(--zn-warn-soft)", border: "1px solid var(--zn-warn)" }}
        >
          <AlertTriangle className="size-4 flex-shrink-0" style={{ color: "var(--zn-warn)" }} />
          <p className="text-[13px] font-medium" style={{ color: "var(--zn-warn)" }}>
            {fmtGBP(overdueTotal)} overdue across {open.filter((i) => i.daysOverdue > 0).length} invoices
            &nbsp;·&nbsp;
            {fmtGBP(grandTotal)} total open balance
          </p>
        </div>
      )}

      {/* Customer aging matrix */}
      <div className="zn-card overflow-hidden">
        {/* Table header row */}
        <div
          className="flex items-center justify-between gap-3 px-5 py-3.5"
          style={{ borderBottom: "1px solid var(--zn-line-soft)" }}
        >
          <p className="text-[13px] font-semibold" style={{ color: "var(--zn-ink)" }}>
            Aging analysis · {customers.length} customer{customers.length === 1 ? "" : "s"}
          </p>
          <button
            type="button"
            onClick={() => exportCSV(open)}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium border transition-colors hover:bg-[#ece3cc] dark:hover:bg-[#28231c]"
            style={{ borderColor: "var(--zn-line)", color: "var(--zn-ink-2)" }}
          >
            <Download className="size-3" />
            Export CSV
          </button>
        </div>

        {open.length === 0 ? (
          /* empty state */
          <div className="px-5 py-12 text-center flex flex-col items-center gap-3">
            <p className="text-[14px] font-medium" style={{ color: "var(--zn-ink-2)" }}>No open invoices</p>
            <p className="text-[12.5px]" style={{ color: "var(--zn-ink-3)" }}>Import an overdue invoice export to see your aged debt breakdown.</p>
            <a href="/import" className="zn-pill mt-1" style={{ background: "var(--zn-accent)", color: "var(--zn-accent-ink)", fontSize: 12, height: 30 }}>
              Import invoices
            </a>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr style={{ background: "var(--zn-bg-2)", borderBottom: "1px solid var(--zn-line-soft)" }}>
                  <th className="px-5 py-2.5 text-[11px] font-semibold text-left" style={{ color: "var(--zn-ink-3)" }}>Customer</th>
                  {BUCKETS.map((b) => (
                    <th key={b.label} className="px-4 py-2.5 text-[11px] font-semibold text-right whitespace-nowrap" style={{ color: b.minDays > 0 ? b.color : "var(--zn-ink-3)" }}>
                      {b.label}
                    </th>
                  ))}
                  <th className="px-5 py-2.5 text-[11px] font-semibold text-right" style={{ color: "var(--zn-ink-3)" }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((cust, i) => {
                  const custTotal = cust.invoices.reduce((s, inv) => s + inv.amount, 0);
                  return (
                    <tr key={cust.name} style={{ borderTop: i === 0 ? "none" : "1px solid var(--zn-line-soft)", background: "var(--zn-surface)" }}>
                      <td className="px-5 py-3 text-[13px] font-medium" style={{ color: "var(--zn-ink)" }}>
                        <div>{cust.name}</div>
                        <div className="text-[11px] mt-0.5" style={{ color: "var(--zn-ink-3)" }}>
                          {cust.invoices.length} invoice{cust.invoices.length === 1 ? "" : "s"}
                        </div>
                      </td>
                      {BUCKETS.map((b) => {
                        const amt = cust.invoices
                          .filter(inv => inv.daysOverdue >= b.minDays && (b.maxDays === null || inv.daysOverdue <= b.maxDays))
                          .reduce((s, inv) => s + inv.amount, 0);
                        return (
                          <td key={b.label} className="px-4 py-3 text-[12.5px] text-right tabular-nums font-medium"
                              style={{ color: amt > 0 ? (b.minDays > 0 ? b.color : "var(--zn-ink)") : "var(--zn-ink-3)" }}>
                            {amt > 0 ? fmtGBP(amt) : "—"}
                          </td>
                        );
                      })}
                      <td className="px-5 py-3 text-[13px] font-semibold tabular-nums text-right" style={{ color: "var(--zn-ink)" }}>
                        {fmtGBP(custTotal)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: "2px solid var(--zn-line-soft)", background: "var(--zn-surface-2)" }}>
                  <td className="px-5 py-3 text-[13px] font-bold" style={{ color: "var(--zn-ink)" }}>Total</td>
                  {BUCKETS.map((b) => {
                    const total = open
                      .filter(inv => inv.daysOverdue >= b.minDays && (b.maxDays === null || inv.daysOverdue <= b.maxDays))
                      .reduce((s, inv) => s + inv.amount, 0);
                    return (
                      <td key={b.label} className="px-4 py-3 text-[12.5px] font-bold tabular-nums text-right"
                          style={{ color: total > 0 ? (b.minDays > 0 ? b.color : "var(--zn-ink)") : "var(--zn-ink-3)" }}>
                        {total > 0 ? fmtGBP(total) : "—"}
                      </td>
                    );
                  })}
                  <td className="px-5 py-3 text-[13px] font-bold tabular-nums text-right" style={{ color: "var(--zn-ink)" }}>
                    {fmtGBP(grandTotal)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
