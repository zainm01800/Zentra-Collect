"use client";

/**
 * Invoices hub — Stage 2 of the audit consolidation.
 *
 * Absorbs the old separate /invoices/new and /import nav entries into a
 * single surface with three tabs (Open · Paid · Drafts) and primary
 * actions ("+ New invoice", "Import") in the top toolbar.
 *
 * Reads invoice data from the same localStorage keys the rest of the
 * app uses — single-business plans hit zentra.importedInvoices.v1; the
 * bookkeeper switcher honours the per-client key when active.
 *
 * Click any row → opens the existing action drawer flow at /chase-today
 * with that customer pre-selected (deep-link supported by chase queue).
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpFromLine, Plus, Search, Landmark } from "lucide-react";
import { NewInvoiceForm } from "@/app/invoices/new/form";
import { readInvoices, subscribeToInvoiceChanges } from "@/lib/invoice-store";
import { RecurringInvoices } from "@/components/recurring-invoices";
import type { Invoice as ZentraInvoice } from "@/types/zentra";

type Tab = "open" | "paid" | "drafts";

function fmtGBP(n: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency", currency: "GBP",
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(n);
}

function fmtDate(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function statusBucket(inv: ZentraInvoice): Tab {
  if (inv.status === "paid" || inv.amountOutstanding <= 0) return "paid";
  // Drafts aren't a formal status in the schema yet, but anything in
  // queueStatus === "draft" or with no invoice number is a stub.
  if (inv.queueStatus === "draft" as ZentraInvoice["queueStatus"]
      || !inv.invoiceNumber || inv.invoiceNumber.startsWith("DRAFT-")) {
    return "drafts";
  }
  return "open";
}

interface InvoicesHubProps {
  initialTab:  Tab;
  openCreate?: boolean;
}

export function InvoicesHub({ initialTab, openCreate }: InvoicesHubProps) {
  const router = useRouter();
  const [tab, setTab]           = useState<Tab>(initialTab);
  const [invoices, setInvoices] = useState<ZentraInvoice[]>([]);
  const [query, setQuery]       = useState("");
  const [creating, setCreating] = useState(Boolean(openCreate));

  useEffect(() => {
    setInvoices(readInvoices() as ZentraInvoice[]);
    return subscribeToInvoiceChanges(() => setInvoices(readInvoices() as ZentraInvoice[]));
  }, []);

  const groups = useMemo(() => {
    const buckets: Record<Tab, ZentraInvoice[]> = { open: [], paid: [], drafts: [] };
    for (const inv of invoices) {
      buckets[statusBucket(inv)].push(inv);
    }
    return buckets;
  }, [invoices]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return groups[tab];
    return groups[tab].filter((inv) =>
      inv.customerName.toLowerCase().includes(q)
      || inv.invoiceNumber.toLowerCase().includes(q),
    );
  }, [groups, tab, query]);

  function selectTab(next: Tab) {
    setTab(next);
    router.replace(`/invoices?tab=${next}`, { scroll: false });
  }

  // ── Create-invoice sheet — reuses the existing /invoices/new form ─────
  if (creating) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              setCreating(false);
              router.replace("/invoices", { scroll: false });
            }}
            className="text-[13px] font-medium underline"
            style={{ color: "var(--zn-ink-3)" }}
          >
            ← Back to invoices
          </button>
        </div>
        <NewInvoiceForm />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5" style={{ color: "var(--zn-ink-3)" }} />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search customer or invoice number"
              className="w-full pl-9 pr-3 py-2 text-[13.5px] rounded-lg border bg-white"
              style={{ borderColor: "var(--zn-line)" }}
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/import"
            className="inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[12.5px] font-medium hover:bg-[var(--zn-surface-2)]"
            style={{ borderColor: "var(--zn-line)", color: "var(--zn-ink-2)" }}
          >
            <ArrowUpFromLine className="size-3.5" />
            Import
          </Link>
          <button
            type="button"
            onClick={() => {
              setCreating(true);
              router.replace("/invoices?create=1", { scroll: false });
            }}
            className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-semibold"
            style={{ background: "var(--zn-ink)", color: "var(--zn-bg)" }}
          >
            <Plus className="size-3.5" />
            New invoice
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b" style={{ borderColor: "var(--zn-line-soft)" }}>
        {(["open", "paid", "drafts"] as const).map((t) => {
          const isActive = tab === t;
          const count = groups[t].length;
          const label = t === "open" ? "Open" : t === "paid" ? "Paid" : "Drafts";
          return (
            <button
              key={t}
              type="button"
              onClick={() => selectTab(t)}
              className="relative px-4 py-2.5 text-[13px] font-medium transition-colors"
              style={{
                color: isActive ? "var(--zn-ink)" : "var(--zn-ink-3)",
              }}
            >
              {label}
              <span className="ml-1.5 text-[11.5px]" style={{ color: "var(--zn-ink-3)" }}>
                {count}
              </span>
              {isActive && (
                <span
                  className="absolute left-0 right-0 -bottom-px h-[2px]"
                  style={{ background: "var(--zn-ink)" }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Recurring invoice templates */}
      <RecurringInvoices />

      {/* Bank matching prompt — shown on open tab when overdue invoices exist */}
      {tab === "open" && groups.open.some((inv) => (inv.daysOverdue ?? 0) > 0) && (
        <Link
          href="/banking"
          className="flex items-center gap-3 rounded-xl px-4 py-3 transition-colors hover:opacity-90"
          style={{ background: "var(--zn-surface-2)", border: "1px solid var(--zn-line-soft)" }}
        >
          <div
            className="flex size-8 shrink-0 items-center justify-center rounded-lg"
            style={{ background: "var(--zn-surface)", color: "var(--zn-ink-2)" }}
          >
            <Landmark className="size-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold" style={{ color: "var(--zn-ink)" }}>
              Match bank payments to invoices
            </p>
            <p className="text-[12px]" style={{ color: "var(--zn-ink-3)" }}>
              Connect your bank or upload a statement CSV to auto-identify which invoices have been paid.
            </p>
          </div>
          <span className="text-[12px] shrink-0" style={{ color: "var(--zn-ink-3)" }}>Go →</span>
        </Link>
      )}

      {/* List */}
      {filtered.length === 0 ? (
        <EmptyState tab={tab} onCreate={() => { setCreating(true); router.replace("/invoices?create=1", { scroll: false }); }} />
      ) : (
        <div
          className="rounded-xl overflow-hidden"
          style={{ background: "var(--zn-surface)", border: "1px solid var(--zn-line-soft)" }}
        >
          <div
            className="hidden sm:grid grid-cols-[1fr_120px_120px_120px_80px] gap-3 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider"
            style={{ background: "var(--zn-bg-2)", color: "var(--zn-ink-3)" }}
          >
            <span>Customer / number</span>
            <span>Due</span>
            <span className="text-right">Amount</span>
            <span>Status</span>
            <span></span>
          </div>
          <div className="divide-y" style={{ borderColor: "var(--zn-line-soft)" }}>
            {filtered.map((inv) => {
              const overdue = (inv.daysOverdue ?? 0) > 0;
              return (
                <Link
                  key={inv.id}
                  href={`/chase-today?customer=${encodeURIComponent(inv.customerName)}`}
                  className="grid grid-cols-1 sm:grid-cols-[1fr_120px_120px_120px_80px] gap-2 sm:gap-3 px-4 py-3 hover:bg-[var(--zn-surface-2)] transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-[13.5px] font-medium truncate" style={{ color: "var(--zn-ink)" }}>
                      {inv.customerName}
                    </p>
                    <p className="text-[11.5px] font-mono mt-0.5" style={{ color: "var(--zn-ink-3)" }}>
                      {inv.invoiceNumber}
                    </p>
                  </div>
                  <div className="text-[12.5px]" style={{ color: overdue ? "var(--zn-risk)" : "var(--zn-ink-2)" }}>
                    {fmtDate(inv.dueDate)}
                    {overdue && <span className="block text-[11px] font-semibold">{inv.daysOverdue}d overdue</span>}
                  </div>
                  <div className="text-right text-[13px] font-medium tabular-nums" style={{ color: "var(--zn-ink)" }}>
                    {fmtGBP(inv.amountOutstanding > 0 ? inv.amountOutstanding : inv.amount)}
                  </div>
                  <div>
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-semibold uppercase tracking-wide"
                      style={{
                        background: tab === "paid"
                          ? "var(--zn-safe-soft)"
                          : tab === "drafts"
                            ? "var(--zn-bg-2)"
                            : overdue
                              ? "var(--zn-risk-soft)"
                              : "var(--zn-warn-soft)",
                        color: tab === "paid"
                          ? "var(--zn-safe)"
                          : tab === "drafts"
                            ? "var(--zn-ink-3)"
                            : overdue
                              ? "var(--zn-risk)"
                              : "var(--zn-warn)",
                      }}
                    >
                      {tab === "paid" ? "Paid" : tab === "drafts" ? "Draft" : overdue ? "Overdue" : "Open"}
                    </span>
                  </div>
                  <div className="text-right text-[12px]" style={{ color: "var(--zn-ink-3)" }}>
                    Open →
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyState({ tab, onCreate }: { tab: Tab; onCreate: () => void }) {
  const copy = {
    open:   "No open invoices.",
    paid:   "No paid invoices yet.",
    drafts: "No drafts saved.",
  };
  return (
    <div
      className="rounded-xl p-8 text-center"
      style={{ background: "var(--zn-surface)", border: "1px solid var(--zn-line-soft)" }}
    >
      <p className="text-[14px] font-semibold mb-1" style={{ color: "var(--zn-ink)" }}>
        {copy[tab]}
      </p>
      <p className="text-[12.5px] mb-4" style={{ color: "var(--zn-ink-3)" }}>
        Create one from scratch or import an AR ageing export.
      </p>
      <div className="flex items-center justify-center gap-2">
        <button
          type="button"
          onClick={onCreate}
          className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-semibold"
          style={{ background: "var(--zn-ink)", color: "var(--zn-bg)" }}
        >
          <Plus className="size-3.5" />
          New invoice
        </button>
        <Link
          href="/import"
          className="inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-[13px] font-medium"
          style={{ borderColor: "var(--zn-line)", color: "var(--zn-ink-2)" }}
        >
          Import a CSV
        </Link>
      </div>
    </div>
  );
}
