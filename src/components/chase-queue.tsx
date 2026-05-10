"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Plus, Search } from "lucide-react";
import { CustomerProfileDrawer } from "@/components/customer-profile-drawer";
import { AddInvoiceDrawer } from "@/components/add-invoice-drawer";
import { useReview, statusForOutcome, type ReviewOutcome } from "@/components/review-context";
import {
  filterInvoices,
  getInvoiceUrgency,
  getRiskLabels,
  getSuggestedAction,
  invoiceNeedsActionToday,
  sortInvoicesByPriority,
  type QueueFilter,
} from "@/lib/invoice-logic";
import { formatCurrency, formatDate } from "@/lib/formatters";
import type { Invoice } from "@/types/cashpilot";

const RISK_FOR_DAYS = (d: number): "low" | "med" | "high" =>
  d > 60 ? "high" : d > 30 ? "med" : "low";

export function ChaseQueue({
  initialInvoices,
  onlyToday = true,
}: {
  initialInvoices: Invoice[];
  onlyToday?: boolean;
}) {
  const [invoices, setInvoices] = useState(initialInvoices);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<QueueFilter>(onlyToday ? "today" : "all");
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);
  const [customerDrawerOpen, setCustomerDrawerOpen] = useState(false);
  const [addDrawerOpen, setAddDrawerOpen] = useState(false);
  const review = useReview();
  const searchParams = useSearchParams();
  const autoOpenedRef = useRef(false);

  // Deep-link: ?customer=Name auto-opens that customer's most pressing invoice.
  // Used by dashboard Top 5 / Top 3 buttons.
  useEffect(() => {
    if (autoOpenedRef.current) return;
    const customer = searchParams?.get("customer");
    if (!customer) return;
    setFilter("all");
    setQuery(customer);
    const match = invoices
      .filter(
        (i) =>
          i.customerName.toLowerCase().includes(customer.toLowerCase()) &&
          i.status !== "Paid",
      )
      .sort((a, b) => (b.daysOverdue ?? 0) - (a.daysOverdue ?? 0))[0];
    if (match) {
      review.open(match);
      autoOpenedRef.current = true;
    }
  }, [searchParams, invoices, review]);

  // Wire the drawer's "Record outcome" buttons → update the queue
  useEffect(() => {
    review.registerOnOutcome((invoiceId: string, outcome: ReviewOutcome) => {
      const nextStatus = statusForOutcome(outcome);
      setInvoices((current) =>
        current.map((inv) => {
          if (inv.id !== invoiceId) return inv;
          const activityEntry = {
            id: `act-${invoiceId}-${Date.now()}`,
            type:
              outcome === "paid"     ? "paid" as const :
              outcome === "promised" ? "promised_payment" as const :
              outcome === "dispute"  ? "dispute_logged" as const :
              outcome === "snooze"   ? "note" as const :
                                       "reminder_sent" as const,
            title:
              outcome === "paid"     ? "Marked paid" :
              outcome === "promised" ? "Promise to pay logged" :
              outcome === "dispute"  ? "Dispute raised" :
              outcome === "snooze"   ? "Snoozed" :
                                       "Reminder sent",
            description: `Recorded via review drawer.`,
            createdAt: new Date().toISOString(),
          };
          return {
            ...inv,
            status: nextStatus ?? inv.status,
            chaseCount: outcome === "sent" ? inv.chaseCount + 1 : inv.chaseCount,
            lastChasedAt: outcome === "sent" ? new Date().toISOString() : inv.lastChasedAt,
            activityHistory: [activityEntry, ...inv.activityHistory],
          };
        }),
      );
    });
  }, [review]);

  // Keyboard navigation: j = next, k = prev, Enter = open, / = focus search
  const [highlightedIdx, setHighlightedIdx] = useState(0);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't hijack typing in inputs / textareas
      const target = e.target as HTMLElement | null;
      if (target && (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      )) {
        // Allow Esc to clear focus
        if (e.key === "Escape") (target as HTMLElement).blur();
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightedIdx((i) => Math.min(queue.length - 1, i + 1));
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightedIdx((i) => Math.max(0, i - 1));
      } else if (e.key === "Enter") {
        const inv = queue[highlightedIdx];
        if (inv) {
          e.preventDefault();
          openInvoice(inv);
        }
      } else if (e.key === "/") {
        e.preventDefault();
        const search = document.querySelector<HTMLInputElement>(
          'input[placeholder^="Search customer"]',
        );
        search?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightedIdx]);

  const queue = useMemo(() => {
    return sortInvoicesByPriority(
      filterInvoices(invoices, filter).filter((invoice) => {
        const matchesToday =
          onlyToday && filter === "today" ? invoiceNeedsActionToday(invoice) : true;
        const q = query.toLowerCase().trim();
        const matchesQuery =
          !q ||
          invoice.customerName.toLowerCase().includes(q) ||
          invoice.invoiceNumber.toLowerCase().includes(q);
        return matchesToday && matchesQuery;
      }),
    );
  }, [filter, invoices, onlyToday, query]);

  const tabs: { label: string; value: QueueFilter; count: number }[] = [
    { label: "Today",     value: "today",    count: filterInvoices(invoices, "today").length },
    { label: "All open",  value: "all",      count: filterInvoices(invoices, "all").length },
    { label: "Calls",     value: "calls",    count: filterInvoices(invoices, "calls").length },
    { label: "Promises",  value: "promises", count: filterInvoices(invoices, "promises").length },
    { label: "Disputes",  value: "disputes", count: filterInvoices(invoices, "disputes").length },
    { label: "Final",     value: "final",    count: filterInvoices(invoices, "final").length },
    { label: "Paid",      value: "paid",     count: filterInvoices(invoices, "paid").length },
  ];

  const totalAmount = queue.reduce((s, i) => s + i.amount, 0);

  function openInvoice(invoice: Invoice) {
    setCustomerDrawerOpen(false);
    review.open(invoice);
  }
  function openCustomer(customerName: string) {
    review.close();
    setSelectedCustomer(customerName);
    setCustomerDrawerOpen(true);
  }
  function addInvoice(invoice: Invoice) {
    setInvoices((current) => [invoice, ...current]);
    setFilter("today");
    review.open(invoice);
  }

  return (
    <div className="flex flex-col gap-4">

      {/* Search + sort row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative max-w-[360px] flex-1 min-w-[260px]">
          <Search
            className="absolute left-[11px] top-1/2 size-4 -translate-y-1/2"
            style={{ color: "var(--zn-ink-3)" }}
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search customer, invoice ref..."
            className="w-full rounded-[10px] border py-[9px] pl-[34px] pr-3 text-[13px] outline-none transition-colors"
            style={{
              background: "var(--zn-surface)",
              borderColor: "var(--zn-line)",
              color: "var(--zn-ink)",
            }}
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setAddDrawerOpen(true)}
            className="zn-pill"
          >
            <Plus className="size-3.5" /> Add invoice
          </button>
        </div>
      </div>

      {/* Card containing tabs (full-width header strip) + table */}
      <div className="zn-card p-0 overflow-hidden">

        {/* Integrated tabs strip — scrolls horizontally on narrow viewports */}
        <div
          className="flex overflow-x-auto"
          style={{
            borderBottom: "1px solid var(--zn-line)",
            padding: "0 4px",
          }}
        >
          {tabs.map((t) => {
            const active = filter === t.value;
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => setFilter(t.value)}
                aria-selected={active}
                className="zn-tab justify-center flex-shrink-0"
                style={{ padding: "14px 14px", minWidth: 96 }}
              >
                {t.label}
                <span className="zn-count">{t.count}</span>
              </button>
            );
          })}
        </div>

        {/* Table — scrolls horizontally on narrow viewports so columns never overlap */}
        <div className="overflow-x-auto">
        <table
          className="border-collapse"
          style={{ tableLayout: "fixed", width: "100%", minWidth: 880 }}
        >
          <thead>
            <tr>
              <th className="zn-label text-left" style={{ width: 44, padding: "12px 22px" }}></th>
              <th className="zn-label text-left" style={{ padding: "12px 10px" }}>Customer</th>
              <th className="zn-label text-left" style={{ width: 110, padding: "12px 10px" }}>Amount</th>
              <th className="zn-label text-left" style={{ width: 120, padding: "12px 10px" }}>Due</th>
              <th className="zn-label text-left" style={{ width: 90, padding: "12px 10px" }}>Overdue</th>
              <th className="zn-label text-left" style={{ width: 200, padding: "12px 10px" }}>Recommended action</th>
              <th className="zn-label text-left" style={{ width: 110, padding: "12px 10px" }}>Risk</th>
              <th className="zn-label text-left" style={{ width: 110, padding: "12px 22px" }}></th>
            </tr>
          </thead>
          <tbody>
            {queue.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="text-center text-[13px]"
                  style={{ padding: "40px 22px", color: "var(--zn-ink-3)" }}
                >
                  No invoices match this view.
                </td>
              </tr>
            ) : (
              queue.map((inv, idx) => {
                const urgency = getInvoiceUrgency(inv);
                const action = getSuggestedAction(inv);
                const risks = getRiskLabels(inv);
                const riskLevel = RISK_FOR_DAYS(inv.daysOverdue);
                const overdueColor =
                  inv.daysOverdue > 60 ? "var(--zn-risk)" :
                  inv.daysOverdue > 30 ? "var(--zn-warn)" :
                                         "var(--zn-ink-2)";
                const isHighlighted = idx === highlightedIdx;
                return (
                  <tr
                    key={inv.id}
                    onClick={() => openInvoice(inv)}
                    onMouseEnter={() => setHighlightedIdx(idx)}
                    className="transition-colors cursor-pointer hover:bg-[#f3ecd8]"
                    style={{
                      borderTop: "1px solid var(--zn-line-soft)",
                      background: isHighlighted ? "var(--zn-surface-2)" : undefined,
                      boxShadow: isHighlighted
                        ? "inset 3px 0 0 var(--zn-accent)"
                        : undefined,
                    }}
                  >
                    {/* # (serif italic) */}
                    <td
                      className="text-[14px] italic"
                      style={{
                        padding: "14px 22px",
                        color: "var(--zn-ink-3)",
                        fontFamily: "var(--font-newsreader), ui-serif, Georgia, serif",
                      }}
                    >
                      {idx + 1}
                    </td>

                    {/* Customer + ref */}
                    <td style={{ padding: "14px 10px" }}>
                      <div className="flex flex-col">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openCustomer(inv.customerName);
                          }}
                          className="text-[13.5px] font-semibold text-left text-[#1d1813] hover:underline truncate"
                          style={{ background: "transparent", border: 0, padding: 0 }}
                        >
                          {inv.customerName}
                        </button>
                        <span className="zn-kind-tag mt-0.5">{inv.invoiceNumber}</span>
                      </div>
                    </td>

                    {/* Amount */}
                    <td
                      className="text-[13px] font-medium tabular-nums"
                      style={{ padding: "14px 10px", color: "var(--zn-ink)" }}
                    >
                      {formatCurrency(inv.amount)}
                    </td>

                    {/* Due date */}
                    <td
                      className="text-[12.5px] truncate"
                      style={{ padding: "14px 10px", color: "var(--zn-ink-3)" }}
                    >
                      {formatDate(inv.dueDate)}
                    </td>

                    {/* Overdue */}
                    <td style={{ padding: "14px 10px" }}>
                      {inv.daysOverdue > 0 ? (
                        <span
                          className="text-[12.5px] font-semibold tabular-nums"
                          style={{ color: overdueColor }}
                        >
                          {inv.daysOverdue}d
                        </span>
                      ) : (
                        <span className="text-[12px]" style={{ color: "var(--zn-ink-3)" }}>
                          not due
                        </span>
                      )}
                    </td>

                    {/* Action */}
                    <td style={{ padding: "14px 10px" }}>
                      <div className="flex items-center gap-2">
                        <span
                          className="text-[13px] truncate"
                          style={{ color: "var(--zn-ink-2)" }}
                        >
                          {action}
                        </span>
                      </div>
                      {risks.length > 0 ? (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {risks.slice(0, 2).map((r) => (
                            <span key={r} className="zn-kind-tag" style={{ fontSize: 9.5 }}>
                              {r}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </td>

                    {/* Risk chip */}
                    <td style={{ padding: "14px 10px" }}>
                      <span
                        className={`zn-risk-chip ${
                          urgency === "Critical" || urgency === "Blocked"
                            ? "zn-risk-high"
                            : urgency === "High"
                            ? "zn-risk-med"
                            : urgency === "Medium"
                            ? "zn-risk-med"
                            : "zn-risk-low"
                        }`}
                      >
                        <span className="zn-risk-dot" />
                        {urgency}
                      </span>
                    </td>

                    {/* Review button */}
                    <td style={{ padding: "14px 22px" }}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openInvoice(inv);
                        }}
                        className="zn-pill zn-pill-ghost"
                        style={{ height: 26, fontSize: 12, padding: "0 11px" }}
                      >
                        Review
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        </div>
      </div>

      {/* Footer: count + total */}
      <div
        className="flex items-center justify-between text-[12px]"
        style={{ color: "var(--zn-ink-3)" }}
      >
        <div>
          {queue.length} invoice{queue.length === 1 ? "" : "s"} · {formatCurrency(totalAmount)} outstanding
        </div>
        <div className="flex items-center gap-2">
          <span style={{ fontFamily: "var(--font-geist-mono), ui-monospace, monospace" }}>↑↓</span>
          <span>navigate</span>
          <span>·</span>
          <span style={{ fontFamily: "var(--font-geist-mono), ui-monospace, monospace" }}>⏎</span>
          <span>review</span>
        </div>
      </div>

      <CustomerProfileDrawer
        customerName={selectedCustomer}
        invoices={invoices}
        open={customerDrawerOpen}
        onOpenChange={setCustomerDrawerOpen}
        onOpenInvoice={openInvoice}
      />
      <AddInvoiceDrawer
        open={addDrawerOpen}
        onOpenChange={setAddDrawerOpen}
        onAddInvoice={addInvoice}
      />
    </div>
  );
}
