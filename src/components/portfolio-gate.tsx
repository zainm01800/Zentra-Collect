"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { ArrowRight, Upload, BarChart3, AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { useLocalAccount } from "@/lib/billing/use-local-account";
import {
  demoBookkeeperClients,
  demoInvoices,
} from "@/lib/demo-data/zentra-demo-data";
import { formatCurrency } from "@/lib/formatters";
import { importedInvoicesStorageKey, importSummaryStorageKey } from "@/lib/import/zentra-import";
import {
  readBookkeeperClients,
  readClientInvoices,
  readClientSummary,
  type BookkeeperClient,
} from "@/lib/bookkeeper-clients";
import type { Invoice } from "@/types/zentra";
import type { ImportSummary } from "@/lib/import/zentra-import";

// ── Entry point — routes by account state ─────────────────────────────────────
export function PortfolioGate() {
  const { account } = useLocalAccount();

  if (!account || account.planId === "demo") {
    return <DemoPortfolio />;
  }

  const bookkeeperPlanIds = ["founding_bookkeeper", "bookkeeper_starter", "bookkeeper_pro"];
  if (bookkeeperPlanIds.includes(account.planId)) {
    return <LiveBookkeeperPortfolio />;
  }

  return <LivePortfolio />;
}

// ── Live portfolio — reads from localStorage ──────────────────────────────────
function LivePortfolio() {
  const { account } = useLocalAccount();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(importedInvoicesStorageKey);
      if (raw) setInvoices(JSON.parse(raw) as Invoice[]);
      const rawSummary = localStorage.getItem(importSummaryStorageKey);
      if (rawSummary) setSummary(JSON.parse(rawSummary) as ImportSummary);
    } catch {
      // ignore
    }
    setLoaded(true);
  }, []);

  const stats = useMemo(() => {
    const open = invoices.filter((i) => i.status !== "paid");
    const overdue = open.filter((i) => i.daysOverdue > 0);
    const disputed = invoices.filter((i) => i.status === "disputed");
    const missedPromises = invoices.filter((i) => i.status === "missed_promise");
    const exceptions = disputed.length + missedPromises.length;
    const totalOutstanding = open.reduce((s, i) => s + i.amountOutstanding, 0);
    const overdueAmount = overdue.reduce((s, i) => s + i.amountOutstanding, 0);

    // Group by customer
    const byCustomer = new Map<string, { name: string; amount: number; oldest: number }>();
    for (const inv of open) {
      const existing = byCustomer.get(inv.customerId);
      if (!existing) {
        byCustomer.set(inv.customerId, { name: inv.customerName, amount: inv.amountOutstanding, oldest: inv.daysOverdue });
      } else {
        existing.amount += inv.amountOutstanding;
        existing.oldest = Math.max(existing.oldest, inv.daysOverdue);
      }
    }
    const topCustomers = Array.from(byCustomer.values())
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    // Age buckets
    const current   = open.filter((i) => i.daysOverdue <= 0).reduce((s, i) => s + i.amountOutstanding, 0);
    const days1_30  = overdue.filter((i) => i.daysOverdue <= 30).reduce((s, i) => s + i.amountOutstanding, 0);
    const days31_60 = overdue.filter((i) => i.daysOverdue > 30 && i.daysOverdue <= 60).reduce((s, i) => s + i.amountOutstanding, 0);
    const days61_90 = overdue.filter((i) => i.daysOverdue > 60 && i.daysOverdue <= 90).reduce((s, i) => s + i.amountOutstanding, 0);
    const days90p   = overdue.filter((i) => i.daysOverdue > 90).reduce((s, i) => s + i.amountOutstanding, 0);

    return {
      totalInvoices: invoices.length,
      openCount: open.length,
      overdueCount: overdue.length,
      totalOutstanding,
      overdueAmount,
      exceptions,
      disputed: disputed.length,
      missedPromises: missedPromises.length,
      topCustomers,
      ageBuckets: { current, days1_30, days31_60, days61_90, days90p },
    };
  }, [invoices]);

  if (!loaded) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="text-[13px]" style={{ color: "var(--zn-ink-3)" }}>Loading portfolio…</div>
      </div>
    );
  }

  if (invoices.length === 0) {
    return (
      <div className="flex flex-col gap-5">
        <section>
          <div className="zn-label mb-1.5">Portfolio</div>
          <h1 className="zn-page-h1">Your portfolio</h1>
          <p className="mt-1.5 max-w-[580px] text-[13.5px] text-[#6b6253] dark:text-[#8a7d69]">
            Import your first invoice export to see your portfolio summary here.
          </p>
        </section>
        <div
          className="flex flex-col items-center justify-center gap-4 rounded-2xl p-14 text-center"
          style={{ border: "1px solid var(--zn-line-soft)", background: "var(--zn-surface)" }}
        >
          <div
            className="size-12 rounded-2xl flex items-center justify-center"
            style={{ background: "var(--zn-bg-2)" }}
          >
            <BarChart3 className="size-5" style={{ color: "var(--zn-ink-3)" }} />
          </div>
          <div>
            <p className="text-[15px] font-semibold text-[#1d1813] dark:text-[#f0e8d5]">No data yet</p>
            <p className="mt-1 text-[13px]" style={{ color: "var(--zn-ink-3)" }}>
              Import an AR ageing or unpaid invoice export to see your portfolio overview.
            </p>
          </div>
          <Link
            href="/import"
            className="flex items-center gap-2 zn-pill"
            style={{ height: 36, padding: "0 18px", fontSize: 13 }}
          >
            <Upload className="size-3.5" />
            Import invoices
          </Link>
        </div>
      </div>
    );
  }

  const totalForBuckets = stats.ageBuckets.current + stats.ageBuckets.days1_30 + stats.ageBuckets.days31_60 + stats.ageBuckets.days61_90 + stats.ageBuckets.days90p || 1;

  const ageBuckets = [
    { label: "Current",   amount: stats.ageBuckets.current,   color: "var(--zn-safe)" },
    { label: "1–30d",     amount: stats.ageBuckets.days1_30,  color: "var(--zn-warn)" },
    { label: "31–60d",    amount: stats.ageBuckets.days31_60, color: "#E07D35" },
    { label: "61–90d",    amount: stats.ageBuckets.days61_90, color: "var(--zn-risk)" },
    { label: "90d+",      amount: stats.ageBuckets.days90p,   color: "#991B1B" },
  ];

  const planId = account?.planId ?? "TRIAL";
  const bookkeeperPlans = ["FOUNDING_BOOKKEEPER", "BOOKKEEPER_STARTER", "BOOKKEEPER_PRO"] as const;
  const isBookkeeper = (bookkeeperPlans as readonly string[]).includes(planId);

  return (
    <div className="flex flex-col gap-5">
      <section className="flex items-start justify-between gap-4">
        <div>
          <div className="zn-label mb-1.5">Portfolio</div>
          <h1 className="zn-page-h1">Your portfolio</h1>
          {summary && (
            <p className="mt-1.5 text-[12.5px]" style={{ color: "var(--zn-ink-3)" }}>
              Last import: {summary.fileName} ·{" "}
              {new Date(summary.importedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
            </p>
          )}
        </div>
        <Link href="/import" className="zn-pill zn-pill-ghost flex-shrink-0" style={{ height: 34, fontSize: 12, padding: "0 14px" }}>
          <Upload className="size-3" /> Re-import
        </Link>
      </section>

      {/* KPI row */}
      <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total outstanding",  value: formatCurrency(stats.totalOutstanding), color: "var(--zn-accent)" },
          { label: "Overdue amount",     value: formatCurrency(stats.overdueAmount),    color: "var(--zn-risk)" },
          { label: "Open invoices",      value: String(stats.openCount),                color: "var(--zn-ink)" },
          { label: "Exceptions",         value: String(stats.exceptions),               color: stats.exceptions > 0 ? "var(--zn-risk)" : "var(--zn-ink)" },
        ].map((kpi) => (
          <div key={kpi.label} className="zn-stat">
            <div className="zn-label">{kpi.label}</div>
            <div className="zn-stat-num mt-2" style={{ color: kpi.color }}>{kpi.value}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Age analysis */}
        <div className="zn-card p-5">
          <div className="zn-label !p-0 mb-4">AR ageing analysis</div>
          <div className="flex flex-col gap-3">
            {ageBuckets.map((bucket) => {
              const pct = Math.round((bucket.amount / totalForBuckets) * 100);
              return (
                <div key={bucket.label}>
                  <div className="flex justify-between mb-1">
                    <span className="text-[12px] font-medium" style={{ color: "var(--zn-ink-2)" }}>{bucket.label}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] tabular-nums font-semibold" style={{ color: "var(--zn-ink-2)" }}>
                        {formatCurrency(bucket.amount)}
                      </span>
                      <span className="text-[11px] tabular-nums w-7 text-right" style={{ color: "var(--zn-ink-3)" }}>
                        {pct}%
                      </span>
                    </div>
                  </div>
                  <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: "var(--zn-line-soft)" }}>
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, background: bucket.color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top customers by outstanding */}
        <div className="zn-card p-0 overflow-hidden">
          <div className="p-5 pb-3">
            <div className="zn-label !p-0">Top customers by outstanding</div>
          </div>
          <div className="flex flex-col">
            {stats.topCustomers.map((c, i) => (
              <div
                key={c.name + i}
                className="flex items-center justify-between px-5 py-3"
                style={{ borderTop: "1px solid var(--zn-line-soft)" }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className="text-[11px] font-bold w-5 flex-shrink-0 text-center"
                    style={{ color: "var(--zn-ink-3)" }}
                  >
                    {i + 1}
                  </span>
                  <span className="text-[13px] font-medium truncate" style={{ color: "var(--zn-ink)" }}>{c.name}</span>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  {c.oldest > 0 && (
                    <span
                      className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full"
                      style={{
                        background: c.oldest > 60 ? "var(--zn-risk-soft)" : "var(--zn-warn-soft)",
                        color: c.oldest > 60 ? "var(--zn-risk)" : "var(--zn-warn)",
                      }}
                    >
                      {c.oldest}d
                    </span>
                  )}
                  <span className="text-[13px] font-semibold tabular-nums" style={{ color: "var(--zn-ink)" }}>
                    {formatCurrency(c.amount)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Exceptions row */}
      {(stats.disputed > 0 || stats.missedPromises > 0) && (
        <div className="grid gap-3.5 sm:grid-cols-2">
          {stats.disputed > 0 && (
            <div
              className="flex items-start gap-3 rounded-xl p-4"
              style={{ background: "var(--zn-risk-soft)", border: "1px solid var(--zn-risk)" }}
            >
              <AlertCircle className="size-4 flex-shrink-0 mt-0.5" style={{ color: "var(--zn-risk)" }} />
              <div>
                <div className="text-[13px] font-semibold" style={{ color: "var(--zn-risk)" }}>
                  {stats.disputed} disputed invoice{stats.disputed !== 1 ? "s" : ""}
                </div>
                <div className="text-[12px] mt-0.5" style={{ color: "var(--zn-ink-2)" }}>
                  Review in your chase plan before sending further chasers.
                </div>
              </div>
            </div>
          )}
          {stats.missedPromises > 0 && (
            <div
              className="flex items-start gap-3 rounded-xl p-4"
              style={{ background: "var(--zn-warn-soft)", border: "1px solid var(--zn-warn)" }}
            >
              <Clock className="size-4 flex-shrink-0 mt-0.5" style={{ color: "var(--zn-warn)" }} />
              <div>
                <div className="text-[13px] font-semibold" style={{ color: "var(--zn-warn)" }}>
                  {stats.missedPromises} missed promise{stats.missedPromises !== 1 ? "s" : ""}
                </div>
                <div className="text-[12px] mt-0.5" style={{ color: "var(--zn-ink-2)" }}>
                  These customers said they&apos;d pay but haven&apos;t. Follow up today.
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Quick actions */}
      <div className="grid gap-3.5 sm:grid-cols-3">
        {[
          { href: "/chase-plan", label: "Open chase plan", icon: <ArrowRight className="size-3.5" />, desc: "See today's ranked action list" },
          { href: "/customers", label: "View customers",   icon: <ArrowRight className="size-3.5" />, desc: "Drill into individual customer stats" },
          { href: "/import",    label: "Re-import data",   icon: <Upload className="size-3.5" />,     desc: "Upload a newer AR export" },
        ].map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className="flex flex-col gap-1.5 rounded-xl p-4 transition-colors hover:bg-[#ece3cc] dark:hover:bg-[#28231c]"
            style={{ border: "1px solid var(--zn-line-soft)", background: "var(--zn-surface)" }}
          >
            <div className="text-[13px] font-semibold text-[#1d1813] dark:text-[#f0e8d5] flex items-center gap-1.5">
              {action.label} {action.icon}
            </div>
            <div className="text-[12px]" style={{ color: "var(--zn-ink-3)" }}>{action.desc}</div>
          </Link>
        ))}
      </div>

      {/* Bookkeeper multi-client teaser */}
      {!isBookkeeper && (
        <div
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl p-4"
          style={{ border: "1px solid var(--zn-line-soft)", background: "var(--zn-surface-2)" }}
        >
          <div className="flex items-start gap-3">
            <CheckCircle2 className="size-4 flex-shrink-0 mt-0.5" style={{ color: "var(--zn-accent)" }} />
            <div>
              <div className="text-[13px] font-semibold text-[#1d1813] dark:text-[#f0e8d5]">
                Managing multiple clients?
              </div>
              <div className="text-[12px] mt-0.5" style={{ color: "var(--zn-ink-3)" }}>
                Bookkeeper plan lets you manage separate ledgers per client, with a portfolio-level view across all of them.
              </div>
            </div>
          </div>
          <Link href="/#pricing" className="zn-pill zn-pill-ghost flex-shrink-0" style={{ height: 32, fontSize: 12, padding: "0 14px" }}>
            See plans <ArrowRight className="size-3" />
          </Link>
        </div>
      )}
    </div>
  );
}

// ── Live bookkeeper portfolio — multi-client grid from localStorage ───────────
function LiveBookkeeperPortfolio() {
  const [clients, setClients]   = useState<BookkeeperClient[]>([]);
  const [loaded, setLoaded]     = useState(false);

  // Each client entry augmented with computed stats
  type ClientWithStats = BookkeeperClient & {
    invoiceCount: number;
    openCount: number;
    overdueAmount: number;
    exceptions: number;
    risk: "high" | "med" | "low";
  };

  const [clientStats, setClientStats] = useState<ClientWithStats[]>([]);

  useEffect(() => {
    const stored = readBookkeeperClients();
    setClients(stored);

    const withStats: ClientWithStats[] = stored.map((c) => {
      const invoices = readClientInvoices(c.id);
      const open     = invoices.filter((i) => i.status !== "paid");
      const overdue  = open.filter((i) => i.daysOverdue > 0);
      const disputed = invoices.filter((i) => i.status === "disputed").length;
      const missed   = invoices.filter((i) => i.status === "missed_promise").length;
      const exceptions = disputed + missed;
      const overdueAmount = overdue.reduce((s, i) => s + i.amountOutstanding, 0);
      const risk: "high" | "med" | "low" =
        exceptions >= 3 ? "high" : exceptions >= 1 ? "med" : "low";
      return {
        ...c,
        invoiceCount: invoices.length,
        openCount:    open.length,
        overdueAmount,
        exceptions,
        risk,
      };
    });
    setClientStats(withStats);
    setLoaded(true);
  }, []);

  const totals = useMemo(() => ({
    totalClients:    clientStats.length,
    totalOverdue:    clientStats.reduce((s, c) => s + c.overdueAmount, 0),
    totalOpen:       clientStats.reduce((s, c) => s + c.openCount, 0),
    totalExceptions: clientStats.reduce((s, c) => s + c.exceptions, 0),
  }), [clientStats]);

  if (!loaded) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="text-[13px]" style={{ color: "var(--zn-ink-3)" }}>Loading portfolio…</div>
      </div>
    );
  }

  if (clients.length === 0) {
    return (
      <div className="flex flex-col gap-5">
        <section>
          <div className="zn-label mb-1.5">Bookkeeper mode</div>
          <h1 className="zn-page-h1">Client portfolio</h1>
          <p className="mt-1.5 max-w-[580px] text-[13.5px] text-[#6b6253] dark:text-[#8a7d69]">
            Add your first client in the sidebar, then import their invoice export to get started.
          </p>
        </section>
        <div
          className="flex flex-col items-center justify-center gap-4 rounded-2xl p-14 text-center"
          style={{ border: "1px solid var(--zn-line-soft)", background: "var(--zn-surface)" }}
        >
          <div
            className="size-12 rounded-2xl flex items-center justify-center"
            style={{ background: "var(--zn-bg-2)" }}
          >
            <BarChart3 className="size-5" style={{ color: "var(--zn-ink-3)" }} />
          </div>
          <div>
            <p className="text-[15px] font-semibold text-[#1d1813] dark:text-[#f0e8d5]">No clients yet</p>
            <p className="mt-1 text-[13px]" style={{ color: "var(--zn-ink-3)" }}>
              Use the workspace switcher in the sidebar to add your first client, then import their AR export.
            </p>
          </div>
          <Link
            href="/import"
            className="flex items-center gap-2 zn-pill"
            style={{ height: 36, padding: "0 18px", fontSize: 13 }}
          >
            <Upload className="size-3.5" />
            Import first client
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <section className="flex items-start justify-between gap-4">
        <div>
          <div className="zn-label mb-1.5">Bookkeeper mode</div>
          <h1 className="zn-page-h1">Client portfolio</h1>
          <p className="mt-1.5 text-[13px]" style={{ color: "var(--zn-ink-3)" }}>
            {clients.length} client{clients.length !== 1 ? "s" : ""} · one pane across every ledger
          </p>
        </div>
        <a
          href="/portfolio/counterparties"
          className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[12.5px] font-medium border whitespace-nowrap"
          style={{ borderColor: "var(--zn-line)", color: "var(--zn-ink-2)" }}
        >
          Counterparty exposure →
        </a>
      </section>

      {/* Summary stats */}
      <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Clients",     value: String(totals.totalClients),                      color: "var(--zn-ink)" },
          { label: "Total overdue", value: formatCurrency(totals.totalOverdue),            color: "var(--zn-accent)" },
          { label: "Open invoices", value: String(totals.totalOpen),                       color: "var(--zn-ink)" },
          { label: "Exceptions",  value: String(totals.totalExceptions),                   color: totals.totalExceptions > 0 ? "var(--zn-risk)" : "var(--zn-ink)" },
        ].map((kpi) => (
          <div key={kpi.label} className="zn-stat">
            <div className="zn-label">{kpi.label}</div>
            <div className="zn-stat-num mt-2" style={{ color: kpi.color }}>{kpi.value}</div>
          </div>
        ))}
      </div>

      {/* Client cards grid */}
      <section className="grid gap-3.5 lg:grid-cols-2">
        {clientStats.map((client) => {
          const initials = client.name
            .split(/\s+/)
            .slice(0, 2)
            .map((p) => p[0])
            .join("")
            .toUpperCase();
          const summary = readClientSummary(client.id);
          const riskLabel =
            client.risk === "high" ? "High risk" :
            client.risk === "med"  ? "Medium risk" : "Low risk";
          const riskClass =
            client.risk === "high" ? "zn-risk-high" :
            client.risk === "med"  ? "zn-risk-med"  : "zn-risk-low";

          return (
            <div key={client.id} className="zn-card p-[18px]">
              <div className="flex items-start justify-between gap-3 mb-3.5">
                <div className="flex items-start gap-3 min-w-0">
                  <span
                    className="size-9 rounded-lg inline-flex items-center justify-center text-[12px] font-semibold flex-shrink-0"
                    style={{ background: "var(--zn-accent)", color: "var(--zn-accent-ink)" }}
                  >
                    {initials}
                  </span>
                  <div className="min-w-0">
                    <div className="text-[14px] font-semibold text-[#1d1813] dark:text-[#f0e8d5] truncate">
                      {client.name}
                    </div>
                    <div className="text-[12px] text-[#6b6253] dark:text-[#8a7d69] truncate">
                      {client.label}
                      {summary && (
                        <> · Last import: {new Date(summary.importedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</>
                      )}
                    </div>
                  </div>
                </div>
                <span className={`zn-risk-chip ${riskClass} flex-shrink-0`}>
                  <span className="zn-risk-dot" />
                  {riskLabel}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2.5 mb-3.5">
                {[
                  { label: "Overdue",    value: formatCurrency(client.overdueAmount), tone: "var(--zn-accent)" },
                  { label: "Open",       value: String(client.openCount),             tone: "var(--zn-ink)" },
                  { label: "Exceptions", value: String(client.exceptions),            tone: client.exceptions > 0 ? "var(--zn-risk)" : "var(--zn-ink)" },
                ].map((s) => (
                  <div
                    key={s.label}
                    className="rounded-[10px] p-2.5"
                    style={{ background: "var(--zn-surface-2)", border: "1px solid var(--zn-line-soft)" }}
                  >
                    <div className="zn-label !p-0" style={{ fontSize: 9.5 }}>{s.label}</div>
                    <div className="text-[16px] font-semibold tabular-nums mt-1" style={{ color: s.tone }}>
                      {s.value}
                    </div>
                  </div>
                ))}
              </div>

              {client.invoiceCount === 0 ? (
                <Link
                  href="/import"
                  className="zn-pill zn-pill-ghost w-full justify-center"
                >
                  <Upload className="size-3.5" /> Import data
                </Link>
              ) : (
                <Link href="/chase-plan" className="zn-pill zn-pill-ghost w-full justify-center">
                  Open chase plan <ArrowRight className="size-3.5" />
                </Link>
              )}
            </div>
          );
        })}
      </section>
    </div>
  );
}

// ── Demo portfolio (unchanged) ─────────────────────────────────────────────────
function DemoPortfolio() {
  const clients = demoBookkeeperClients.map((client) => {
    const invoices = demoInvoices.filter(
      (invoice) => invoice.businessId === client.business.id,
    );
    const overdueAmount = invoices.reduce(
      (total, invoice) => total + invoice.amountOutstanding,
      0,
    );
    const exceptions = invoices.filter((invoice) =>
      ["disputed", "awaiting_remittance", "needs_ap_contact"].includes(
        invoice.status,
      ),
    ).length;
    const missedPromises = invoices.filter(
      (invoice) => invoice.status === "missed_promise",
    ).length;

    return {
      ...client,
      overdueAmount,
      actionCount: invoices.filter((i) => i.amountOutstanding > 0).length,
      exceptions,
      missedPromises,
      risk:
        exceptions + missedPromises >= 3
          ? ("high" as const)
          : exceptions + missedPromises >= 1
            ? ("med" as const)
            : ("low" as const),
    };
  });

  const totalOverdue = clients.reduce(
    (total, client) => total + client.overdueAmount,
    0,
  );
  const totalActions = clients.reduce(
    (total, client) => total + client.actionCount,
    0,
  );
  const totalExceptions = clients.reduce(
    (total, client) => total + client.exceptions,
    0,
  );

  return (
    <div className="flex flex-col gap-5">
      <section>
        <div className="zn-label mb-1.5">Sample portfolio</div>
        <h1 className="zn-page-h1">Client portfolio</h1>
        <p className="mt-1.5 max-w-[580px] text-[13.5px] text-[#6b6253] dark:text-[#8a7d69]">
          A preview of how bookkeepers manage multiple businesses in one pane.
          Available on Bookkeeper plans — your data stays in its own workspace.
        </p>
      </section>

      {/* Summary stats */}
      <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="zn-stat">
          <div className="zn-label">Clients</div>
          <div className="zn-stat-num mt-2">{clients.length}</div>
        </div>
        <div className="zn-stat">
          <div className="zn-label">Total overdue</div>
          <div className="zn-stat-num mt-2" style={{ color: "var(--zn-accent)" }}>
            {formatCurrency(totalOverdue)}
          </div>
        </div>
        <div className="zn-stat">
          <div className="zn-label">Actions today</div>
          <div className="zn-stat-num mt-2">{totalActions}</div>
        </div>
        <div className="zn-stat">
          <div className="zn-label">Exceptions</div>
          <div className="zn-stat-num mt-2" style={{ color: "var(--zn-risk)" }}>
            {totalExceptions}
          </div>
        </div>
      </div>

      {/* Client cards grid */}
      <section className="grid gap-3.5 lg:grid-cols-2">
        {clients.map((client) => {
          const initials = client.business.name
            .split(/\s+/)
            .slice(0, 2)
            .map((p) => p[0])
            .join("")
            .toUpperCase();
          const riskClass =
            client.risk === "high"
              ? "zn-risk-high"
              : client.risk === "med"
                ? "zn-risk-med"
                : "zn-risk-low";
          const riskLabel =
            client.risk === "high"
              ? "High risk"
              : client.risk === "med"
                ? "Medium risk"
                : "Low risk";
          return (
            <div key={client.id} className="zn-card p-[18px]">
              <div className="flex items-start justify-between gap-3 mb-3.5">
                <div className="flex items-start gap-3 min-w-0">
                  <span
                    className="size-9 rounded-lg inline-flex items-center justify-center text-[12px] font-semibold flex-shrink-0"
                    style={{
                      background: "var(--zn-accent)",
                      color: "var(--zn-accent-ink)",
                    }}
                  >
                    {initials}
                  </span>
                  <div className="min-w-0">
                    <div className="text-[14px] font-semibold text-[#1d1813] dark:text-[#f0e8d5] truncate">
                      {client.business.name}
                    </div>
                    <div className="text-[12px] text-[#6b6253] dark:text-[#8a7d69] truncate">
                      {client.portfolioLabel} · {client.primaryContactName}
                    </div>
                  </div>
                </div>
                <span className={`zn-risk-chip ${riskClass} flex-shrink-0`}>
                  <span className="zn-risk-dot" />
                  {riskLabel}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2.5 mb-3.5">
                {[
                  { label: "Overdue", value: formatCurrency(client.overdueAmount), tone: "var(--zn-accent)" },
                  { label: "Actions", value: String(client.actionCount), tone: "var(--zn-ink)" },
                  { label: "Exceptions", value: String(client.exceptions), tone: client.exceptions > 0 ? "var(--zn-risk)" : "var(--zn-ink)" },
                ].map((s) => (
                  <div
                    key={s.label}
                    className="rounded-[10px] p-2.5"
                    style={{
                      background: "var(--zn-surface-2)",
                      border: "1px solid var(--zn-line-soft)",
                    }}
                  >
                    <div className="zn-label !p-0" style={{ fontSize: 9.5 }}>{s.label}</div>
                    <div className="text-[16px] font-semibold tabular-nums mt-1" style={{ color: s.tone }}>
                      {s.value}
                    </div>
                  </div>
                ))}
              </div>

              <Link
                href="/dashboard"
                className="zn-pill zn-pill-ghost w-full justify-center"
              >
                Open sample chase plan
                <ArrowRight className="size-3.5" />
              </Link>
            </div>
          );
        })}
      </section>
    </div>
  );
}
