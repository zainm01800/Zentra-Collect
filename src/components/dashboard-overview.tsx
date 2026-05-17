"use client";

import React from "react";
import Link from "next/link";
import {
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Clock,
  TrendingUp,
  ShieldAlert,
  UserX,
  AlertTriangle,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/formatters";
import {
  getDashboardStats,
  sortInvoicesByPriority,
  getSuggestedAction,
  getInvoiceUrgency,
} from "@/lib/invoice-logic";
import type { Invoice } from "@/types/zentra";
// invoice-logic uses legacy cashpilot Invoice type; cast is safe at runtime
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyInvoiceArr = any[];

interface DashboardOverviewProps {
  invoices: Invoice[];
  onReviewAction?: (invoice: Invoice) => void;
}

// ── Derived helpers ───────────────────────────────────────────────────────────

function getRiskInsights(invoices: Invoice[]) {
  const overdue = invoices.filter((i) => (i.daysOverdue ?? 0) > 0 && i.status !== "paid");

  // Group by customer to find repeat late payers
  const byCustomer: Record<string, Invoice[]> = {};
  for (const inv of overdue) {
    byCustomer[inv.customerName] = [...(byCustomer[inv.customerName] ?? []), inv];
  }
  const repeatLatePayers = Object.values(byCustomer).filter((invs) => invs.length > 1);

  // Biggest overdue balance by customer
  const customerTotals = Object.entries(byCustomer).map(([name, invs]) => ({
    customer: name,
    amount: invs.reduce((sum, i) => sum + (i.amountOutstanding ?? i.amount ?? 0), 0),
  }));
  customerTotals.sort((a, b) => b.amount - a.amount);

  // Missed promises
  const now = Date.now();
  const missedPromises = invoices.filter(
    (i) => i.promisedPaymentDate && new Date(i.promisedPaymentDate).getTime() < now && i.status !== "paid",
  );

  // Highest-risk by amount × days overdue
  const scored = overdue.map((i) => ({
    name: i.customerName,
    score: (i.daysOverdue ?? 0) * (i.amountOutstanding ?? i.amount ?? 0),
  }));
  scored.sort((a, b) => b.score - a.score);

  return {
    highestRiskCustomer: scored[0]?.name ?? null,
    biggestBalance: customerTotals[0] ?? null,
    repeatLatePayersCount: repeatLatePayers.length,
    missedPromisesCount: missedPromises.length,
  };
}

function getWeeklyBrief(invoices: Invoice[]) {
  const weekEnd = Date.now() + 7 * 86_400_000;
  const likelyToPay = invoices.filter(
    (i) =>
      i.promisedPaymentDate &&
      new Date(i.promisedPaymentDate).getTime() <= weekEnd &&
      i.status !== "paid",
  );
  const cashLikelyToLand = likelyToPay.reduce(
    (sum, i) => sum + (i.amountOutstanding ?? i.amount ?? 0),
    0,
  );
  const top3NeedsAttention = (sortInvoicesByPriority(
    invoices.filter((i) => (i.daysOverdue ?? 0) > 0 && i.status !== "paid") as AnyInvoiceArr,
  ) as unknown as Invoice[]).slice(0, 3);

  return { cashLikelyToLand, top3NeedsAttention };
}

// ── Component ─────────────────────────────────────────────────────────────────

export function DashboardOverview({ invoices, onReviewAction }: DashboardOverviewProps) {
  const stats = getDashboardStats(invoices as AnyInvoiceArr);
  const risk = getRiskInsights(invoices);
  const brief = getWeeklyBrief(invoices);

  const focusInvoices = (sortInvoicesByPriority(
    invoices.filter((i) => (i.daysOverdue ?? 0) > 0 && i.status !== "paid") as AnyInvoiceArr,
  ) as unknown as Invoice[]).slice(0, 5);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {[
          {
            label: "Cash needing attention",
            value: formatCurrency(stats.overdueAmount),
            sub: `${stats.overdueCount} overdue`,
            Icon: AlertCircle,
            color: "var(--zn-risk)",
          },
          {
            label: "Actions today",
            value: String(stats.needsActionToday),
            sub: "urgent follow-ups",
            Icon: CheckCircle2,
            color: "var(--zn-warn)",
          },
          {
            label: "Disputes",
            value: String(stats.disputedInvoices),
            sub: "blocked by dispute",
            Icon: ShieldAlert,
            color: "var(--zn-ink-3)",
          },
          {
            label: "Promises",
            value: String(stats.promisedPayments),
            sub: "payment dates given",
            Icon: Clock,
            color: "var(--zn-safe)",
          },
          {
            label: "Likely this week",
            value: formatCurrency(brief.cashLikelyToLand),
            sub: "promised this week",
            Icon: TrendingUp,
            color: "var(--zn-safe)",
          },
        ].map(({ label, value, sub, Icon, color }) => (
          <div
            key={label}
            className="rounded-xl p-4"
            style={{ background: "var(--zn-surface)", border: "1px solid var(--zn-line-soft)" }}
          >
            <div className="flex items-center gap-2 mb-2">
              <Icon className="size-3.5" style={{ color }} />
              <p className="text-[11px] font-medium" style={{ color: "var(--zn-ink-3)" }}>{label}</p>
            </div>
            <p className="text-[22px] font-bold tracking-tight" style={{ color: "var(--zn-ink)" }}>{value}</p>
            <p className="text-[11px] mt-0.5" style={{ color: "var(--zn-ink-3)" }}>{sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Today's focus */}
        <div className="lg:col-span-8 space-y-6">
          <div
            className="rounded-xl overflow-hidden"
            style={{ background: "var(--zn-surface)", border: "1px solid var(--zn-line-soft)" }}
          >
            <div
              className="flex items-center justify-between px-4 py-3 border-b"
              style={{ borderColor: "var(--zn-line-soft)", background: "var(--zn-bg-2)" }}
            >
              <div>
                <p className="text-[13.5px] font-semibold" style={{ color: "var(--zn-ink)" }}>Today&rsquo;s focus</p>
                <p className="text-[11.5px]" style={{ color: "var(--zn-ink-3)" }}>High priority actions recommended for today.</p>
              </div>
              <Link
                href="/chase-today"
                className="flex items-center gap-1 text-[12.5px] font-semibold hover:underline"
                style={{ color: "var(--zn-ink)" }}
              >
                Full queue <ArrowRight className="size-3.5" />
              </Link>
            </div>
            <div className="divide-y" style={{ borderColor: "var(--zn-line-soft)" }}>
              {focusInvoices.length === 0 ? (
                <div className="px-4 py-8 text-center text-[13px]" style={{ color: "var(--zn-ink-3)" }}>
                  No urgent actions today — you&rsquo;re on top of it.
                </div>
              ) : (
                focusInvoices.map((invoice) => {
                  const urgency = getInvoiceUrgency(invoice as never);
                  const urgencyColor =
                    urgency === "Critical" || urgency === "High"
                      ? "var(--zn-risk)"
                      : urgency === "Medium"
                        ? "var(--zn-warn)"
                        : "var(--zn-ink-3)";
                  return (
                    <button
                      key={invoice.id}
                      type="button"
                      onClick={() => onReviewAction?.(invoice)}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[var(--zn-surface-2)] transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-[13.5px] font-medium truncate" style={{ color: "var(--zn-ink)" }}>
                          {invoice.customerName}
                        </p>
                        <p className="text-[11.5px] font-mono mt-0.5" style={{ color: "var(--zn-ink-3)" }}>
                          {invoice.invoiceNumber}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[13px] font-medium tabular-nums" style={{ color: "var(--zn-ink)" }}>
                          {formatCurrency(invoice.amountOutstanding ?? invoice.amount ?? 0)}
                        </p>
                        <p className="text-[11px]" style={{ color: urgencyColor }}>
                          {invoice.daysOverdue}d overdue
                        </p>
                      </div>
                      <div
                        className="hidden sm:block shrink-0 text-[11px] font-medium px-2.5 py-1 rounded-full"
                        style={{ background: "var(--zn-bg-2)", color: "var(--zn-ink-2)" }}
                      >
                        {String(getSuggestedAction(invoice as never))}
                      </div>
                      <ArrowRight className="size-3.5 shrink-0" style={{ color: "var(--zn-ink-3)" }} />
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Weekly brief */}
          <div
            className="rounded-xl p-4"
            style={{ background: "var(--zn-surface)", border: "1px solid var(--zn-line-soft)" }}
          >
            <p className="text-[13.5px] font-semibold mb-3" style={{ color: "var(--zn-ink)" }}>
              Weekly collections brief
            </p>
            <div
              className="rounded-xl p-4 mb-4"
              style={{ background: "var(--zn-ink)", color: "var(--zn-bg)" }}
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.15em] mb-1.5 opacity-60">
                Focus for this week
              </p>
              <p className="text-[13px] leading-6">
                Focus on recovering the {formatCurrency(stats.overdueAmount)} in overdue balances.
                {stats.disputedInvoices > 0
                  ? ` Resolve the ${stats.disputedInvoices} active dispute${stats.disputedInvoices > 1 ? "s" : ""} to unblock cash.`
                  : ""}
                {brief.cashLikelyToLand > 0
                  ? ` Aim to collect ${formatCurrency(brief.cashLikelyToLand)} in promised payments this week.`
                  : ""}
              </p>
            </div>
            {brief.top3NeedsAttention.length > 0 && (
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--zn-ink-3)" }}>
                  Top {brief.top3NeedsAttention.length} needing attention
                </p>
                {brief.top3NeedsAttention.map((inv) => (
                  <div
                    key={inv.id}
                    className="flex items-center justify-between gap-2 rounded-lg px-3 py-2.5"
                    style={{ background: "var(--zn-bg-2)" }}
                  >
                    <p className="text-[13px] font-medium truncate" style={{ color: "var(--zn-ink)" }}>
                      {inv.customerName}
                    </p>
                    <div className="flex items-center gap-3 shrink-0">
                      <p className="text-[12px] tabular-nums" style={{ color: "var(--zn-ink-2)" }}>
                        {formatCurrency(inv.amountOutstanding ?? inv.amount ?? 0)}
                      </p>
                      <p className="text-[11px]" style={{ color: "var(--zn-risk)" }}>
                        {inv.daysOverdue}d
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Risk insights sidebar */}
        <div className="lg:col-span-4">
          <div
            className="rounded-xl p-4"
            style={{ background: "var(--zn-surface)", border: "1px solid var(--zn-line-soft)" }}
          >
            <p className="text-[13.5px] font-semibold mb-4" style={{ color: "var(--zn-ink)" }}>
              Risk insights
            </p>
            <div className="space-y-4">
              {[
                {
                  Icon: ShieldAlert,
                  label: "Highest risk customer",
                  value: risk.highestRiskCustomer ?? "None",
                  iconBg: "var(--zn-risk-soft)",
                  iconColor: "var(--zn-risk)",
                },
                {
                  Icon: TrendingUp,
                  label: "Biggest overdue balance",
                  value: risk.biggestBalance
                    ? `${risk.biggestBalance.customer} (${formatCurrency(risk.biggestBalance.amount)})`
                    : "None",
                  iconBg: "var(--zn-warn-soft)",
                  iconColor: "var(--zn-warn)",
                },
                {
                  Icon: UserX,
                  label: "Repeat late payers",
                  value: `${risk.repeatLatePayersCount} customer${risk.repeatLatePayersCount !== 1 ? "s" : ""}`,
                  iconBg: "var(--zn-surface-2)",
                  iconColor: "var(--zn-ink-2)",
                },
                {
                  Icon: AlertTriangle,
                  label: "Missed promises",
                  value: `${risk.missedPromisesCount} missed date${risk.missedPromisesCount !== 1 ? "s" : ""}`,
                  iconBg: "var(--zn-warn-soft)",
                  iconColor: "var(--zn-warn)",
                },
              ].map(({ Icon, label, value, iconBg, iconColor }) => (
                <div key={label} className="flex items-start gap-3">
                  <div
                    className="flex size-8 shrink-0 items-center justify-center rounded-lg mt-0.5"
                    style={{ background: iconBg }}
                  >
                    <Icon className="size-4" style={{ color: iconColor }} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium" style={{ color: "var(--zn-ink-3)" }}>{label}</p>
                    <p className="text-[13px] font-semibold truncate mt-0.5" style={{ color: "var(--zn-ink)" }}>{value}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Due date breakdown */}
            <div className="mt-5 pt-4 border-t space-y-2" style={{ borderColor: "var(--zn-line-soft)" }}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--zn-ink-3)" }}>
                Overdue breakdown
              </p>
              {[
                { label: "1–14 days", filter: (i: Invoice) => (i.daysOverdue ?? 0) >= 1 && (i.daysOverdue ?? 0) <= 14 },
                { label: "15–30 days", filter: (i: Invoice) => (i.daysOverdue ?? 0) >= 15 && (i.daysOverdue ?? 0) <= 30 },
                { label: "31–60 days", filter: (i: Invoice) => (i.daysOverdue ?? 0) >= 31 && (i.daysOverdue ?? 0) <= 60 },
                { label: "60+ days", filter: (i: Invoice) => (i.daysOverdue ?? 0) > 60 },
              ].map(({ label, filter }) => {
                const bucket = invoices.filter((i) => i.status !== "paid" && filter(i));
                const total = bucket.reduce((s, i) => s + (i.amountOutstanding ?? i.amount ?? 0), 0);
                if (bucket.length === 0) return null;
                return (
                  <div key={label} className="flex items-center justify-between gap-2">
                    <p className="text-[12px]" style={{ color: "var(--zn-ink-2)" }}>{label}</p>
                    <div className="text-right">
                      <p className="text-[12px] font-medium tabular-nums" style={{ color: "var(--zn-ink)" }}>
                        {formatCurrency(total)}
                      </p>
                      <p className="text-[10.5px]" style={{ color: "var(--zn-ink-3)" }}>
                        {bucket.length} inv.
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
