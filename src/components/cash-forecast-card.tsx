"use client";

/**
 * Cash forecast card — appears on the dashboard.
 *
 * Shows expected cash inflow over the next 30/60/90 days based on invoice
 * promise dates, due dates, and customer risk. Includes an "at risk" figure
 * for invoices unlikely to be collected without escalation.
 *
 * Reads invoices from localStorage (cashpilot format) using the same pattern
 * as ChaseQueueDataWrapper, so it works for both demo and real-data flows.
 */

import { useMemo } from "react";
import Link from "next/link";
import { ArrowRight, Calendar, TrendingDown, TrendingUp } from "lucide-react";
import { computeCashForecast, type ForecastWindow } from "@/lib/cash-forecast";
import { readLocalAccount } from "@/lib/demo-auth";
import { demoCashpilotInvoices as demoInvoices } from "@/lib/demo-data/zentra-demo-data";
import { importedInvoicesStorageKey } from "@/lib/import/zentra-import";
import {
  readActiveClientId,
  clientInvoicesKey,
} from "@/lib/bookkeeper-clients";
import { formatCurrency } from "@/lib/formatters";
import type { Invoice } from "@/types/cashpilot";

const demoInvoiceStateStorageKey = "zentra.demoInvoiceState.v1";
const BOOKKEEPER_PLAN_IDS = ["bookkeeper_starter", "bookkeeper_pro"];

function resolveInvoiceKey(planId: string): string {
  if (BOOKKEEPER_PLAN_IDS.includes(planId)) {
    const activeClientId = readActiveClientId();
    if (activeClientId && activeClientId !== "all") {
      return clientInvoicesKey(activeClientId);
    }
  }
  return importedInvoicesStorageKey;
}

function readInvoicesForForecast(): Invoice[] {
  if (typeof window === "undefined") return [];
  const localAccount = readLocalAccount();
  const isDemo = localAccount?.planId === "demo";

  if (isDemo) {
    const stored = window.localStorage.getItem(demoInvoiceStateStorageKey);
    if (!stored) return demoInvoices as Invoice[];
    try {
      const parsed = JSON.parse(stored) as Invoice[];
      return Array.isArray(parsed) && parsed.length ? parsed : (demoInvoices as Invoice[]);
    } catch {
      return demoInvoices as Invoice[];
    }
  }

  const storageKey = resolveInvoiceKey(localAccount?.planId ?? "");
  const stored = window.localStorage.getItem(storageKey);
  if (!stored) return [];
  try {
    const parsed = JSON.parse(stored) as Invoice[];
    return Array.isArray(parsed) && parsed.length ? parsed : [];
  } catch {
    return [];
  }
}

// ── Window pill ───────────────────────────────────────────────────────────────

function WindowPill({ window }: { window: ForecastWindow }) {
  const label = window === "30" ? "Next 30d" : window === "60" ? "31–60d" : "61–90d";
  return (
    <span
      className="text-[10px] font-semibold tracking-[0.04em] px-1.5 py-0.5 rounded-md"
      style={{
        background: "var(--zn-surface-2)",
        color: "var(--zn-ink-2)",
        border: "1px solid var(--zn-line-soft)",
      }}
    >
      {label}
    </span>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function CashForecastCard() {
  const invoices = useMemo(() => readInvoicesForForecast(), []);
  const forecast = useMemo(() => computeCashForecast(invoices), [invoices]);

  // Don't render if there's literally nothing to forecast
  if (forecast.totalOpen === 0) return null;

  const totalExpected = forecast.next30 + forecast.next60 + forecast.next90;
  const expectedPct = forecast.totalOpen > 0
    ? Math.round((totalExpected / forecast.totalOpen) * 100)
    : 0;

  return (
    <div
      className="zn-card my-4"
      style={{
        background: "var(--zn-surface)",
        border: "1px solid var(--zn-line-soft)",
        borderRadius: 14,
        padding: "20px 22px",
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Calendar className="size-3.5" style={{ color: "var(--zn-ink-3)" }} />
            <span
              className="text-[10.5px] font-semibold uppercase tracking-[0.12em]"
              style={{ color: "var(--zn-ink-3)" }}
            >
              Cash forecast
            </span>
          </div>
          <p className="text-[12.5px] leading-5" style={{ color: "var(--zn-ink-3)" }}>
            Expected inflow based on promise dates, due dates, and customer risk.
            Probability-weighted — conservative estimate.
          </p>
        </div>
        <div className="text-right shrink-0 ml-4">
          <div
            className="text-[20px] font-semibold tabular-nums leading-tight"
            style={{ color: "var(--zn-ink)" }}
          >
            {formatCurrency(totalExpected)}
          </div>
          <div className="text-[11px]" style={{ color: "var(--zn-ink-3)" }}>
            {expectedPct}% of {formatCurrency(forecast.totalOpen)} open
          </div>
        </div>
      </div>

      {/* Three time buckets */}
      <div className="grid gap-3 sm:grid-cols-3">
        <ForecastBucket
          label="Next 30 days"
          amount={forecast.next30}
          accent
        />
        <ForecastBucket
          label="31–60 days"
          amount={forecast.next60}
        />
        <ForecastBucket
          label="61–90 days"
          amount={forecast.next90}
        />
      </div>

      {/* At risk + top payers */}
      <div className="mt-4 pt-4 grid gap-4 md:grid-cols-2" style={{ borderTop: "1px solid var(--zn-line-soft)" }}>
        {/* At risk */}
        <div className="flex items-start gap-3">
          <div
            className="flex size-7 shrink-0 items-center justify-center rounded-md"
            style={{
              background: forecast.atRisk > 0 ? "var(--zn-risk-soft)" : "var(--zn-surface-2)",
              color: forecast.atRisk > 0 ? "var(--zn-risk)" : "var(--zn-ink-3)",
            }}
          >
            <TrendingDown className="size-3.5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--zn-ink-3)" }}>
              At risk
            </p>
            <p
              className="text-[16px] font-semibold tabular-nums"
              style={{ color: forecast.atRisk > 0 ? "var(--zn-risk)" : "var(--zn-ink)" }}
            >
              {formatCurrency(forecast.atRisk)}
            </p>
            <p className="text-[11.5px] leading-4" style={{ color: "var(--zn-ink-3)" }}>
              Long-overdue from high-risk customers
            </p>
          </div>
        </div>

        {/* Top payers */}
        {forecast.topPayers.length > 0 && (
          <div>
            <p
              className="text-[11px] font-semibold uppercase tracking-[0.08em] mb-1.5"
              style={{ color: "var(--zn-ink-3)" }}
            >
              Top expected payers
            </p>
            <div className="space-y-1.5">
              {forecast.topPayers.map((p) => (
                <div key={p.customerName} className="flex items-center gap-2">
                  <TrendingUp className="size-3 shrink-0" style={{ color: "var(--zn-safe)" }} />
                  <span className="text-[12.5px] truncate flex-1" style={{ color: "var(--zn-ink-2)" }}>
                    {p.customerName}
                  </span>
                  <WindowPill window={p.window} />
                  <span
                    className="text-[12.5px] tabular-nums font-medium ml-2"
                    style={{ color: "var(--zn-ink)" }}
                  >
                    {formatCurrency(p.expectedAmount)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer disclaimer + link */}
      <div className="mt-4 pt-3 flex items-center justify-between" style={{ borderTop: "1px solid var(--zn-line-soft)" }}>
        <p className="text-[11px] leading-4" style={{ color: "var(--zn-ink-3)" }}>
          Forecast is an estimate — not a guarantee. Re-import for latest figures.
        </p>
        <Link
          href="/chase-today"
          className="inline-flex items-center gap-1 text-[11.5px] font-medium hover:underline"
          style={{ color: "var(--zn-ink-2)" }}
        >
          Open chase plan
          <ArrowRight className="size-3" />
        </Link>
      </div>
    </div>
  );
}

// ── Bucket sub-component ──────────────────────────────────────────────────────

function ForecastBucket({
  label,
  amount,
  accent = false,
}: {
  label: string;
  amount: number;
  accent?: boolean;
}) {
  return (
    <div
      className="rounded-lg px-3.5 py-3"
      style={{
        background: accent ? "var(--zn-bg-2)" : "var(--zn-surface-2)",
        border: "1px solid var(--zn-line-soft)",
      }}
    >
      <p
        className="text-[10.5px] font-semibold uppercase tracking-[0.1em]"
        style={{ color: "var(--zn-ink-3)" }}
      >
        {label}
      </p>
      <p
        className="mt-1 text-[20px] font-semibold tabular-nums leading-tight"
        style={{ color: accent ? "var(--zn-accent)" : "var(--zn-ink)" }}
      >
        {formatCurrency(amount)}
      </p>
    </div>
  );
}
