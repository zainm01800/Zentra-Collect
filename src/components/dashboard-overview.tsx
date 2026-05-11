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
  ShieldCheck, 
  HelpCircle,
  FileText,
  UserX,
  AlertTriangle
} from "lucide-react";
import { 
  PageHeader, 
  MetricCard, 
  SectionCard, 
  StatusBadge, 
  ActionRow 
} from "./zentra-ui";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { 
  getDashboardStats, 
  getRiskInsights, 
  getWeeklyBrief, 
  getImportDiff,
  sortInvoicesByPriority,
  getSuggestedAction,
  getInvoiceUrgency
} from "@/lib/invoice-logic";
import type { Invoice } from "@/types/cashpilot";

interface DashboardOverviewProps {
  invoices: Invoice[];
  onReviewAction?: (invoice: Invoice) => void;
}

export function DashboardOverview({ invoices, onReviewAction }: DashboardOverviewProps) {
  const stats = getDashboardStats(invoices);
  const risk = getRiskInsights(invoices);
  const brief = getWeeklyBrief(invoices);
  const diff = getImportDiff(invoices);

  // Today's Focus - Top 3-5 highest priority actions
  const focusInvoices = sortInvoicesByPriority(
    invoices.filter(i => i.daysOverdue > 0 && i.status !== "Paid")
  ).slice(0, 5);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <PageHeader 
        title="Dashboard Overview" 
        description="Your collections position at a glance."
      />

      {/* 1. KPI Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <MetricCard 
          label="Cash needing attention" 
          value={formatCurrency(stats.overdueAmount)} 
          icon={AlertCircle}
          detail={`${stats.overdueCount} overdue invoices`}
        />
        <MetricCard 
          label="Actions today" 
          value={stats.needsActionToday} 
          icon={CheckCircle2}
          detail="Urgent follow-ups"
        />
        <MetricCard 
          label="Exceptions" 
          value={stats.disputedInvoices} 
          icon={ShieldAlert}
          detail="Blocked by disputes"
        />
        <MetricCard 
          label="Promises" 
          value={stats.promisedPayments} 
          icon={Clock}
          detail="Due this week"
        />
        <MetricCard 
          label="Likely this week" 
          value={formatCurrency(brief.cashLikelyToLand)} 
          icon={TrendingUp}
          detail="Projected collections"
          trend={{ value: "+12% vs last week", positive: true }}
        />
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* 2. Today's Focus (Main content) */}
        <div className="lg:col-span-8 space-y-6">
          <SectionCard 
            title="Today's focus" 
            description="High priority actions recommended for today."
            actions={
              <Link 
                href={invoices.length > 0 && String(invoices[0].id).startsWith('inv-') ? "/chase-today?demo=true" : "/chase-today"} 
                className="flex items-center gap-1 text-sm font-bold text-neutral-900 hover:underline"
              >
                View full queue
                <ArrowRight className="size-4" />
              </Link>
            }
          >
            <div className="flex flex-col -mx-6 overflow-x-auto lg:overflow-x-visible">
              {focusInvoices.map((invoice, index) => {
                const urgency = getInvoiceUrgency(invoice);
                return (
                  <ActionRow 
                    key={invoice.id}
                    index={index}
                    title={invoice.customerName}
                    subtitle={invoice.invoiceNumber}
                    amount={formatCurrency(invoice.amount)}
                    dueDate={formatDate(invoice.dueDate)}
                    overdueDays={invoice.daysOverdue}
                    action={getSuggestedAction(invoice)}
                    actionDetail={invoice.notes}
                    badges={
                      <StatusBadge 
                        status={`${urgency} urgency`} 
                        variant={urgency === "Critical" || urgency === "High" ? "danger" : urgency === "Medium" ? "warning" : "success"}
                      />
                    }
                    onClick={() => onReviewAction?.(invoice)}
                  />
                );
              })}
              {focusInvoices.length === 0 && (
                <div className="px-6 py-8 text-center text-neutral-500">
                  No urgent actions today. Good job!
                </div>
              )}
            </div>
          </SectionCard>

          {/* 3. What changed since last import */}
          <SectionCard title="What changed since last import" description="Comparison with your previous data snapshot.">
            <div className="grid grid-cols-2 gap-6 sm:grid-cols-3">
              <div className="space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Paid since last</p>
                <p className="text-xl font-bold text-emerald-600">{diff.paidSinceLast} invoices</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Newly overdue</p>
                <p className="text-xl font-bold text-rose-600">{diff.newlyOverdue} invoices</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Newly added</p>
                <p className="text-xl font-bold text-neutral-900">{diff.newlyAdded} invoices</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Missed promises</p>
                <p className="text-xl font-bold text-amber-600">{diff.missedPromises} invoices</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Amount changed</p>
                <p className="text-xl font-bold text-neutral-900">{formatCurrency(diff.amountChanged)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Still overdue</p>
                <p className="text-xl font-bold text-neutral-900">{diff.stillOverdue} invoices</p>
              </div>
            </div>
          </SectionCard>
        </div>

        {/* Sidebar Content */}
        <div className="lg:col-span-4 space-y-8">
          {/* 4. Risk Insights */}
          <SectionCard title="Risk insights">
            <div className="space-y-5">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-600">
                  <ShieldAlert className="size-4" />
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-neutral-400">Highest risk customer</p>
                  <p className="text-sm font-bold text-neutral-950">{risk.highestRiskCustomer || "None"}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-600">
                  <TrendingUp className="size-4" />
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-neutral-400">Biggest overdue balance</p>
                  <p className="text-sm font-bold text-neutral-950">
                    {risk.biggestBalance ? `${risk.biggestBalance.customer} (${formatCurrency(risk.biggestBalance.amount)})` : "None"}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                  <UserX className="size-4" />
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-neutral-400">Repeat late payers</p>
                  <p className="text-sm font-bold text-neutral-950">{risk.repeatLatePayersCount} customers</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-orange-50 text-orange-600">
                  <AlertTriangle className="size-4" />
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-neutral-400">Missed promises</p>
                  <p className="text-sm font-bold text-neutral-950">{risk.missedPromisesCount} missed dates</p>
                </div>
              </div>
            </div>
          </SectionCard>

          {/* 5. Weekly Collections Brief */}
          <SectionCard title="Weekly collections brief">
            <div className="space-y-4">
              <div className="rounded-2xl bg-neutral-950 p-4 text-white">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/50">Focus for this week</p>
                <p className="mt-2 text-sm leading-relaxed">
                  Focus on recovering the {formatCurrency(stats.overdueAmount)} in overdue balances. 
                  {stats.disputedInvoices > 0 ? ` Resolve the ${stats.disputedInvoices} active disputes to unblock cash.` : ""}
                  Aim to collect {formatCurrency(brief.cashLikelyToLand)} projected for this week.
                </p>
              </div>
              
              <div className="space-y-3 pt-2">
                <p className="text-[11px] font-bold uppercase tracking-widest text-neutral-400">Top 3 attention needed</p>
                <div className="space-y-2">
                  {brief.top3NeedsAttention.map((inv) => (
                    <div key={inv.id} className="flex items-center justify-between gap-2 rounded-xl border border-black/5 bg-white p-3">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-bold text-neutral-950">{inv.customerName}</p>
                        <p className="text-[10px] text-neutral-500">{formatCurrency(inv.amount)} · {inv.daysOverdue}d</p>
                      </div>
                      <ArrowRight className="size-3 text-neutral-300" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
