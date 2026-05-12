"use client";

/**
 * Compact tax snapshot card for the dashboard.
 * Shows year-to-date tax estimate, profit, and days to next SA payment.
 */

import Link from "next/link";
import { ChevronRight, PiggyBank } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import type { TaxSnapshotData, MtdSnapshotData } from "@/lib/snapshots";

interface TaxSnapshotProps {
  tax: TaxSnapshotData;
  mtd?: MtdSnapshotData;
}

export function TaxSnapshot({ tax, mtd }: TaxSnapshotProps) {
  const urgent  = tax.daysToNextSa <= 30;
  const warning = tax.daysToNextSa <= 90 && !urgent;
  const tone    = urgent ? "var(--zn-risk)" : warning ? "var(--zn-warn)" : "var(--zn-info)";
  const toneBg  = urgent ? "var(--zn-risk-soft)" : warning ? "var(--zn-warn-soft)" : "var(--zn-info-soft)";

  return (
    <div className="zn-card p-[22px]">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <div className="zn-label !p-0 mb-1">Tax & MTD</div>
          <h2 className="text-[18px] font-semibold" style={{ color: "var(--zn-ink)" }}>
            What you owe so far
          </h2>
        </div>
        <Link
          href="/tax"
          className="zn-pill zn-pill-ghost"
          style={{ height: 26, fontSize: 12, padding: "0 11px" }}
        >
          Open tax reserve <ChevronRight className="size-3" />
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {/* Tax owed estimate */}
        <div
          className="rounded-[12px] p-4 flex flex-col gap-1"
          style={{ background: "var(--zn-surface-2)", border: "1px solid var(--zn-line-soft)" }}
        >
          <div className="flex items-center gap-1.5">
            <PiggyBank className="size-3.5" style={{ color: "var(--zn-accent)" }} />
            <span className="zn-label !p-0">Year-to-date tax estimate</span>
          </div>
          <div className="text-[22px] font-semibold tabular-nums mt-1" style={{ color: "var(--zn-ink)" }}>
            {formatCurrency(tax.ytdTaxEstimate)}
          </div>
          <div className="text-[11.5px]" style={{ color: "var(--zn-ink-3)" }}>
            on {formatCurrency(tax.ytdProfit)} profit
          </div>
        </div>

        {/* Next SA payment */}
        <div
          className="rounded-[12px] p-4 flex flex-col gap-1"
          style={{ background: toneBg, border: `1px solid ${tone}` }}
        >
          <span className="zn-label !p-0" style={{ color: tone }}>Next SA payment</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-[22px] font-semibold tabular-nums" style={{ color: tone }}>
              {tax.daysToNextSa}
            </span>
            <span className="text-[12px]" style={{ color: tone }}>days away</span>
          </div>
          <div className="text-[11.5px]" style={{ color: tone, opacity: 0.85 }}>
            {tax.nextSaLabel} — {tax.nextSaDescription}
          </div>
        </div>

        {/* MTD quarter */}
        {mtd ? (
          <div
            className="rounded-[12px] p-4 flex flex-col gap-1"
            style={{ background: "var(--zn-surface-2)", border: "1px solid var(--zn-line-soft)" }}
          >
            <span className="zn-label !p-0">MTD — {mtd.currentQuarter}</span>
            <div className="text-[22px] font-semibold tabular-nums mt-1" style={{ color: "var(--zn-ink)" }}>
              {formatCurrency(mtd.currentQuarterIncome)}
            </div>
            <div className="text-[11.5px]" style={{ color: "var(--zn-ink-3)" }}>
              {mtd.daysToDeadline > 0
                ? `${mtd.daysToDeadline}d to ${mtd.deadlineLabel}`
                : `Overdue — was due ${mtd.deadlineLabel}`}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
