"use client";

/**
 * DSO (Days Sales Outstanding) card — dashboard widget.
 *
 * The single most important AR health metric. Shows the current 30-day DSO
 * with a trend arrow vs the previous 30 days. A user-facing tooltip explains
 * the formula so they trust the number.
 *
 * Reads invoices from localStorage using the same pattern as ChaseQueueDataWrapper.
 */

import { useMemo } from "react";
import { TrendingDown, TrendingUp, Minus } from "lucide-react";
import { computeDSO, type InvoiceForDSO } from "@/lib/dso";
import { readLocalAccount } from "@/lib/demo-auth";
import { demoCashpilotInvoices as demoInvoices } from "@/lib/demo-data/zentra-demo-data";
import { importedInvoicesStorageKey } from "@/lib/import/zentra-import";
import {
  readActiveClientId,
  clientInvoicesKey,
} from "@/lib/bookkeeper-clients";

const demoInvoiceStateStorageKey = "zentra.demoInvoiceState.v1";
const BOOKKEEPER_PLAN_IDS = ["founding_bookkeeper", "bookkeeper_starter", "bookkeeper_pro"];

function resolveInvoiceKey(planId: string): string {
  if (BOOKKEEPER_PLAN_IDS.includes(planId)) {
    const activeClientId = readActiveClientId();
    if (activeClientId && activeClientId !== "all") {
      return clientInvoicesKey(activeClientId);
    }
  }
  return importedInvoicesStorageKey;
}

function readInvoices(): InvoiceForDSO[] {
  if (typeof window === "undefined") return [];
  const localAccount = readLocalAccount();
  const isDemo = localAccount?.planId === "demo";

  if (isDemo) {
    const stored = window.localStorage.getItem(demoInvoiceStateStorageKey);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length) return parsed;
      } catch { /* fall through */ }
    }
    return demoInvoices as unknown as InvoiceForDSO[];
  }

  const key = resolveInvoiceKey(localAccount?.planId ?? "");
  const stored = window.localStorage.getItem(key);
  if (!stored) return [];
  try {
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function DSOCard() {
  const invoices = useMemo(() => readInvoices(), []);
  const dso = useMemo(() => computeDSO(invoices), [invoices]);

  // No data → don't render
  if (dso.totalAR === 0 && dso.salesPeriod === 0) return null;

  const TrendIcon =
    dso.trend === "improving" ? TrendingDown :
    dso.trend === "worsening" ? TrendingUp :
    Minus;
  const trendColor =
    dso.trend === "improving" ? "var(--zn-safe)" :
    dso.trend === "worsening" ? "var(--zn-risk)" :
    "var(--zn-ink-3)";
  const trendLabel =
    dso.trend === "improving" ? "Improving" :
    dso.trend === "worsening" ? "Worsening" :
    dso.trend === "stable"    ? "Stable" :
    "First period";

  return (
    <div
      className="zn-stat"
      title={`DSO = (Total AR ÷ Sales in period) × ${dso.periodDays} days. Lower is better — fewer days between sale and payment.`}
    >
      <div className="flex items-center justify-between mb-2.5">
        <span className="zn-label">DSO · last {dso.periodDays}d</span>
        <TrendIcon className="size-3.5" style={{ color: trendColor }} />
      </div>
      <div className="zn-stat-num" style={{ color: "var(--zn-ink)" }}>
        {dso.currentDSO !== null ? `${dso.currentDSO}d` : "—"}
      </div>
      <p className="text-[12px] mt-1" style={{ color: trendColor }}>
        {dso.deltaDays !== null && dso.deltaDays !== 0 ? (
          <>
            {dso.deltaDays > 0 ? "+" : ""}
            {dso.deltaDays}d vs previous · {trendLabel}
          </>
        ) : (
          trendLabel
        )}
      </p>
    </div>
  );
}
