"use client";

import React from "react";
import Link from "next/link";
import { 
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  ShieldCheck,
  ShieldQuestion,
  Loader2,
  Mail,
  Phone,
  Flag,
  CheckCircle2,
  MoreVertical,
  Clock
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * PageHeader - Standardized header for all main screens
 */
export function PageHeader({
  title,
  description,
  backHref,
  actions,
  breadcrumbs,
}: {
  title: string;
  description?: string;
  backHref?: string;
  actions?: React.ReactNode;
  breadcrumbs?: Array<{ label: string; href: string }>;
}) {
  return (
    <div className="mb-8 space-y-4">
      {breadcrumbs && (
        <nav className="flex items-center gap-2 text-xs font-medium text-neutral-400 uppercase tracking-widest">
          {breadcrumbs.map((crumb, i) => (
            <React.Fragment key={crumb.href}>
              <Link href={crumb.href} className="hover:text-neutral-900 transition-colors">
                {crumb.label}
              </Link>
              {i < breadcrumbs.length - 1 && <span>/</span>}
            </React.Fragment>
          ))}
        </nav>
      )}
      
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          {backHref && (
            <Link 
              href={backHref} 
              className="group mb-2 flex items-center gap-1 text-sm font-medium text-neutral-500 hover:text-neutral-900 transition-colors"
            >
              <ChevronLeft className="size-4 transition-transform group-hover:-translate-x-0.5" />
              Back
            </Link>
          )}
          <h1 className="text-3xl font-bold tracking-tight text-neutral-950 sm:text-4xl">
            {title}
          </h1>
          {description && (
            <p className="max-w-2xl text-base text-neutral-500 leading-relaxed">
              {description}
            </p>
          )}
        </div>
        {actions && <div className="flex items-center gap-3">{actions}</div>}
      </div>
    </div>
  );
}

/**
 * MetricCard - Clean metrics for dashboards
 */
export function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  trend,
}: {
  label: string;
  value: string | number;
  detail?: string;
  icon?: React.ElementType;
  trend?: { value: string; positive: boolean };
}) {
  return (
    <div className="flex flex-col rounded-2xl border border-black/8 bg-white p-5 xl:p-6">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-400">
          {label}
        </p>
        {Icon && <Icon className="size-4 text-neutral-300 flex-shrink-0" />}
      </div>
      <p className="mt-3 text-[22px] font-bold tracking-tight text-neutral-950 leading-none lg:text-[26px]">
        {value}
      </p>
      {detail && (
        <p className="mt-1.5 text-[12px] text-neutral-400">{detail}</p>
      )}
      {trend && (
        <div className={cn(
          "mt-3 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold",
          trend.positive ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
        )}>
          {trend.value}
        </div>
      )}
    </div>
  );
}

/**
 * SectionCard - Base card for sections
 */
export function SectionCard({
  title,
  description,
  children,
  className,
  actions,
  footer,
}: {
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  actions?: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className={cn(
      "overflow-hidden rounded-[2rem] border border-black/10 bg-white/70 shadow-sm backdrop-blur-sm",
      className
    )}>
      {(title || actions) && (
        <div className="flex items-center justify-between border-b border-black/5 p-6 pb-5">
          <div className="space-y-1">
            {title && <h3 className="text-lg font-bold text-neutral-950">{title}</h3>}
            {description && <p className="text-sm text-neutral-500">{description}</p>}
          </div>
          {actions && <div>{actions}</div>}
        </div>
      )}
      <div className="p-6">{children}</div>
      {footer && (
        <div className="border-t border-black/5 bg-neutral-50/50 p-4 px-6">
          {footer}
        </div>
      )}
    </div>
  );
}

/**
 * StatusBadge - Consistent status pill
 */
export function StatusBadge({ 
  status, 
  variant = "neutral" 
}: { 
  status: string; 
  variant?: "neutral" | "success" | "warning" | "danger" | "info" 
}) {
  const variants = {
    neutral: "bg-neutral-100 text-neutral-600 border-neutral-200",
    success: "bg-emerald-50 text-emerald-700 border-emerald-100",
    warning: "bg-amber-50 text-amber-700 border-amber-100",
    danger: "bg-rose-50 text-rose-700 border-rose-100",
    info: "bg-blue-50 text-blue-700 border-blue-100",
  };

  return (
    <span className={cn(
      "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold whitespace-nowrap",
      variants[variant]
    )}>
      {status}
    </span>
  );
}

/**
 * SafetyBadge - High-level collections safety
 */
export function SafetyBadge({ 
  level 
}: { 
  level: "safe" | "review" | "blocked" | string 
}) {
  const config: Record<string, { label: string; icon: any; class: string }> = {
    safe: { label: "Safe to chase", icon: ShieldCheck, class: "bg-emerald-50 text-emerald-700 border-emerald-100" },
    review: { label: "Needs review", icon: ShieldQuestion, class: "bg-amber-50 text-amber-700 border-amber-100" },
    blocked: { label: "Blocked", icon: ShieldAlert, class: "bg-rose-50 text-rose-700 border-rose-100" },
  };

  const current = config[level.toLowerCase()] || { label: level, icon: ShieldQuestion, class: "bg-neutral-50 text-neutral-700 border-neutral-100" };

  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider",
      current.class
    )}>
      <current.icon className="size-3" />
      {current.label}
    </span>
  );
}

/**
 * EmptyState - Helping users get started
 */
export function EmptyState({
  title,
  description,
  icon: Icon,
  action,
}: {
  title: string;
  description: string;
  icon?: React.ElementType;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#d4c9ae] bg-[#f3ecd8]/40 p-12 text-center">
      <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-[#faf5e8] border border-[#d4c9ae]">
        {Icon ? <Icon className="size-7 text-[#8d8472]" /> : <ShieldQuestion className="size-7 text-[#8d8472]" />}
      </div>
      <h3 className="text-[17px] font-semibold text-[#1d1813]">{title}</h3>
      <p className="mt-2 max-w-sm text-[14px] text-[#6b6253] leading-relaxed">
        {description}
      </p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/**
 * LoadingOverlay - For drafts and transitions
 */
export function LoadingOverlay({ 
  message = "Thinking..." 
}: { 
  message?: string 
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 space-y-4">
      <div className="relative flex size-12 items-center justify-center">
        <Loader2 className="size-12 animate-spin text-[#b8481f]" />
        <div className="absolute inset-0 animate-pulse rounded-full bg-[#b8481f]/5" />
      </div>
      <p className="zn-label animate-pulse">{message}</p>
    </div>
  );
}

/**
 * PillTabs - Better than standard tabs
 */
export function PillTabs({
  tabs,
  activeTab,
  onTabChange,
}: {
  tabs: Array<{ id: string; label: string; count?: number }>;
  activeTab: string;
  onTabChange: (id: string) => void;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              "flex h-10 shrink-0 items-center gap-2 rounded-full border px-5 text-sm font-bold transition-all",
              isActive
                ? "bg-neutral-950 text-white shadow-lg border-transparent"
                : "border-black/5 bg-white text-neutral-500 hover:border-black/10 hover:bg-neutral-50"
            )}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span className={cn(
                "inline-flex size-5 items-center justify-center rounded-full text-[10px] font-bold",
                isActive ? "bg-white/20 text-white" : "bg-black/5 text-neutral-400"
              )}>
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/**
 * ActionRow - Premium table row for collections lists
 */
export function ActionRow({
  index,
  title,
  subtitle,
  amount,
  dueDate,
  overdueDays,
  action,
  actionDetail,
  badges,
  onClick,
  isSelected,
}: {
  index?: number;
  title: string;
  subtitle?: string;
  amount: string;
  dueDate: string;
  overdueDays?: number;
  action: string;
  actionDetail?: string;
  badges?: React.ReactNode;
  onClick: () => void;
  isSelected?: boolean;
}) {
  const gridTemplate = "48px minmax(160px, 2.2fr) minmax(100px, 1fr) minmax(110px, 1.2fr) minmax(90px, 1fr) minmax(180px, 2fr) minmax(110px, 1.2fr) minmax(100px, 1fr) 48px";

  const getActionIcon = (actionStr: string) => {
    const s = actionStr.toLowerCase();
    if (s.includes("call")) return <Phone className="size-4 text-[#1d1813]" />;
    if (s.includes("dispute")) return <Flag className="size-4 text-[#6b6253]" />;
    if (s.includes("reminder")) return <Mail className="size-4 text-[#1d1813]" />;
    if (s.includes("no action")) return <CheckCircle2 className="size-4 text-[#4f6b3e]" />;
    return <Mail className="size-4 text-[#1d1813]" />;
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group w-full text-left transition-all duration-150 border-b border-[#e0d6bd] last:border-0",
        isSelected ? "bg-[#f0d3c2]/40" : "hover:bg-[#f3ecd8]/60"
      )}
    >
      <div
        className="hidden lg:grid items-center gap-x-4 px-6 py-3.5"
        style={{ gridTemplateColumns: gridTemplate }}
      >
        {/* Index */}
        <div className="flex justify-center">
          <span className="text-[12px] font-medium text-[#8d8472] tabular-nums" style={{ fontFamily: "var(--font-newsreader), ui-serif" }}>
            {index !== undefined ? index + 1 : "-"}
          </span>
        </div>

        {/* Title + Subtitle (Customer) */}
        <div className="min-w-0">
          <p className="truncate text-[13.5px] font-semibold text-[#1d1813]">
            {title}
          </p>
          {subtitle && (
            <p className="mt-0.5 text-[11.5px] font-medium text-[#8d8472]">
              {subtitle}
            </p>
          )}
        </div>

        {/* Amount */}
        <div className="min-w-0">
          <p className="text-[13.5px] font-semibold text-[#1d1813] tabular-nums">
            {amount}
          </p>
        </div>

        {/* Oldest Invoice (Date) */}
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-[#6b6253]">
            {dueDate}
          </p>
        </div>

        {/* Overdue */}
        <div className="min-w-0">
          {overdueDays && overdueDays > 0 ? (
            <p className="text-[13px] font-semibold text-[#9a3535]">
              {overdueDays}d
            </p>
          ) : (
            <p className="text-[13px] font-medium text-[#b8ac8c]">—</p>
          )}
        </div>

        {/* Next Action */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex-shrink-0">
            {getActionIcon(action)}
          </div>
          <p className="truncate text-[13px] font-medium text-[#3d362c]">
            {action}
          </p>
        </div>

        {/* Risk (Badges) */}
        <div className="flex min-w-0 items-center">
          {badges}
        </div>

        {/* Review Button */}
        <div className="flex justify-end">
          <span className="inline-flex h-7 items-center justify-center rounded-full border border-[#d4c9ae] bg-[#f3ecd8] px-4 text-[11.5px] font-medium text-[#6b6253] transition-all group-hover:bg-[#b8481f] group-hover:text-[#faf5e8] group-hover:border-[#b8481f]">
            Review
          </span>
        </div>

        {/* More Menu */}
        <div className="flex justify-center text-[#b8ac8c] group-hover:text-[#6b6253]">
          <MoreVertical className="size-4" />
        </div>
      </div>

      {/* Mobile/Compact View */}
      <div className="flex flex-col gap-3 p-5 lg:hidden">
        <div className="flex items-start justify-between">
          <div className="min-w-0">
            <p className="truncate text-[14px] font-semibold text-[#1d1813]">{title}</p>
            <p className="mt-0.5 text-[11px] font-medium text-[#8d8472]">{subtitle}</p>
          </div>
          <p className="text-[14px] font-semibold text-[#1d1813] tabular-nums">{amount}</p>
        </div>
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <p className="text-[13px] font-medium text-[#3d362c]">{action}</p>
            <p className="text-[11px] font-medium text-[#8d8472]">{actionDetail}</p>
          </div>
          <div className="flex items-center gap-2">
            {overdueDays && overdueDays > 0 && (
              <span className="text-[11px] font-semibold text-[#9a3535]">{overdueDays}d late</span>
            )}
            <span className="rounded-full bg-[#1d1813] px-4 py-1.5 text-[11px] font-medium text-[#faf5e8]">Review</span>
          </div>
        </div>
      </div>
    </button>
  );
}

export function CustomerRow({
  index,
  name,
  invoiceCount,
  totalOverdue,
  avgDaysLate,
  status,
  riskBadge,
  onClick,
}: {
  index?: number;
  name: string;
  invoiceCount: number;
  totalOverdue: string;
  avgDaysLate: number;
  status: string;
  riskBadge: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group w-full text-left transition-all duration-150 border-b border-[#e0d6bd] last:border-0 hover:bg-[#f3ecd8]/60"
    >
      <div
        className="hidden lg:grid items-center gap-x-4 px-6 py-4"
        style={{ gridTemplateColumns: "48px minmax(200px, 2.5fr) minmax(100px, 1fr) minmax(120px, 1.2fr) minmax(100px, 1fr) minmax(200px, 2fr) minmax(110px, 1.2fr) 48px" }}
      >
        <div className="flex justify-center">
          <span className="text-[12px] font-medium text-[#8d8472] tabular-nums" style={{ fontFamily: "var(--font-newsreader), ui-serif" }}>
            {index !== undefined ? index + 1 : "-"}
          </span>
        </div>
        <div className="min-w-0">
          <p className="truncate text-[14px] font-semibold text-[#1d1813]">{name}</p>
          <p className="mt-0.5 text-[11.5px] font-medium text-[#8d8472]">{invoiceCount} unpaid invoices</p>
        </div>
        <div className="min-w-0">
          <p className="text-[14px] font-semibold text-[#1d1813] tabular-nums">{totalOverdue}</p>
        </div>
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-[#6b6253]">{avgDaysLate} days avg.</p>
        </div>
        <div className="min-w-0">
          <p className={cn("text-[13px] font-semibold", avgDaysLate > 0 ? "text-[#9a3535]" : "text-[#4f6b3e]")}>
            {avgDaysLate > 0 ? "Overdue" : "On time"}
          </p>
        </div>
        <div className="min-w-0">
          <p className="truncate text-[13px] font-medium text-[#3d362c]">{status}</p>
        </div>
        <div className="flex justify-start">{riskBadge}</div>
        <div className="flex justify-end">
          <ChevronRight className="size-4 text-neutral-300 group-hover:text-neutral-900 transition-colors" />
        </div>
      </div>

      {/* Mobile view */}
      <div className="flex items-center justify-between px-5 py-4 lg:hidden">
        <div className="min-w-0">
          <p className="truncate text-[15px] font-bold text-neutral-950">{name}</p>
          <p className="mt-1 text-[13px] font-medium text-rose-600">{totalOverdue} overdue</p>
        </div>
        <div className="flex items-center gap-3">
          {riskBadge}
          <ChevronRight className="size-4 text-neutral-300" />
        </div>
      </div>
    </button>
  );
}
