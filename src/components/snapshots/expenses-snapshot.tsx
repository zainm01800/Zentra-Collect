"use client";

/**
 * Compact expenses snapshot card for the dashboard.
 * Shows this month's expense total, comparison vs last month, and top category.
 */

import Link from "next/link";
import { ChevronRight, Receipt, TrendingDown, TrendingUp } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import type { ExpensesSnapshotData } from "@/lib/snapshots";

interface ExpensesSnapshotProps {
  data: ExpensesSnapshotData;
}

export function ExpensesSnapshot({ data }: ExpensesSnapshotProps) {
  const wentUp   = data.deltaPct > 0;
  const wentDown = data.deltaPct < 0;
  const arrowTone = wentUp ? "var(--zn-warn)" : "var(--zn-safe)";

  return (
    <div className="zn-card p-[22px]">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <div className="zn-label !p-0 mb-1">Expenses</div>
          <h2 className="text-[18px] font-semibold" style={{ color: "var(--zn-ink)" }}>
            This month so far
          </h2>
        </div>
        <Link
          href="/expenses"
          className="zn-pill zn-pill-ghost"
          style={{ height: 26, fontSize: 12, padding: "0 11px" }}
        >
          Open expenses <ChevronRight className="size-3" />
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {/* This month total */}
        <div
          className="rounded-[12px] p-4 flex flex-col gap-1"
          style={{ background: "var(--zn-surface-2)", border: "1px solid var(--zn-line-soft)" }}
        >
          <div className="flex items-center gap-1.5">
            <Receipt className="size-3.5" style={{ color: "var(--zn-accent)" }} />
            <span className="zn-label !p-0">This month</span>
          </div>
          <div className="text-[22px] font-semibold tabular-nums mt-1" style={{ color: "var(--zn-ink)" }}>
            {formatCurrency(data.thisMonthTotal)}
          </div>
          {data.lastMonthTotal > 0 ? (
            <div className="flex items-center gap-1 text-[11.5px]" style={{ color: arrowTone }}>
              {wentUp   ? <TrendingUp   className="size-3" /> :
               wentDown ? <TrendingDown className="size-3" /> : null}
              <span>
                {Math.abs(data.deltaPct).toFixed(0)}% vs last month
              </span>
            </div>
          ) : (
            <div className="text-[11.5px]" style={{ color: "var(--zn-ink-3)" }}>
              First month of tracking
            </div>
          )}
        </div>

        {/* YTD total */}
        <div
          className="rounded-[12px] p-4 flex flex-col gap-1"
          style={{ background: "var(--zn-surface-2)", border: "1px solid var(--zn-line-soft)" }}
        >
          <span className="zn-label !p-0">Year to date</span>
          <div className="text-[22px] font-semibold tabular-nums mt-1" style={{ color: "var(--zn-ink)" }}>
            {formatCurrency(data.ytdTotal)}
          </div>
          <div className="text-[11.5px]" style={{ color: "var(--zn-ink-3)" }}>
            allowable so far
          </div>
        </div>

        {/* Top category */}
        <div
          className="rounded-[12px] p-4 flex flex-col gap-1"
          style={{ background: "var(--zn-surface-2)", border: "1px solid var(--zn-line-soft)" }}
        >
          <span className="zn-label !p-0">Top category</span>
          {data.topCategory ? (
            <>
              <div className="text-[16px] font-semibold mt-1 truncate" style={{ color: "var(--zn-ink)" }}>
                {data.topCategory.name}
              </div>
              <div className="text-[12px] tabular-nums" style={{ color: "var(--zn-ink-3)" }}>
                {formatCurrency(data.topCategory.total)} recent
              </div>
            </>
          ) : (
            <div className="text-[12px] mt-1" style={{ color: "var(--zn-ink-3)" }}>
              No expenses logged yet
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
