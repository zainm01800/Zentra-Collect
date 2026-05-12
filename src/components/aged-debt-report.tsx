"use client";

/**
 * src/components/aged-debt-report.tsx
 *
 * Client component for the aged debt report.
 * Reads invoices from localStorage, buckets them by days overdue,
 * renders summary cards + full sortable table, and exports to CSV.
 */

import { useEffect, useState } from "react";
import { Download, ArrowUpDown, AlertTriangle } from "lucide-react";
import { readLocalAccount } from "@/lib/demo-auth";
import { importedInvoicesStorageKey } from "@/lib/import/zentra-import";
import { demoInvoices } from "@/lib/demo-data/zentra-demo-data";
import type { Invoice } from "@/types/zentra";

const demoInvoiceStateStorageKey = "zentra.demoInvoiceState.v1";

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

// ── Data loading ──────────────────────────────────────────────────────────────

function loadInvoices(): Invoice[] {
  if (typeof window === "undefined") return [];
  const local = readLocalAccount();
  const isDemo = local?.planId === "demo";
  const key = isDemo ? demoInvoiceStateStorageKey : importedInvoicesStorageKey;
  const fallback = isDemo ? demoInvoices : [];
  const stored = window.localStorage.getItem(key);
  if (!stored) return fallback;
  try {
    const parsed = JSON.parse(stored) as Invoice[];
    return Array.isArray(parsed) ? parsed : fallback;
  } catch { return fallback; }
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

type SortKey = "daysOverdue" | "amount" | "customerName" | "dueDate";

export function AgedDebtReport() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [sortKey, setSortKey]   = useState<SortKey>("daysOverdue");
  const [sortAsc, setSortAsc]   = useState(false);

  useEffect(() => {
    setInvoices(loadInvoices());
  }, []);

  // Only unpaid invoices in the report — handle both "paid" (zentra) and "Paid" (cashpilot demo data)
  const open = invoices.filter(
    (inv) => inv.status?.toLowerCase() !== "paid" && (inv.amountOutstanding ?? inv.amount) > 0,
  );

  // Bucket summaries
  const bucketSummaries = BUCKETS.map((b) => {
    const matches = open.filter((inv) => {
      const d = inv.daysOverdue;
      return d >= b.minDays && (b.maxDays === null || d <= b.maxDays);
    });
    return {
      bucket: b,
      count:  matches.length,
      total:  matches.reduce((s, inv) => s + inv.amount, 0),
    };
  });

  const grandTotal   = open.reduce((s, inv) => s + inv.amount, 0);
  const overdueTotal = open.filter((i) => i.daysOverdue > 0).reduce((s, i) => s + i.amount, 0);

  // Sorted table rows
  const sorted = [...open].sort((a, b) => {
    let cmp = 0;
    if (sortKey === "daysOverdue") cmp = a.daysOverdue - b.daysOverdue;
    else if (sortKey === "amount")       cmp = a.amount - b.amount;
    else if (sortKey === "customerName") cmp = a.customerName.localeCompare(b.customerName);
    else if (sortKey === "dueDate")      cmp = (a.dueDate ?? "").localeCompare(b.dueDate ?? "");
    return sortAsc ? cmp : -cmp;
  });

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc((v) => !v);
    else { setSortKey(key); setSortAsc(false); }
  }

  function SortBtn({ k, label }: { k: SortKey; label: string }) {
    const active = sortKey === k;
    return (
      <button
        type="button"
        onClick={() => toggleSort(k)}
        className="inline-flex items-center gap-1 font-semibold"
        style={{ color: active ? "var(--zn-ink)" : "var(--zn-ink-3)" }}
      >
        {label}
        <ArrowUpDown className="size-2.5" />
      </button>
    );
  }

  return (
    <div className="space-y-6">

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {bucketSummaries.map(({ bucket, count, total }) => (
          <div
            key={bucket.label}
            className="rounded-[12px] px-4 py-4"
            style={{ background: bucket.bgColor, border: `1px solid ${bucket.color}22` }}
          >
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em]" style={{ color: bucket.color }}>
              {bucket.label}
            </p>
            <p className="mt-1.5 text-[22px] font-bold tabular-nums leading-none" style={{ color: bucket.color }}>
              {fmtGBP(total)}
            </p>
            <p className="mt-1 text-[11px]" style={{ color: bucket.color, opacity: 0.75 }}>
              {count} invoice{count === 1 ? "" : "s"}
            </p>
          </div>
        ))}
      </div>

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

      {/* Table */}
      <div className="zn-card overflow-hidden">
        {/* Table header */}
        <div
          className="flex items-center justify-between gap-3 px-5 py-3.5 border-b"
          style={{ borderColor: "var(--zn-line-soft)" }}
        >
          <p className="text-[13px] font-semibold" style={{ color: "var(--zn-ink)" }}>
            {open.length} open invoice{open.length === 1 ? "" : "s"}
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
          <div className="px-5 py-12 text-center flex flex-col items-center gap-3">
            <p className="text-[14px] font-medium" style={{ color: "var(--zn-ink-2)" }}>No open invoices</p>
            <p className="text-[12.5px]" style={{ color: "var(--zn-ink-3)" }}>Import an overdue invoice export to see your aged debt breakdown.</p>
            <a
              href="/import"
              className="zn-pill mt-1"
              style={{ background: "var(--zn-accent)", color: "var(--zn-accent-ink)", fontSize: 12, height: 30 }}
            >
              Import invoices
            </a>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr style={{ background: "var(--zn-bg-2)", borderBottom: "1px solid var(--zn-line-soft)" }}>
                  <th className="px-5 py-2.5 text-[11px]"><SortBtn k="customerName" label="Customer" /></th>
                  <th className="px-5 py-2.5 text-[11px] text-left font-semibold" style={{ color: "var(--zn-ink-3)" }}>Invoice #</th>
                  <th className="px-5 py-2.5 text-[11px]"><SortBtn k="dueDate" label="Due" /></th>
                  <th className="px-5 py-2.5 text-[11px]"><SortBtn k="daysOverdue" label="Days" /></th>
                  <th className="px-5 py-2.5 text-[11px] text-left font-semibold" style={{ color: "var(--zn-ink-3)" }}>Bucket</th>
                  <th className="px-5 py-2.5 text-[11px] text-right"><SortBtn k="amount" label="Amount" /></th>
                  <th className="px-5 py-2.5 text-[11px] text-left font-semibold" style={{ color: "var(--zn-ink-3)" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((inv, idx) => {
                  const bucket = getBucket(inv.daysOverdue);
                  const isOverdue = inv.daysOverdue > 0;
                  return (
                    <tr
                      key={inv.id}
                      style={{
                        borderTop: idx === 0 ? "none" : "1px solid var(--zn-line-soft)",
                        background: "var(--zn-surface)",
                      }}
                    >
                      <td className="px-5 py-3 text-[13px] font-medium max-w-[180px] truncate" style={{ color: "var(--zn-ink)" }}>
                        {inv.customerName}
                      </td>
                      <td className="px-5 py-3 text-[12px] font-mono" style={{ color: "var(--zn-ink-2)" }}>
                        {inv.invoiceNumber}
                      </td>
                      <td className="px-5 py-3 text-[12.5px]" style={{ color: "var(--zn-ink-2)" }}>
                        {fmtDate(inv.dueDate)}
                      </td>
                      <td className="px-5 py-3 text-[12.5px] font-semibold tabular-nums" style={{ color: isOverdue ? bucket.color : "var(--zn-ink-3)" }}>
                        {isOverdue ? `${inv.daysOverdue}d` : "Current"}
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className="inline-block rounded-full px-2 py-0.5 text-[10.5px] font-semibold"
                          style={{ background: bucket.bgColor, color: bucket.color }}
                        >
                          {bucket.label}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-[13px] font-semibold tabular-nums text-right" style={{ color: "var(--zn-ink)" }}>
                        {fmtGBP(inv.amount)}
                      </td>
                      <td className="px-5 py-3 text-[12px]" style={{ color: "var(--zn-ink-3)" }}>
                        {humaniseStatus(inv.status)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
