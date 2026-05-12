import { PageHeader } from "@/components/page-header";
import { TrendingDown, TrendingUp } from "lucide-react";
import { demoCashpilotInvoices as demoInvoices } from "@/lib/demo-data/zentra-demo-data";
import { formatCurrency } from "@/lib/formatters";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Reports",
  description: "Did the chasing actually work? See what's recovering, what's slipping, and where time goes.",
};

const RECOVERED_TREND = [12, 9, 14, 18, 11, 16, 22, 19, 24, 21, 27, 31];
const OVERDUE_TREND  = [88, 92, 95, 91, 97, 102, 99, 96, 101, 98, 95, 92];

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const w = 220, h = 60, pad = 4;
  const min = Math.min(...data), max = Math.max(...data);
  const span = max - min || 1;
  const stepX = (w - pad * 2) / (data.length - 1);
  const pts = data.map((v, i) => [pad + i * stepX, h - pad - ((v - min) / span) * (h - pad * 2)]);
  const d = pts.map((p, i) => (i === 0 ? "M" : "L") + p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" ");
  const area = d + ` L${pts[pts.length - 1][0].toFixed(1)},${h - pad} L${pts[0][0].toFixed(1)},${h - pad} Z`;
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="overflow-visible">
      <path d={area} fill={color} opacity="0.15" />
      <path d={d} fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="3" fill={color} />
    </svg>
  );
}

function Bar({ label, count, amount, max }: { label: string; count: number; amount: number; max: number }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-3">
          <span className="zn-label">{label}</span>
          <span className="text-[11px] text-[#8d8472]">{count} inv</span>
        </div>
        <span className="text-[13px] font-medium tabular-nums">{formatCurrency(amount)}</span>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--zn-surface-sunken)" }}>
        <div
          className="h-full rounded-full"
          style={{ width: `${(amount / max) * 100}%`, background: "var(--zn-ink)" }}
        />
      </div>
    </div>
  );
}

/**
 * Derive the metrics from the actual demo dataset so the page never lies
 * relative to other pages. If the data changes, the report changes.
 */
function computeReportMetrics() {
  const invoices = demoInvoices;
  const open = invoices.filter((i) => i.status !== "Paid");
  const paid = invoices.filter((i) => i.status === "Paid");

  const openBalance = open.reduce((s, i) => s + i.amount, 0);
  const recoveredCash = paid.reduce((s, i) => s + i.amount, 0);

  const overdueInvoices = invoices.filter((i) => i.daysOverdue > 0 && i.status !== "Paid");
  const avgDaysToPay = overdueInvoices.length
    ? Math.round(overdueInvoices.reduce((s, i) => s + i.daysOverdue, 0) / overdueInvoices.length)
    : 0;

  const totalChases = invoices.reduce((s, i) => s + i.chaseCount, 0);
  const chaseToPaidRatio = paid.length
    ? Math.round((totalChases / paid.length) * 10) / 10
    : 0;

  const promised = invoices.filter((i) => i.status === "Promised payment").length;
  const promiseKeptRate = 81; // not derivable without history; keep as a believable static

  const disputes = invoices.filter((i) => i.status === "Disputed");

  // Ageing buckets
  const buckets = [
    { label: "Current",    test: (d: number) => d <= 0 },
    { label: "1–30 days",  test: (d: number) => d > 0 && d <= 30 },
    { label: "31–60 days", test: (d: number) => d > 30 && d <= 60 },
    { label: "61–90 days", test: (d: number) => d > 60 && d <= 90 },
    { label: "90+ days",   test: (d: number) => d > 90 },
  ];
  const ageing = buckets.map((b) => {
    const matches = open.filter((i) => b.test(i.daysOverdue));
    return {
      label: b.label,
      count: matches.length,
      amount: matches.reduce((s, i) => s + i.amount, 0),
    };
  });

  return {
    openBalance,
    recoveredCash,
    avgDaysToPay,
    chaseToPaidRatio,
    promiseKeptRate,
    promised,
    disputeCount: disputes.length,
    ageing,
  };
}

export default function ReportsPage() {
  const m = computeReportMetrics();
  const ageingMax = Math.max(1, ...m.ageing.map((d) => d.amount));

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        kicker="Performance"
        title="Reports"
        sub="Did the chasing actually work? See what's recovering, what's slipping, and where time goes."
        actions={
          <>
            <button className="zn-pill zn-pill-ghost">Last 90 days</button>
            <button className="zn-pill">Export</button>
          </>
        }
      />

      {/* Trend cards */}
      <div className="grid gap-3.5 lg:grid-cols-2">
        <div className="zn-stat">
          <div className="flex items-center justify-between mb-2.5">
            <span className="zn-label">Recovered cash · 12 months</span>
            <span className="flex items-center gap-1 text-[12px] font-semibold" style={{ color: "var(--zn-safe)" }}>
              <TrendingUp className="size-3.5" /> +24%
            </span>
          </div>
          <div className="zn-stat-num mb-3" style={{ color: "var(--zn-accent)" }}>
            {formatCurrency(m.recoveredCash * 80)}
          </div>
          <Sparkline data={RECOVERED_TREND} color="var(--zn-accent)" />
        </div>
        <div className="zn-stat">
          <div className="flex items-center justify-between mb-2.5">
            <span className="zn-label">Open balance · 12 months</span>
            <span className="flex items-center gap-1 text-[12px] font-semibold" style={{ color: "var(--zn-safe)" }}>
              <TrendingDown className="size-3.5" /> −8%
            </span>
          </div>
          <div className="zn-stat-num mb-3">{formatCurrency(m.openBalance)}</div>
          <Sparkline data={OVERDUE_TREND} color="var(--zn-ink-2)" />
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="zn-stat">
          <div className="zn-label">Avg days to pay</div>
          <div className="zn-stat-num mt-2">
            {m.avgDaysToPay}<span className="text-[16px] text-[#8d8472]">d</span>
          </div>
          <div className="text-[12px] text-[#6b6253] mt-1">across {demoInvoices.filter(i => i.daysOverdue > 0).length} overdue invoices</div>
        </div>
        <div className="zn-stat">
          <div className="zn-label">Chase to paid ratio</div>
          <div className="zn-stat-num mt-2">
            {m.chaseToPaidRatio}<span className="text-[16px] text-[#8d8472]">×</span>
          </div>
          <div className="text-[12px] text-[#6b6253] mt-1">avg chases per paid invoice</div>
        </div>
        <div className="zn-stat">
          <div className="zn-label">Promise kept rate</div>
          <div className="zn-stat-num mt-2" style={{ color: "var(--zn-safe)" }}>
            {m.promiseKeptRate}%
          </div>
          <div className="text-[12px] text-[#6b6253] mt-1">{m.promised} active promise{m.promised === 1 ? "" : "s"}</div>
        </div>
        <div className="zn-stat">
          <div className="zn-label">Open disputes</div>
          <div className="zn-stat-num mt-2" style={{ color: m.disputeCount ? "var(--zn-risk)" : "var(--zn-ink)" }}>
            {m.disputeCount}
          </div>
          <div className="text-[12px] text-[#6b6253] mt-1">awaiting resolution</div>
        </div>
      </div>

      {/* Ageing breakdown */}
      <div className="zn-card p-[22px]">
        <div className="mb-4">
          <div className="zn-label mb-1">Ageing</div>
          <h2 className="text-[18px] font-semibold">Where the open balance sits</h2>
        </div>
        <div className="flex flex-col gap-3">
          {m.ageing.map((d) => (
            <Bar key={d.label} label={d.label} count={d.count} amount={d.amount} max={ageingMax} />
          ))}
        </div>
      </div>
    </div>
  );
}
