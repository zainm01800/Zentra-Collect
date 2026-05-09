"use client";

import React from "react";
import Link from "next/link";
import { ChevronLeft, ShieldAlert, ShieldCheck, ShieldQuestion, Loader2 } from "lucide-react";
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
          <h1 className="text-3xl font-black tracking-tight text-neutral-950 sm:text-4xl">
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
    <div className="group relative overflow-hidden rounded-[2rem] border border-black/5 bg-white p-6 shadow-sm ring-1 ring-black/5 transition-all hover:shadow-md">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-400">
            {label}
          </p>
          <div className="flex items-baseline gap-2">
            <h3 className="text-3xl font-black tracking-tight text-neutral-950">
              {value}
            </h3>
            {trend && (
              <span className={cn(
                "text-xs font-bold",
                trend.positive ? "text-emerald-600" : "text-rose-600"
              )}>
                {trend.value}
              </span>
            )}
          </div>
          {detail && (
            <p className="text-xs font-medium text-neutral-500">{detail}</p>
          )}
        </div>
        {Icon && (
          <div className="rounded-2xl border border-black/5 bg-neutral-50 p-2.5 text-neutral-400 shadow-inner group-hover:text-neutral-900 transition-colors">
            <Icon className="size-5" />
          </div>
        )}
      </div>
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
      "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider",
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
      "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider",
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
    <div className="flex flex-col items-center justify-center rounded-[3rem] border border-dashed border-black/10 bg-white/30 p-12 text-center backdrop-blur-sm">
      <div className="mb-4 flex size-16 items-center justify-center rounded-[2rem] bg-white shadow-sm ring-1 ring-black/5">
        {Icon ? <Icon className="size-8 text-neutral-400" /> : <ShieldQuestion className="size-8 text-neutral-400" />}
      </div>
      <h3 className="text-xl font-bold text-neutral-950">{title}</h3>
      <p className="mt-2 max-w-sm text-base text-neutral-500 leading-relaxed">
        {description}
      </p>
      {action && <div className="mt-6">{action}</div>}
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
        <Loader2 className="size-12 animate-spin text-neutral-900" />
        <div className="absolute inset-0 animate-pulse rounded-full bg-neutral-900/5" />
      </div>
      <p className="text-sm font-bold uppercase tracking-widest text-neutral-400 animate-pulse">
        {message}
      </p>
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
                "inline-flex size-5 items-center justify-center rounded-full text-[10px] font-black",
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
