"use client";

/**
 * ArTrendChart — displays DSO trend and aging bucket breakdown over time.
 *
 * Uses SVG sparklines — no chart library required. Two panels:
 *   1. DSO line chart (left)
 *   2. Aging bucket stacked bar (right)
 *
 * Data comes from the AR snapshot system (lib/ar-snapshots.ts).
 * Falls back to synthetic trend data for demo accounts.
 */

import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { getRecentSnapshots, takeSnapshot, type ArSnapshot } from "@/lib/ar-snapshots";
import { readInvoices } from "@/lib/invoice-store";
import { formatCurrency } from "@/lib/formatters";

// ── Synthetic demo data ────────────────────────────────────────────────────────

function makeDemoSnapshots(): ArSnapshot[] {
  const now = Date.now();
  return Array.from({ length: 30 }, (_, i) => {
    const d = new Date(now - (29 - i) * 86400000);
    const base = 38 + Math.sin(i * 0.4) * 8 + (Math.random() - 0.5) * 3;
    const outstanding = 85000 - i * 400 + (Math.random() - 0.5) * 5000;
    return {
      date: d.toISOString().slice(0, 10),
      dso: Math.round(base),
      totalOutstanding: outstanding,
      totalOverdue: outstanding * 0.45,
      buckets: {
        current:      outstanding * 0.35,
        overdue_1_30: outstanding * 0.28,
        overdue_31_60: outstanding * 0.18,
        overdue_61_90: outstanding * 0.11,
        overdue_90plus: outstanding * 0.08,
      },
      invoiceCount: 62 - Math.floor(i * 0.2),
      openCount: 44 - Math.floor(i * 0.15),
    };
  });
}

// ── SVG line chart ────────────────────────────────────────────────────────────

function LineChart({ data, color = "var(--zn-safe)" }: { data: number[]; color?: string }) {
  if (data.length < 2) return null;
  const W = 240;
  const H = 72;
  const pad = 4;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => [
    pad + (i / (data.length - 1)) * (W - pad * 2),
    H - pad - ((v - min) / range) * (H - pad * 2),
  ]);
  const d = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const area = `${d} L${pts[pts.length - 1][0].toFixed(1)},${H - pad} L${pts[0][0].toFixed(1)},${H - pad} Z`;
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ overflow: "visible" }}>
      <path d={area} fill={color} opacity="0.12" />
      <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Stacked bar for latest aging buckets ──────────────────────────────────────

const BUCKET_COLORS = [
  { key: "current",       label: "Current",     color: "var(--zn-safe)"    },
  { key: "overdue_1_30",  label: "1–30d",       color: "var(--zn-warn)"    },
  { key: "overdue_31_60", label: "31–60d",      color: "#f97316"           },
  { key: "overdue_61_90", label: "61–90d",      color: "var(--zn-risk)"    },
  { key: "overdue_90plus",label: "90d+",        color: "#7f1d1d"           },
];

function AgingStack({ snapshot }: { snapshot: ArSnapshot }) {
  const total = Object.values(snapshot.buckets).reduce((s, v) => s + v, 0) || 1;
  return (
    <div className="space-y-2">
      {/* Stacked bar */}
      <div className="flex h-4 rounded-full overflow-hidden gap-px">
        {BUCKET_COLORS.map(({ key, color }) => {
          const pct = ((snapshot.buckets as Record<string, number>)[key] / total) * 100;
          if (pct < 1) return null;
          return (
            <div key={key} style={{ width: `${pct}%`, background: color }} />
          );
        })}
      </div>
      {/* Legend */}
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {BUCKET_COLORS.map(({ key, label, color }) => {
          const amount = (snapshot.buckets as Record<string, number>)[key];
          const pct = Math.round((amount / total) * 100);
          if (pct < 1) return null;
          return (
            <div key={key} className="flex items-center gap-1.5">
              <div className="size-2 rounded-full shrink-0" style={{ background: color }} />
              <span className="text-[11px]" style={{ color: "var(--zn-ink-3)" }}>
                {label}{" "}
                <span className="font-semibold" style={{ color: "var(--zn-ink-2)" }}>
                  {pct}%
                </span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  isDemo?: boolean;
}

export function ArTrendChart({ isDemo = false }: Props) {
  const [snapshots, setSnapshots] = useState<ArSnapshot[]>([]);

  useEffect(() => {
    if (isDemo) {
      setSnapshots(makeDemoSnapshots());
      return;
    }
    // Take today's snapshot and load history
    const invoices = readInvoices();
    takeSnapshot(invoices);
    setSnapshots(getRecentSnapshots(30));
  }, [isDemo]);

  const latest = snapshots[snapshots.length - 1];
  const prev = snapshots.length >= 7 ? snapshots[snapshots.length - 7] : snapshots[0];

  if (snapshots.length === 0) {
    return (
      <div
        className="rounded-xl p-5 text-center"
        style={{ background: "var(--zn-surface)", border: "1px solid var(--zn-line-soft)" }}
      >
        <p className="text-[13px]" style={{ color: "var(--zn-ink-3)" }}>
          No trend data yet. Data builds up daily — check back tomorrow.
        </p>
      </div>
    );
  }

  const dsoChange = latest && prev ? latest.dso - prev.dso : 0;
  const dsoTrend = dsoChange > 2 ? "up" : dsoChange < -2 ? "down" : "flat";

  const outstandingChange = latest && prev
    ? ((latest.totalOutstanding - prev.totalOutstanding) / (prev.totalOutstanding || 1)) * 100
    : 0;

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ border: "1px solid var(--zn-line-soft)" }}
    >
      {/* Header */}
      <div
        className="px-4 py-3 flex items-center gap-2"
        style={{ background: "var(--zn-surface-2)", borderBottom: "1px solid var(--zn-line-soft)" }}
      >
        <TrendingUp className="size-4" style={{ color: "var(--zn-ink-3)" }} />
        <span className="text-[12px] font-semibold uppercase tracking-[0.1em]" style={{ color: "var(--zn-ink-3)" }}>
          AR Trends
        </span>
        <span className="ml-auto text-[11px]" style={{ color: "var(--zn-ink-3)" }}>
          Last {snapshots.length} days
        </span>
      </div>

      <div className="p-4 space-y-5" style={{ background: "var(--zn-surface)" }}>
        {/* DSO sparkline */}
        <div>
          <div className="flex items-baseline justify-between mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--zn-ink-3)" }}>
              Days Sales Outstanding (DSO)
            </span>
            <div className="flex items-center gap-1.5">
              <span className="text-[22px] font-bold tabular-nums" style={{ color: "var(--zn-ink)" }}>
                {latest?.dso ?? "—"}
              </span>
              {dsoTrend === "up" && (
                <div className="flex items-center gap-0.5 text-[11px] font-semibold" style={{ color: "var(--zn-risk)" }}>
                  <TrendingUp className="size-3.5" /> +{dsoChange}d vs last week
                </div>
              )}
              {dsoTrend === "down" && (
                <div className="flex items-center gap-0.5 text-[11px] font-semibold" style={{ color: "var(--zn-safe)" }}>
                  <TrendingDown className="size-3.5" /> {dsoChange}d vs last week
                </div>
              )}
              {dsoTrend === "flat" && (
                <div className="flex items-center gap-0.5 text-[11px]" style={{ color: "var(--zn-ink-3)" }}>
                  <Minus className="size-3.5" /> Stable
                </div>
              )}
            </div>
          </div>
          <LineChart
            data={snapshots.map((s) => s.dso)}
            color={dsoTrend === "up" ? "var(--zn-risk)" : dsoTrend === "down" ? "var(--zn-safe)" : "var(--zn-ink-2)"}
          />
        </div>

        {/* Outstanding + overdue summary */}
        <div className="grid grid-cols-2 gap-3">
          <div
            className="rounded-xl p-3"
            style={{ background: "var(--zn-surface-2)" }}
          >
            <p className="text-[10.5px] font-medium uppercase tracking-[0.08em]" style={{ color: "var(--zn-ink-3)" }}>
              Total outstanding
            </p>
            <p className="text-[18px] font-bold tabular-nums mt-0.5" style={{ color: "var(--zn-ink)" }}>
              {formatCurrency(latest?.totalOutstanding ?? 0)}
            </p>
            {Math.abs(outstandingChange) > 1 && (
              <p className="text-[11px] mt-0.5" style={{ color: outstandingChange > 0 ? "var(--zn-risk)" : "var(--zn-safe)" }}>
                {outstandingChange > 0 ? "+" : ""}{outstandingChange.toFixed(1)}% vs last week
              </p>
            )}
          </div>
          <div
            className="rounded-xl p-3"
            style={{ background: "var(--zn-surface-2)" }}
          >
            <p className="text-[10.5px] font-medium uppercase tracking-[0.08em]" style={{ color: "var(--zn-ink-3)" }}>
              Overdue
            </p>
            <p className="text-[18px] font-bold tabular-nums mt-0.5" style={{ color: "var(--zn-risk)" }}>
              {formatCurrency(latest?.totalOverdue ?? 0)}
            </p>
            <p className="text-[11px] mt-0.5" style={{ color: "var(--zn-ink-3)" }}>
              {latest && latest.totalOutstanding > 0
                ? `${Math.round((latest.totalOverdue / latest.totalOutstanding) * 100)}% of AR`
                : "—"}
            </p>
          </div>
        </div>

        {/* Aging breakdown */}
        {latest && (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] mb-2" style={{ color: "var(--zn-ink-3)" }}>
              Aging breakdown (today)
            </p>
            <AgingStack snapshot={latest} />
          </div>
        )}

        {/* Outstanding trend sparkline */}
        <div>
          <p className="text-[10.5px] font-medium uppercase tracking-[0.08em] mb-1" style={{ color: "var(--zn-ink-3)" }}>
            Outstanding trend
          </p>
          <LineChart
            data={snapshots.map((s) => s.totalOutstanding)}
            color="var(--zn-ink-2)"
          />
        </div>
      </div>
    </div>
  );
}
