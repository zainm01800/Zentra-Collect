"use client";

/**
 * src/app/demo/page.tsx
 *
 * Standalone demo dashboard. Uses only hardcoded mock data from
 * zentra-demo-data.ts. No auth, no localStorage, no Supabase.
 */

import Link from "next/link";
import { ArrowRight, TrendingUp, AlertTriangle, Clock, CheckCircle2, MessageSquare } from "lucide-react";
import { demoInvoices, demoCustomers, demoSingleBusiness } from "@/lib/demo-data/zentra-demo-data";
import type { Invoice } from "@/types/zentra";

function fmtGBP(n: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

function daysLabel(d: number) {
  if (d <= 0) return "Due soon";
  if (d === 1) return "1 day overdue";
  return `${d} days overdue`;
}

function actionFor(inv: Invoice): { label: string; color: string; bg: string } {
  switch (inv.status) {
    case "missed_promise":
      return { label: "Follow up missed promise", color: "var(--zn-risk)", bg: "var(--zn-risk-soft)" };
    case "disputed":
      return { label: "Resolve dispute", color: "var(--zn-risk)", bg: "var(--zn-risk-soft)" };
    case "needs_ap_contact":
      return { label: "Find AP contact", color: "var(--zn-risk)", bg: "var(--zn-risk-soft)" };
    case "overdue":
      return inv.previousChaseCount >= 2
        ? { label: "Send firm reminder", color: "var(--zn-risk)", bg: "var(--zn-risk-soft)" }
        : { label: "Send first reminder", color: "var(--zn-warn)", bg: "var(--zn-warn-soft)" };
    case "awaiting_remittance":
      return { label: "Request remittance", color: "var(--zn-warn)", bg: "var(--zn-warn-soft)" };
    case "awaiting_statement":
      return { label: "Send statement", color: "var(--zn-warn)", bg: "var(--zn-warn-soft)" };
    case "promised":
      return { label: "Monitor promise", color: "var(--zn-ink-3)", bg: "var(--zn-surface-2)" };
    case "due_soon":
      return { label: "No action yet", color: "var(--zn-ink-3)", bg: "var(--zn-surface-2)" };
    default:
      return { label: "No action", color: "var(--zn-ink-3)", bg: "var(--zn-surface-2)" };
  }
}

const open = demoInvoices.filter(
  (inv) => inv.status !== "paid" && (inv.amountOutstanding ?? inv.amount) > 0,
);
const overdue = open.filter((inv) => inv.daysOverdue > 0);
const missedPromises = open.filter((inv) => inv.status === "missed_promise");
const disputed = open.filter((inv) => inv.status === "disputed");
const totalOutstanding = open.reduce((s, inv) => s + inv.amountOutstanding, 0);
const overdueTotal = overdue.reduce((s, inv) => s + inv.amountOutstanding, 0);

const topActions = [...open]
  .filter((inv) => !["promised", "due_soon", "do_not_chase"].includes(inv.status))
  .sort((a, b) => {
    const priority: Record<string, number> = {
      missed_promise: 0, disputed: 1, needs_ap_contact: 2, overdue: 3,
      awaiting_remittance: 4, awaiting_statement: 5,
    };
    const pa = priority[a.status] ?? 9;
    const pb = priority[b.status] ?? 9;
    if (pa !== pb) return pa - pb;
    return b.amountOutstanding - a.amountOutstanding;
  })
  .slice(0, 6);

export default function DemoDashboardPage() {
  return (
    <div className="space-y-6">

      {/* Page header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="zn-section-label">Demo · {demoSingleBusiness.name}</p>
          <h1
            className="text-[28px] font-semibold tracking-[-0.02em] leading-[1.1] mt-1"
            style={{ color: "var(--zn-ink)" }}
          >
            Collections overview
          </h1>
          <p className="mt-1 text-[13.5px]" style={{ color: "var(--zn-ink-3)" }}>
            {open.length} open invoices · {demoCustomers.length} customers
          </p>
        </div>
        <Link
          href="/demo/chase-plan"
          className="zn-pill"
        >
          View chase plan <ArrowRight className="size-3.5" />
        </Link>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard
          label="Total outstanding"
          value={fmtGBP(totalOutstanding)}
          sub={`${open.length} open invoices`}
          icon={<TrendingUp className="size-4" />}
          accent="var(--zn-ink)"
        />
        <KpiCard
          label="Overdue balance"
          value={fmtGBP(overdueTotal)}
          sub={`${overdue.length} invoices`}
          icon={<AlertTriangle className="size-4" />}
          accent="var(--zn-risk)"
        />
        <KpiCard
          label="Missed promises"
          value={String(missedPromises.length)}
          sub="Need follow-up now"
          icon={<Clock className="size-4" />}
          accent="var(--zn-warn)"
        />
        <KpiCard
          label="Active disputes"
          value={String(disputed.length)}
          sub="Blocked from chasing"
          icon={<CheckCircle2 className="size-4" />}
          accent="var(--zn-ink-3)"
        />
      </div>

      {/* Top actions */}
      <div className="zn-card overflow-hidden">
        <div
          className="flex items-center justify-between px-5 py-3.5 border-b"
          style={{ borderColor: "var(--zn-line-soft)" }}
        >
          <p className="text-[13px] font-semibold" style={{ color: "var(--zn-ink)" }}>
            Top actions right now
          </p>
          <Link
            href="/demo/chase-plan"
            className="text-[12px] font-medium hover:underline underline-offset-2"
            style={{ color: "var(--zn-ink-3)" }}
          >
            See full chase plan →
          </Link>
        </div>

        <div className="divide-y" style={{ borderColor: "var(--zn-line-soft)" }}>
          {topActions.map((inv) => {
            const action = actionFor(inv);
            const customer = demoCustomers.find((c) => c.id === inv.customerId);
            return (
              <Link
                key={inv.id}
                href="/demo/chase-plan"
                className="flex items-center gap-4 px-5 py-3.5 hover:bg-[var(--zn-surface-2)] transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium truncate" style={{ color: "var(--zn-ink)" }}>
                    {customer?.name ?? inv.customerName}
                  </p>
                  <p className="text-[11.5px] mt-0.5" style={{ color: "var(--zn-ink-3)" }}>
                    {inv.invoiceNumber} · {daysLabel(inv.daysOverdue)}
                  </p>
                </div>
                <span
                  className="hidden sm:inline-block rounded-full px-2.5 py-0.5 text-[10.5px] font-semibold whitespace-nowrap shrink-0"
                  style={{ background: action.bg, color: action.color }}
                >
                  {action.label}
                </span>
                <p
                  className="text-[13px] font-semibold tabular-nums shrink-0"
                  style={{ color: "var(--zn-ink)" }}
                >
                  {fmtGBP(inv.amountOutstanding)}
                </p>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Demo CTA */}
      <div
        className="rounded-[14px] p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
        style={{ background: "var(--zn-ink)", color: "var(--zn-surface)" }}
      >
        <div>
          <div className="flex items-center gap-2 mb-1">
            <MessageSquare className="size-4 opacity-70" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] opacity-60">
              Ready to try with your own data?
            </span>
          </div>
          <p className="text-[17px] font-semibold leading-snug">
            Upload your AR ageing file and get a ranked chase plan in minutes.
          </p>
          <p className="text-[13px] mt-1 opacity-60">
            14-day free trial · No card required · Works with any CSV export
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Link
            href="/login?mode=signup"
            className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-semibold transition-colors"
            style={{ background: "var(--zn-surface)", color: "var(--zn-ink)" }}
          >
            Start free trial <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </div>

    </div>
  );
}

function KpiCard({
  label, value, sub, icon, accent,
}: {
  label: string;
  value: string;
  sub: string;
  icon: React.ReactNode;
  accent: string;
}) {
  return (
    <div className="zn-card p-4">
      <div className="flex items-center gap-1.5 mb-2" style={{ color: accent }}>
        {icon}
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.07em]">{label}</span>
      </div>
      <p className="text-[24px] font-bold tabular-nums leading-none" style={{ color: accent }}>
        {value}
      </p>
      <p className="text-[11px] mt-1.5" style={{ color: "var(--zn-ink-3)" }}>{sub}</p>
    </div>
  );
}
