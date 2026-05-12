"use client";

/**
 * Compact reports snapshot card for the dashboard.
 * Shows year-to-date net income trend (income − expenses) and links to /reports.
 */

import Link from "next/link";
import { BarChart3, ChevronRight, TrendingDown, TrendingUp } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";

interface ReportsSnapshotProps {
  ytdIncome:   number;
  ytdExpenses: number;
  /** Net income from previous matching period — used to show trend direction. */
  prevPeriodNet?: number;
}

export function ReportsSnapshot({ ytdIncome, ytdExpenses, prevPeriodNet }: ReportsSnapshotProps) {
  const netIncome = ytdIncome - ytdExpenses;
  const margin    = ytdIncome > 0 ? (netIncome / ytdIncome) * 100 : 0;
  const trend     = prevPeriodNet !== undefined && prevPeriodNet !== 0
    ? ((netIncome - prevPeriodNet) / Math.abs(prevPeriodNet)) * 100
    : null;

  return (
    <div className="zn-card p-[22px]">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <div className="zn-label !p-0 mb-1">Reports</div>
          <h2 className="text-[18px] font-semibold" style={{ color: "var(--zn-ink)" }}>
            Year-to-date performance
          </h2>
        </div>
        <Link
          href="/reports"
          className="zn-pill zn-pill-ghost"
          style={{ height: 26, fontSize: 12, padding: "0 11px" }}
        >
          Open reports <ChevronRight className="size-3" />
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div
          className="rounded-[12px] p-4 flex flex-col gap-1"
          style={{ background: "var(--zn-surface-2)", border: "1px solid var(--zn-line-soft)" }}
        >
          <div className="flex items-center gap-1.5">
            <BarChart3 className="size-3.5" style={{ color: "var(--zn-accent)" }} />
            <span className="zn-label !p-0">Net income</span>
          </div>
          <div
            className="text-[22px] font-semibold tabular-nums mt-1"
            style={{ color: netIncome >= 0 ? "var(--zn-safe)" : "var(--zn-risk)" }}
          >
            {formatCurrency(netIncome)}
          </div>
          <div className="text-[11.5px]" style={{ color: "var(--zn-ink-3)" }}>
            {margin.toFixed(0)}% margin
          </div>
        </div>

        <div
          className="rounded-[12px] p-4 flex flex-col gap-1"
          style={{ background: "var(--zn-surface-2)", border: "1px solid var(--zn-line-soft)" }}
        >
          <span className="zn-label !p-0">Income · Expenses</span>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-[15px] font-semibold tabular-nums" style={{ color: "var(--zn-ink)" }}>
              {formatCurrency(ytdIncome)}
            </span>
            <span className="text-[11px]" style={{ color: "var(--zn-ink-3)" }}>in</span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-[15px] font-semibold tabular-nums" style={{ color: "var(--zn-ink-2)" }}>
              {formatCurrency(ytdExpenses)}
            </span>
            <span className="text-[11px]" style={{ color: "var(--zn-ink-3)" }}>out</span>
          </div>
        </div>

        <div
          className="rounded-[12px] p-4 flex flex-col gap-1"
          style={{ background: "var(--zn-surface-2)", border: "1px solid var(--zn-line-soft)" }}
        >
          <span className="zn-label !p-0">Trend</span>
          {trend !== null ? (
            <>
              <div
                className="flex items-center gap-1 mt-1 text-[18px] font-semibold tabular-nums"
                style={{ color: trend >= 0 ? "var(--zn-safe)" : "var(--zn-risk)" }}
              >
                {trend >= 0 ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />}
                <span>{trend >= 0 ? "+" : ""}{trend.toFixed(0)}%</span>
              </div>
              <div className="text-[11.5px]" style={{ color: "var(--zn-ink-3)" }}>
                vs previous period
              </div>
            </>
          ) : (
            <div className="text-[12px] mt-1" style={{ color: "var(--zn-ink-3)" }}>
              Not enough history yet
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
