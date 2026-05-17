"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Plus, Search, Volume2, VolumeX } from "lucide-react";
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
import { freeSlot, readWaitingInvoices } from "@/lib/collections/queue-engine";
import { computeCustomerRiskMap } from "@/lib/risk-score";
import { predictInvoiceOutcome } from "@/lib/cash-forecast";
import { RiskBadge } from "@/components/risk-badge";
import { ChaseStreakBadge } from "@/components/chase-streak-badge";
import type { Invoice } from "@/types/cashpilot";
import type { Invoice as ZentraInvoice } from "@/types/zentra";

const RISK_FOR_DAYS = (d: number): "low" | "med" | "high" =>
  d > 60 ? "high" : d > 30 ? "med" : "low";

export function ChaseQueue({
  initialInvoices,
  onlyToday = true,
  onInvoiceStatusChange,
}: {
  initialInvoices: Invoice[];
  onlyToday?: boolean;
  /** Called after every outcome is recorded so callers can persist the change. */
  onInvoiceStatusChange?: (invoiceId: string, nextStatus: string | null) => void;
}) {
  const [invoices, setInvoices] = useState(initialInvoices);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<QueueFilter | "waiting">(onlyToday ? "today" : "all");
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);
  const [customerDrawerOpen, setCustomerDrawerOpen] = useState(false);
  const [addDrawerOpen, setAddDrawerOpen] = useState(false);
  const [waitingInvoices, setWaitingInvoices] = useState<ZentraInvoice[]>([]);
  const [expandedRankId, setExpandedRankId] = useState<string | null>(null);
  const review = useReview();

  // Hydrate waiting invoices from localStorage on mount and after any slot change
  const refreshWaiting = () => setWaitingInvoices(readWaitingInvoices());

  useEffect(() => {
    refreshWaiting();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const autoOpenedRef = useRef(false);

  // Deep-link: ?customer=Name auto-opens that customer's most pressing invoice.
  // Used by dashboard Top 5 / Top 3 buttons.
  //
  // After consuming the param we strip it from the URL so:
  //   - Coming back to /chase-today via the nav doesn't re-fire the auto-fill
  //   - Browser back/forward doesn't replay the auto-open + search-fill
  //   - The search box stays in sync with what the user actually typed
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
    // Clean the URL so the param doesn't replay
    router.replace(pathname ?? "/chase-today", { scroll: false });
    // Same as above: depend on the stable callback identity, not the whole context.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, invoices, review.open]);

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

      // Persist status change to localStorage so the data survives a page reload
      onInvoiceStatusChange?.(invoiceId, nextStatus);

      // Free a slot in the waiting queue when an invoice is resolved.
      // "paid" and "snooze" (dismiss) both release a slot for the next waiting invoice.
      if (outcome === "paid" || outcome === "snooze") {
        freeSlot(invoiceId, outcome === "paid" ? "paid" : "dismissed");
        refreshWaiting();
      }
    });
    // Depend only on the stable callback identity, not the whole context value.
    // Including `review` here would re-register on every provider render, which
    // re-renders the provider, which … infinite loop. (Killed the router.)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [review.registerOnOutcome]);

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
    if (filter === "waiting") return [];
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

  /**
   * Customer-level risk scores computed once across ALL invoices (not just the
   * filtered queue). This way a customer's risk reflects their full payment
   * history even when only one of their invoices is currently in view.
   */
  const customerRiskMap = useMemo(
    () => computeCustomerRiskMap(invoices),
    [invoices],
  );

  const filteredWaiting = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return waitingInvoices;
    return waitingInvoices.filter(
      (inv) =>
        inv.customerName.toLowerCase().includes(q) ||
        inv.invoiceNumber.toLowerCase().includes(q),
    );
  }, [waitingInvoices, query]);

  const tabs: { label: string; value: QueueFilter | "waiting"; count: number }[] = [
    { label: "Today",     value: "today",    count: filterInvoices(invoices, "today").length },
    { label: "All open",  value: "all",      count: filterInvoices(invoices, "all").length },
    { label: "Calls",     value: "calls",    count: filterInvoices(invoices, "calls").length },
    { label: "Promises",  value: "promises", count: filterInvoices(invoices, "promises").length },
    { label: "Disputes",  value: "disputes", count: filterInvoices(invoices, "disputes").length },
    { label: "Final",     value: "final",    count: filterInvoices(invoices, "final").length },
    { label: "Paid",      value: "paid",     count: filterInvoices(invoices, "paid").length },
    ...(waitingInvoices.length > 0
      ? [{ label: "Waiting", value: "waiting" as const, count: waitingInvoices.length }]
      : []),
  ];

  const totalAmount = queue.reduce((s, i) => s + i.amount, 0);

  function rankBreakdown(inv: Invoice, urgency: string) {
    const factors: { label: string; value: string; tone: "risk" | "warn" | "safe" | "neutral" }[] = [];
    const tone = (d: number): "risk" | "warn" | "neutral" =>
      d > 60 ? "risk" : d > 30 ? "warn" : "neutral";

    factors.push({
      label: "Priority",
      value: urgency,
      tone: urgency === "Critical" ? "risk" : urgency === "High" || urgency === "Blocked" ? "warn" : "neutral",
    });
    if (inv.daysOverdue > 0) {
      factors.push({ label: "Days overdue", value: `${inv.daysOverdue}d`, tone: tone(inv.daysOverdue) });
    }
    factors.push({
      label: "Outstanding",
      value: formatCurrency(inv.amount),
      tone: inv.amount >= 8000 ? "risk" : inv.amount >= 2000 ? "warn" : "neutral",
    });
    if (inv.chaseCount > 0) {
      factors.push({ label: "Prev chases", value: `${inv.chaseCount} unanswered`, tone: inv.chaseCount >= 3 ? "warn" : "neutral" });
    }
    if (inv.relationshipType === "high-value client") {
      factors.push({ label: "Relationship", value: "High-value client", tone: "safe" });
    }
    if (inv.status === "Promised payment") {
      factors.push({ label: "Status", value: "Promise pending — verify", tone: "warn" });
    }
    if (inv.status === "Disputed") {
      factors.push({ label: "Status", value: "Active dispute", tone: "risk" });
    }
    return factors;
  }

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
    <div className="flex flex-col gap-4 lg:gap-5">

      {/* Search + sort row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative max-w-[480px] flex-1 min-w-[260px]">
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
        <div className="flex items-center gap-2 flex-wrap">
          <ChaseStreakBadge />
          <BriefMeButton queue={queue} />
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

        {/* ── Mobile card list (< sm) ── */}
        <div className="sm:hidden divide-y" style={{ borderColor: "var(--zn-line-soft)" }}>
          {queue.length === 0 ? (
            <div className="px-4 py-10 text-center text-[13px]" style={{ color: "var(--zn-ink-3)" }}>
              No invoices match this view.
            </div>
          ) : queue.map((inv, idx) => {
            const urgency = getInvoiceUrgency(inv);
            const action = getSuggestedAction(inv);
            const overdueColor =
              inv.daysOverdue > 60 ? "var(--zn-risk)" :
              inv.daysOverdue > 30 ? "var(--zn-warn)" :
                                     "var(--zn-ink-2)";
            return (
              <button
                key={inv.id}
                type="button"
                onClick={() => openInvoice(inv)}
                className="w-full text-left px-4 py-3.5 transition-colors hover:bg-[var(--zn-surface-2)]"
              >
                <div className="flex items-start justify-between gap-3">
                  {/* Left: rank + customer */}
                  <div className="flex items-start gap-2.5 min-w-0">
                    <span
                      className="mt-0.5 text-[12px] italic w-4 text-right shrink-0"
                      style={{
                        color: "var(--zn-ink-3)",
                        fontFamily: "var(--font-newsreader), ui-serif, Georgia, serif",
                      }}
                    >
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-[13.5px] font-semibold truncate text-[#1d1813] dark:text-[#f0e8d5]">
                          {inv.customerName}
                        </p>
                        {customerRiskMap.get(inv.customerName) && (
                          <RiskBadge risk={customerRiskMap.get(inv.customerName)!} size="sm" />
                        )}
                      </div>
                      <p className="text-[11.5px] mt-0.5 font-mono" style={{ color: "var(--zn-ink-3)" }}>
                        {inv.invoiceNumber}
                        {inv.daysOverdue > 0 && (
                          <span className="ml-2 font-sans font-semibold" style={{ color: overdueColor }}>
                            {inv.daysOverdue}d overdue
                          </span>
                        )}
                      </p>
                      <p className="text-[12px] mt-1 truncate flex items-center gap-1.5" style={{ color: "var(--zn-ink-2)" }}>
                        {(inv.status === "Promised payment" || inv.status === "Disputed") && (
                          <span
                            className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9.5px] font-semibold uppercase tracking-wide"
                            style={{ background: "var(--zn-safe-soft)", color: "var(--zn-safe)" }}
                          >
                            Don&rsquo;t chase
                          </span>
                        )}
                        {action}
                      </p>
                    </div>
                  </div>
                  {/* Right: amount + risk + review */}
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <span className="text-[13.5px] font-semibold tabular-nums text-[#1d1813] dark:text-[#f0e8d5]">
                      {formatCurrency(inv.amount)}
                    </span>
                    <span
                      className={`zn-risk-chip ${
                        urgency === "Critical" || urgency === "Blocked"
                          ? "zn-risk-high"
                          : urgency === "High" || urgency === "Medium"
                          ? "zn-risk-med"
                          : "zn-risk-low"
                      }`}
                    >
                      <span className="zn-risk-dot" />
                      {urgency}
                    </span>
                    <span
                      className="text-[11px] font-medium underline underline-offset-2"
                      style={{ color: "var(--zn-ink-3)" }}
                    >
                      Review →
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* ── Desktop table (≥ sm) ── */}
        <div className="hidden sm:block overflow-x-auto">
        {filter === "waiting" ? (
          <WaitingTable invoices={filteredWaiting} />
        ) : (
        <table
          className="border-collapse"
          style={{ tableLayout: "fixed", width: "100%", minWidth: 880 }}
        >
          <colgroup>
            <col style={{ width: 44 }} />
            <col style={{ width: "22%" }} />
            <col style={{ width: 110 }} />
            <col style={{ width: 120 }} />
            <col style={{ width: 84 }} />
            <col style={{ width: "24%" }} />
            <col style={{ width: 120 }} />
            <col style={{ width: 108 }} />
          </colgroup>
          <thead>
            <tr>
              <th className="zn-label text-left" style={{ padding: "12px 22px" }}></th>
              <th className="zn-label text-left" style={{ padding: "12px 10px" }}>Customer</th>
              <th className="zn-label text-left" style={{ padding: "12px 10px" }}>Amount</th>
              <th className="zn-label text-left" style={{ padding: "12px 10px" }}>Due</th>
              <th className="zn-label text-left" style={{ padding: "12px 10px" }}>Overdue</th>
              <th className="zn-label text-left" style={{ padding: "12px 10px" }}>Recommended action</th>
              <th className="zn-label text-left" style={{ padding: "12px 10px" }}>Risk</th>
              <th className="zn-label text-left" style={{ padding: "12px 22px" }}></th>
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
                const prediction = predictInvoiceOutcome(inv, invoices);
                const overdueColor =
                  inv.daysOverdue > 60 ? "var(--zn-risk)" :
                  inv.daysOverdue > 30 ? "var(--zn-warn)" :
                                         "var(--zn-ink-2)";
                const isHighlighted = idx === highlightedIdx;
                return (
                  <React.Fragment key={inv.id}>
                  <tr
                    onClick={() => openInvoice(inv)}
                    onMouseEnter={() => setHighlightedIdx(idx)}
                    className="transition-colors cursor-pointer hover:bg-[#f3ecd8] dark:hover:bg-[#2d2820]"
                    {...(idx === 0 ? { "data-chase-row-first": "true" } : {})}
                    style={{
                      borderTop: "1px solid var(--zn-line-soft)",
                      background: isHighlighted ? "var(--zn-surface-2)" : undefined,
                      boxShadow: isHighlighted
                        ? "inset 3px 0 0 var(--zn-accent)"
                        : undefined,
                    }}
                  >
                    <td
                      style={{ padding: "14px 22px", verticalAlign: "top" }}
                    >
                      <div className="flex flex-col items-center gap-1">
                        <span
                          className="text-[14px] italic"
                          style={{
                            color: "var(--zn-ink-3)",
                            fontFamily: "var(--font-newsreader), ui-serif, Georgia, serif",
                          }}
                        >
                          {idx + 1}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedRankId(expandedRankId === inv.id ? null : inv.id);
                          }}
                          title="Why this rank?"
                          className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full transition-colors"
                          style={{
                            background: expandedRankId === inv.id ? "var(--zn-accent)" : "var(--zn-surface-2)",
                            color: expandedRankId === inv.id ? "#fff" : "var(--zn-ink-3)",
                            border: "1px solid var(--zn-line)",
                          }}
                        >
                          why?
                        </button>
                      </div>
                    </td>
                    <td style={{ padding: "14px 10px" }}>
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openCustomer(inv.customerName);
                            }}
                            className="text-[13.5px] font-semibold text-left text-[#1d1813] dark:text-[#f0e8d5] hover:underline truncate"
                            style={{ background: "transparent", border: 0, padding: 0 }}
                          >
                            {inv.customerName}
                          </button>
                          {customerRiskMap.get(inv.customerName) && (
                            <RiskBadge risk={customerRiskMap.get(inv.customerName)!} size="sm" />
                          )}
                        </div>
                        <span className="zn-kind-tag mt-0.5">{inv.invoiceNumber}</span>
                      </div>
                    </td>
                    <td
                      className="text-[13px] font-medium tabular-nums"
                      style={{ padding: "14px 10px", color: "var(--zn-ink)" }}
                    >
                      {formatCurrency(inv.amount)}
                    </td>
                    <td
                      className="text-[12.5px] truncate"
                      style={{ padding: "14px 10px", color: "var(--zn-ink-3)" }}
                    >
                      {formatDate(inv.dueDate)}
                    </td>
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
                    <td style={{ padding: "14px 10px" }}>
                      <div className="flex items-center gap-2">
                        {(inv.status === "Promised payment" || inv.status === "Disputed") ? (
                          <span
                            className="inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-semibold uppercase tracking-wide"
                            style={{ background: "var(--zn-safe-soft)", color: "var(--zn-safe)" }}
                            title={inv.status === "Promised payment"
                              ? "Customer promised a date — wait before chasing again"
                              : "Active dispute — resolve before chasing"}
                          >
                            Don&rsquo;t chase
                          </span>
                        ) : null}
                        <span
                          className="text-[13px] truncate"
                          style={{ color: "var(--zn-ink-2)" }}
                        >
                          {action}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1 items-center">
                        {risks.slice(0, 2).map((r) => (
                          <span key={r} className="zn-kind-tag" style={{ fontSize: 9.5 }}>
                            {r}
                          </span>
                        ))}
                        <span
                          className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9.5px] font-semibold tabular-nums"
                          style={{
                            background:
                              prediction.confidence === "high" ? "var(--zn-safe-soft)" :
                              prediction.confidence === "low"  ? "var(--zn-risk-soft)" :
                                                                  "var(--zn-surface-2)",
                            color:
                              prediction.confidence === "high" ? "var(--zn-safe)" :
                              prediction.confidence === "low"  ? "var(--zn-risk)" :
                                                                  "var(--zn-ink-3)",
                          }}
                          title={prediction.summary}
                        >
                          {Math.round(prediction.probability * 100)}% likely
                        </span>
                      </div>
                    </td>
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
                  {expandedRankId === inv.id && (
                    <tr key={`${inv.id}-why`} onClick={(e) => e.stopPropagation()}>
                      <td
                        colSpan={8}
                        style={{
                          padding: "0 22px 14px",
                          background: "var(--zn-surface-2)",
                          borderTop: "1px dashed var(--zn-line)",
                        }}
                      >
                        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] mb-2 mt-2" style={{ color: "var(--zn-ink-3)" }}>
                          Why ranked #{idx + 1}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {rankBreakdown(inv, urgency).map((f) => {
                            const bg =
                              f.tone === "risk" ? "var(--zn-risk-soft)" :
                              f.tone === "warn" ? "var(--zn-warn-soft)" :
                              f.tone === "safe" ? "var(--zn-safe-soft)" :
                              "var(--zn-surface)";
                            const fg =
                              f.tone === "risk" ? "var(--zn-risk)" :
                              f.tone === "warn" ? "var(--zn-warn)" :
                              f.tone === "safe" ? "var(--zn-safe)" :
                              "var(--zn-ink-2)";
                            return (
                              <span
                                key={f.label}
                                className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px]"
                                style={{ background: bg, border: `1px solid ${fg}22` }}
                              >
                                <span style={{ color: "var(--zn-ink-3)" }}>{f.label}</span>
                                <span className="font-semibold" style={{ color: fg }}>{f.value}</span>
                              </span>
                            );
                          })}
                        </div>
                      </td>
                    </tr>
                  )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
        )}
        </div>
      </div>

      {/* Footer: count + total */}
      <div
        className="flex items-center justify-between text-[12px]"
        style={{ color: "var(--zn-ink-3)" }}
      >
        <div>
          {filter === "waiting"
            ? `${filteredWaiting.length} invoice${filteredWaiting.length === 1 ? "" : "s"} waiting · ${formatCurrency(filteredWaiting.reduce((s, i) => s + i.amountOutstanding, 0))} on hold`
            : `${queue.length} invoice${queue.length === 1 ? "" : "s"} · ${formatCurrency(totalAmount)} outstanding`}
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

function WaitingTable({ invoices }: { invoices: ZentraInvoice[] }) {
  if (invoices.length === 0) {
    return (
      <div
        className="text-center text-[13px] py-10"
        style={{ color: "var(--zn-ink-3)" }}
      >
        No invoices waiting. All imported invoices are in the active queue.
      </div>
    );
  }

  return (
    <table
      className="border-collapse"
      style={{ tableLayout: "fixed", width: "100%", minWidth: 680 }}
    >
      <colgroup>
        <col style={{ width: 44 }} />
        <col style={{ width: "28%" }} />
        <col style={{ width: 120 }} />
        <col style={{ width: 120 }} />
        <col style={{ width: 80 }} />
        <col style={{ width: "auto" }} />
      </colgroup>
      <thead>
        <tr>
          <th className="zn-label text-left" style={{ padding: "12px 22px" }}>#</th>
          <th className="zn-label text-left" style={{ padding: "12px 10px" }}>Customer</th>
          <th className="zn-label text-left" style={{ padding: "12px 10px" }}>Outstanding</th>
          <th className="zn-label text-left" style={{ padding: "12px 10px" }}>Due date</th>
          <th className="zn-label text-left" style={{ padding: "12px 10px" }}>Overdue</th>
          <th className="zn-label text-left" style={{ padding: "12px 22px" }}>Status</th>
        </tr>
      </thead>
      <tbody>
        {invoices.map((inv, idx) => (
          <tr
            key={inv.id}
            style={{ borderTop: "1px solid var(--zn-line-soft)" }}
          >
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
            <td style={{ padding: "14px 10px" }}>
              <div className="text-[13.5px] font-semibold text-[#1d1813] dark:text-[#f0e8d5] truncate">
                {inv.customerName}
              </div>
              <div className="zn-kind-tag mt-0.5">{inv.invoiceNumber}</div>
            </td>
            <td
              className="text-[13px] font-medium tabular-nums"
              style={{ padding: "14px 10px", color: "var(--zn-ink)" }}
            >
              {formatCurrency(inv.amountOutstanding)}
            </td>
            <td
              className="text-[12.5px]"
              style={{ padding: "14px 10px", color: "var(--zn-ink-3)" }}
            >
              {inv.dueDate ? formatDate(inv.dueDate) : "—"}
            </td>
            <td style={{ padding: "14px 10px" }}>
              {inv.daysOverdue > 0 ? (
                <span
                  className="text-[12.5px] font-semibold tabular-nums"
                  style={{
                    color:
                      inv.daysOverdue > 60
                        ? "var(--zn-risk)"
                        : inv.daysOverdue > 30
                        ? "var(--zn-warn)"
                        : "var(--zn-ink-2)",
                  }}
                >
                  {inv.daysOverdue}d
                </span>
              ) : (
                <span className="text-[12px]" style={{ color: "var(--zn-ink-3)" }}>
                  not due
                </span>
              )}
            </td>
            <td style={{ padding: "14px 22px" }}>
              <span
                className="zn-chip"
                style={{
                  background: "var(--zn-surface)",
                  border: "1px solid var(--zn-line-soft)",
                  color: "var(--zn-ink-3)",
                  fontSize: 11,
                }}
              >
                Waiting for slot
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ── Brief me — read top invoices aloud via the browser's TTS engine ─────────

/**
 * "Brief me" button — speaks the top 5 invoices in the queue using the
 * browser's built-in SpeechSynthesis API. Free, no external service.
 * Useful for the commute home or while doing other work.
 */
function BriefMeButton({ queue }: { queue: Invoice[] }) {
  const [speaking, setSpeaking] = useState(false);

  // Only render when browser supports TTS
  const supported =
    typeof window !== "undefined" &&
    typeof window.speechSynthesis !== "undefined";
  if (!supported) return null;
  if (queue.length === 0) return null;

  function buildBriefText(invoices: Invoice[]): string {
    const top = invoices.slice(0, 5);
    const intro =
      invoices.length === 1
        ? "You have one invoice to chase."
        : `You have ${invoices.length} invoices to chase. Here are the top ${top.length}.`;
    const items = top.map((inv, idx) => {
      const amount = `£${Math.round(inv.amount).toLocaleString("en-GB")}`;
      const overdue =
        inv.daysOverdue > 0
          ? `${inv.daysOverdue} day${inv.daysOverdue === 1 ? "" : "s"} overdue`
          : "not yet due";
      const action = getSuggestedAction(inv);
      return `Number ${idx + 1}. ${inv.customerName}. ${amount}. ${overdue}. Recommended action: ${action}.`;
    });
    const outro = "End of brief.";
    return [intro, ...items, outro].join(" ");
  }

  function speak() {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(buildBriefText(queue));
    utterance.rate = 1.05;
    utterance.pitch = 1;
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
    setSpeaking(true);
  }

  function stop() {
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }

  return (
    <button
      type="button"
      onClick={speaking ? stop : speak}
      className="zn-pill zn-pill-ghost"
      title={speaking ? "Stop briefing" : "Read top invoices aloud"}
    >
      {speaking ? (
        <>
          <VolumeX className="size-3.5" /> Stop
        </>
      ) : (
        <>
          <Volume2 className="size-3.5" /> Brief me
        </>
      )}
    </button>
  );
}
