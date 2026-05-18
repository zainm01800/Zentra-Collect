"use client";

import * as React from "react";
import Link from "next/link";

/**
 * ZnEmptyState — unified zero-data layout.
 *
 * Audit §4: previously /customers, /reports, /chase-today, /portfolio
 * etc. each rendered their own subtly-different empty states. This
 * primitive standardises the visual + CTA pattern.
 */

export interface ZnEmptyStateProps {
  /** Optional icon. Lucide icons work; pass the imported component. */
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  /** Primary CTA — renders as the filled pill. */
  primaryAction?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  /** Secondary CTA — renders as the ghost pill. */
  secondaryAction?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  className?: string;
}

export function ZnEmptyState({
  icon: Icon,
  title,
  description,
  primaryAction,
  secondaryAction,
  className = "",
}: ZnEmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-4 rounded-2xl p-10 sm:p-14 text-center ${className}`}
      style={{ border: "1px solid var(--zn-line-soft)", background: "var(--zn-surface)" }}
    >
      {Icon && (
        <div
          className="size-12 rounded-2xl flex items-center justify-center"
          style={{ background: "var(--zn-bg-2)" }}
        >
          <Icon className="size-5" />
        </div>
      )}
      <div className="max-w-sm">
        <p className="text-[15px] font-semibold" style={{ color: "var(--zn-ink)" }}>
          {title}
        </p>
        {description && (
          <p className="mt-1.5 text-[13px] leading-[1.55]" style={{ color: "var(--zn-ink-3)" }}>
            {description}
          </p>
        )}
      </div>
      {(primaryAction || secondaryAction) && (
        <div className="flex flex-wrap items-center justify-center gap-2 mt-1">
          {primaryAction && <CtaButton action={primaryAction} variant="primary" />}
          {secondaryAction && <CtaButton action={secondaryAction} variant="ghost" />}
        </div>
      )}
    </div>
  );
}

function CtaButton({
  action,
  variant,
}: {
  action: NonNullable<ZnEmptyStateProps["primaryAction"]>;
  variant: "primary" | "ghost";
}) {
  const cls = variant === "primary" ? "zn-pill" : "zn-pill zn-pill-ghost";
  if (action.href) {
    return (
      <Link href={action.href} className={cls}>
        {action.label}
      </Link>
    );
  }
  return (
    <button type="button" onClick={action.onClick} className={cls}>
      {action.label}
    </button>
  );
}
