"use client";

import { DEMO_AR_CUSTOMERS, DEMO_AR_TOTALS } from "@/lib/demo-data/demo-ar-data";

// ── Tokens ────────────────────────────────────────────────────────────────────
const T = {
  card:    "var(--zn-surface)",
  surf2:   "var(--zn-surface-2)",
  ink:     "var(--zn-ink)",
  muted:   "var(--zn-ink-3)",
  border:  "var(--zn-line-soft)",
  amber:   "var(--zn-warn)",
  red:     "var(--zn-risk)",
  amberBg: "var(--zn-warn-soft)",
  redBg:   "var(--zn-risk-soft)",
} as const;

// ── Buckets ───────────────────────────────────────────────────────────────────
interface Bucket { label: string; min: number; max: number | null; color: string; bg: string }
const BUCKETS: Bucket[] = [
  { label: "Current",    min: 0,  max: 0,    color: T.muted, bg: T.surf2   },
  { label: "1–30 days",  min: 1,  max: 30,   color: T.amber, bg: T.amberBg },
  { label: "31–60 days", min: 31, max: 60,   color: T.red,   bg: T.redBg   },
  { label: "61–90 days", min: 61, max: 90,   color: T.red,   bg: T.redBg   },
  { label: "90+ days",   min: 91, max: null, color: T.red,   bg: T.redBg   },
];

function bucketAmount(invoices: readonly { overdue: number; amount: number }[], b: Bucket) {
  return invoices
    .filter((i) => i.overdue >= b.min && (b.max === null || i.overdue <= b.max))
    .reduce((s, i) => s + i.amount, 0);
}

function fmtGBP(n: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function DemoAgedDebtPage() {
  const grandTotals = BUCKETS.map((b) => ({
    ...b,
    total: DEMO_AR_CUSTOMERS.reduce((s, c) => s + bucketAmount(c.invoices, b), 0),
  }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Page header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em", color: T.ink, margin: 0 }}>Aged debt</h1>
          <p style={{ fontSize: 13.5, color: T.muted, marginTop: 4 }}>
            All customers · {fmtGBP(DEMO_AR_TOTALS.totalOutstanding)} outstanding
          </p>
        </div>
        <button style={{
          background: "transparent", color: T.ink, border: `1px solid ${T.border}`,
          borderRadius: 999, padding: "8px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer",
        }}>
          Export CSV
        </button>
      </div>

      {/* KPI row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        <KpiCard label="Total outstanding" value={fmtGBP(DEMO_AR_TOTALS.totalOutstanding)} valueColor={T.red} />
        <KpiCard label="Overdue amount"    value={fmtGBP(DEMO_AR_TOTALS.totalOverdue)} valueColor={T.amber} />
        <KpiCard label="Overdue invoices"  value={String(DEMO_AR_TOTALS.overdueCount)} />
        <KpiCard label="Oldest invoice"    value={`${DEMO_AR_TOTALS.oldestOverdue} days`} valueColor={T.red} />
      </div>

      {/* Aging table */}
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden" }}>
        <div style={{ padding: "14px 20px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: T.ink, margin: 0 }}>Aging analysis</h2>
          <span style={{ fontSize: 12, color: T.muted }}>{DEMO_AR_TOTALS.customerCount} customers</span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${T.border}`, background: T.surf2 }}>
                <th style={{ textAlign: "left", padding: "10px 20px", fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: T.muted }}>Customer</th>
                {BUCKETS.map((b) => (
                  <th key={b.label} style={{ textAlign: "right", padding: "10px 16px", fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: b.min > 0 ? b.color : T.muted, whiteSpace: "nowrap" }}>
                    {b.label}
                  </th>
                ))}
                <th style={{ textAlign: "right", padding: "10px 20px", fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: T.muted }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {[...DEMO_AR_CUSTOMERS].sort((a, b) => b.outstanding - a.outstanding).map((c, i, arr) => (
                <tr key={c.id} style={{ borderBottom: i < arr.length - 1 ? `1px solid ${T.border}` : "none" }}>
                  <td style={{ padding: "12px 20px", color: T.ink, fontWeight: 500 }}>
                    <div>{c.name}</div>
                    <div style={{ fontSize: 11, color: T.muted, marginTop: 1 }}>{c.contact}</div>
                  </td>
                  {BUCKETS.map((b) => {
                    const amt = bucketAmount(c.invoices, b);
                    return (
                      <td key={b.label} style={{ padding: "12px 16px", textAlign: "right", fontVariantNumeric: "tabular-nums", color: amt > 0 ? (b.min > 0 ? b.color : T.ink) : T.muted }}>
                        {amt > 0 ? fmtGBP(amt) : "—"}
                      </td>
                    );
                  })}
                  <td style={{ padding: "12px 20px", textAlign: "right", fontWeight: 700, fontVariantNumeric: "tabular-nums", color: T.ink }}>
                    {fmtGBP(c.outstanding)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: `2px solid ${T.border}`, background: T.surf2 }}>
                <td style={{ padding: "12px 20px", fontWeight: 700, color: T.ink }}>Total</td>
                {grandTotals.map((b) => (
                  <td key={b.label} style={{ padding: "12px 16px", textAlign: "right", fontWeight: 700, fontVariantNumeric: "tabular-nums", color: b.total > 0 ? (b.min > 0 ? b.color : T.ink) : T.muted }}>
                    {b.total > 0 ? fmtGBP(b.total) : "—"}
                  </td>
                ))}
                <td style={{ padding: "12px 20px", textAlign: "right", fontWeight: 700, fontVariantNumeric: "tabular-nums", color: T.ink }}>
                  {fmtGBP(DEMO_AR_TOTALS.totalOutstanding)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "16px 20px" }}>
      <p style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", color: T.muted, margin: 0 }}>{label}</p>
      <p style={{ fontSize: 22, fontWeight: 700, color: valueColor ?? T.ink, marginTop: 8, marginBottom: 0 }}>{value}</p>
    </div>
  );
}
