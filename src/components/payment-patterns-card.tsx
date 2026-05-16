"use client";

/**
 * Payment patterns insight card — dashboard widget.
 *
 * Surfaces which day of the week the user's customers pay most often,
 * and recommends a chase day based on the pattern. Reads invoices from
 * localStorage (same pattern as DSOCard / CashForecastCard).
 *
 * Hides itself when there isn't enough data yet (< 5 paid invoices).
 */

import { useMemo } from "react";
import { CalendarDays, Lightbulb } from "lucide-react";
import { computePaymentPatterns, type InvoiceForPaymentPattern } from "@/lib/payment-patterns";
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

function readInvoices(): InvoiceForPaymentPattern[] {
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
    return demoInvoices as unknown as InvoiceForPaymentPattern[];
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

export function PaymentPatternsCard() {
  const invoices = useMemo(() => readInvoices(), []);
  const result = useMemo(() => computePaymentPatterns(invoices), [invoices]);

  // Don't render until there's enough data
  if (!result.hasEnoughData) return null;

  // Find the max share so we can scale the bars to fit
  const maxShare = Math.max(...result.byWeekday.map((b) => b.share));

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
      <div className="flex items-start justify-between mb-3 gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <CalendarDays className="size-3.5" style={{ color: "var(--zn-ink-3)" }} />
            <span
              className="text-[10.5px] font-semibold uppercase tracking-[0.12em]"
              style={{ color: "var(--zn-ink-3)" }}
            >
              Payment patterns · last {result.totalPaid} paid
            </span>
          </div>
          <p className="text-[13px] leading-5" style={{ color: "var(--zn-ink-2)" }}>
            {result.summary}
          </p>
        </div>
      </div>

      {/* Day-of-week bar chart */}
      <div className="grid grid-cols-7 gap-2 mb-4">
        {result.byWeekday.map((bucket) => {
          const isTop = bucket.day === result.topDay;
          const height = maxShare > 0 ? Math.max(8, (bucket.share / maxShare) * 64) : 8;
          return (
            <div key={bucket.day} className="flex flex-col items-center gap-1.5">
              <div className="flex-1 flex items-end justify-center" style={{ height: 72 }}>
                <div
                  className="w-full rounded-t-md transition-all"
                  style={{
                    height,
                    background: isTop ? "var(--zn-accent)" : "var(--zn-line)",
                    minHeight: 4,
                  }}
                  title={`${bucket.count} paid (${Math.round(bucket.share * 100)}%)`}
                />
              </div>
              <span
                className="text-[10px] font-semibold tabular-nums"
                style={{ color: isTop ? "var(--zn-ink)" : "var(--zn-ink-3)" }}
              >
                {bucket.day.slice(0, 3)}
              </span>
            </div>
          );
        })}
      </div>

      {/* Tip */}
      <div
        className="flex items-start gap-2 rounded-lg px-3 py-2.5"
        style={{
          background: "var(--zn-bg-2)",
          border: "1px solid var(--zn-line-soft)",
        }}
      >
        <Lightbulb className="size-3.5 shrink-0 mt-0.5" style={{ color: "var(--zn-accent)" }} />
        <p className="text-[12px] leading-5" style={{ color: "var(--zn-ink-2)" }}>
          {result.tip}
        </p>
      </div>
    </div>
  );
}
