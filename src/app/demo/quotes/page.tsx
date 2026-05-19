"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

// ─── Design tokens ───────────────────────────────────────────────────────────
const T = {
  bg:       "#FAF7F2",
  card:     "#FFFFFF",
  hover:    "#FAFAFA",
  surface2: "#F4F4F5",
  ink:      "#1A1916",
  muted:    "#8A8680",
  border:   "rgba(0,0,0,0.08)",
  green:    "#16A34A",
  amber:    "#C28800",
  red:      "#DC2626",
  blue:     "#2563EB",
};

// ─── Data ────────────────────────────────────────────────────────────────────
const QUOTES = [
  {
    id: "q1", ref: "Q-2026-018", customer: "BluePeak Ltd",
    description: "Logistics platform discovery + UX research engagement",
    issued: "12 May 2026", expires: "26 May 2026", status: "sent",
    items: [
      { desc: "Discovery workshop (2 days)", qty: 2, unit: 1800 },
      { desc: "Stakeholder interviews (6 sessions)", qty: 6, unit: 450 },
      { desc: "Findings report + presentation", qty: 1, unit: 1500 },
    ],
  },
  {
    id: "q2", ref: "Q-2026-019", customer: "Meridian Studio",
    description: "Quarterly retainer — design ops support, Q3 2026",
    issued: "14 May 2026", expires: "28 May 2026", status: "accepted",
    items: [
      { desc: "Senior design support (40h/mo × 3)", qty: 120, unit: 95 },
      { desc: "Project management overhead", qty: 1, unit: 800 },
    ],
  },
  {
    id: "q3", ref: "Q-2026-020", customer: "Harrow Digital",
    description: "Brand refresh — logo, palette, type system",
    issued: "16 May 2026", expires: "13 Jun 2026", status: "draft",
    items: [
      { desc: "Brand audit + competitor scan", qty: 1, unit: 1200 },
      { desc: "Identity exploration (3 routes)", qty: 1, unit: 3500 },
      { desc: "Final files + brand guidelines", qty: 1, unit: 2400 },
    ],
  },
  {
    id: "q4", ref: "Q-2026-016", customer: "BluePeak Ltd",
    description: "Driver app pilot — scoping & build (8 weeks)",
    issued: "22 Apr 2026", expires: "20 May 2026", status: "sent",
    items: [
      { desc: "Discovery + scoping", qty: 1, unit: 2800 },
      { desc: "Pilot build (8 weeks)", qty: 8, unit: 950 },
      { desc: "Field testing & handover", qty: 1, unit: 2000 },
    ],
  },
  {
    id: "q5", ref: "Q-2026-014", customer: "Meridian Studio",
    description: "Annual hosting & maintenance — design system platform",
    issued: "1 Apr 2026", expires: "30 Apr 2026", status: "expired",
    items: [
      { desc: "Hosting (annual)", qty: 1, unit: 600 },
      { desc: "Maintenance (annual)", qty: 1, unit: 200 },
    ],
  },
];

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS_CFG: Record<string, { bg: string; color: string; dot: string; label: string }> = {
  draft:     { bg: "#F4F4F5", color: "#374151", dot: "#8A8680", label: "Draft" },
  sent:      { bg: "#EFF6FF", color: "#2563EB", dot: "#2563EB", label: "Sent" },
  accepted:  { bg: "#F0FDF4", color: "#16A34A", dot: "#16A34A", label: "Accepted" },
  expired:   { bg: "#F4F4F5", color: "#8A8680", dot: "#8A8680", label: "Expired" },
  converted: { bg: "#F0FDF4", color: "#16A34A", dot: "#16A34A", label: "Converted" },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtGBP(n: number): string {
  const v = Math.abs(n).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `£${v}`;
}

function calcNet(items: { qty: number; unit: number }[]): number {
  return items.reduce((s, i) => s + i.qty * i.unit, 0);
}

// ─── Status pill ──────────────────────────────────────────────────────────────
function StatusPill({ status }: { status: string }) {
  const cfg = STATUS_CFG[status] ?? STATUS_CFG.draft;
  return (
    <span
      style={{
        background: cfg.bg,
        color: cfg.color,
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        borderRadius: 999,
        padding: "2px 9px",
        fontSize: 10.5,
        fontWeight: 600,
        whiteSpace: "nowrap",
      }}
    >
      <span
        style={{
          width: 5,
          height: 5,
          borderRadius: "50%",
          background: cfg.dot,
          flexShrink: 0,
        }}
      />
      {cfg.label}
    </span>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────
export default function DemoQuotesPage() {
  const [openId, setOpenId] = useState<string | null>("q1");
  const [statuses, setStatuses] = useState<Record<string, string>>({});

  function getStatus(id: string, defaultStatus: string): string {
    return statuses[id] ?? defaultStatus;
  }
  function setStatus(id: string, status: string) {
    setStatuses((prev) => ({ ...prev, [id]: status }));
  }

  // KPI calculations
  const pipeline = QUOTES.filter((q) => {
    const s = getStatus(q.id, q.status);
    return s === "sent" || s === "accepted";
  });
  const pipelineValue = pipeline.reduce((s, q) => s + calcNet(q.items) * 1.2, 0);

  const acceptedQuotes = QUOTES.filter((q) => getStatus(q.id, q.status) === "accepted");
  const acceptedValue = acceptedQuotes.reduce((s, q) => s + calcNet(q.items) * 1.2, 0);

  const denominator = QUOTES.filter((q) => {
    const s = getStatus(q.id, q.status);
    return s === "sent" || s === "accepted" || s === "expired";
  }).length;
  const conversionRate = denominator > 0 ? Math.round((acceptedQuotes.length / denominator) * 100) : 0;

  const netSum = QUOTES.filter((q) => {
    const s = getStatus(q.id, q.status);
    return s === "sent" || s === "accepted";
  }).reduce((s, q) => s + calcNet(q.items), 0);

  return (
    <div>
        {/* Page header */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            marginBottom: 24,
            gap: 16,
          }}
        >
          <div>
            <h1
              style={{
                fontSize: 26,
                fontWeight: 700,
                color: T.ink,
                margin: 0,
                letterSpacing: "-0.02em",
                lineHeight: 1.15,
              }}
            >
              Quotes
            </h1>
            <p style={{ fontSize: 13, color: T.muted, margin: "4px 0 0" }}>
              5 quotes · {fmtGBP(netSum)} pipeline
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            <button
              type="button"
              style={{
                height: 34,
                padding: "0 14px",
                borderRadius: 999,
                border: `1px solid ${T.border}`,
                background: "#fff",
                fontSize: 13,
                fontWeight: 500,
                color: T.ink,
                cursor: "pointer",
              }}
            >
              Export CSV
            </button>
            <button
              type="button"
              style={{
                height: 34,
                padding: "0 16px",
                borderRadius: 999,
                border: "none",
                background: T.ink,
                color: "#fff",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              New quote
            </button>
          </div>
        </div>

        {/* KPI row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
          <KpiCard label="Total pipeline" value={fmtGBP(pipelineValue)} sub="sent + accepted (inc. VAT)" />
          <KpiCard
            label="Accepted"
            value={`${acceptedQuotes.length} quote${acceptedQuotes.length !== 1 ? "s" : ""} · ${fmtGBP(acceptedValue)}`}
            valueColor={T.green}
          />
          <KpiCard label="Conversion rate" value={`${conversionRate}%`} sub="accepted / (sent + accepted + expired)" />
        </div>

        {/* Quote list */}
        <div
          style={{
            background: T.card,
            borderRadius: 12,
            border: `1px solid ${T.border}`,
            overflow: "hidden",
          }}
        >
          {QUOTES.map((q, idx) => {
            const status = getStatus(q.id, q.status);
            const net = calcNet(q.items);
            const vat = net * 0.2;
            const gross = net + vat;
            const expanded = openId === q.id;

            return (
              <div
                key={q.id}
                style={{ borderTop: idx === 0 ? "none" : `1px solid ${T.border}` }}
              >
                {/* Row header */}
                <button
                  type="button"
                  onClick={() => setOpenId(expanded ? null : q.id)}
                  style={{
                    width: "100%",
                    display: "grid",
                    gridTemplateColumns: "1.5fr 1fr auto",
                    alignItems: "center",
                    gap: 16,
                    padding: "12px 20px",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = T.hover)}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  {/* Left */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                    <span
                      style={{
                        fontFamily: "monospace",
                        fontSize: 10.5,
                        color: T.muted,
                        width: 95,
                        flexShrink: 0,
                      }}
                    >
                      {q.ref}
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: T.ink, margin: 0, lineHeight: 1.3 }}>
                        {q.customer}
                      </p>
                      <p
                        style={{
                          fontSize: 11,
                          color: T.muted,
                          margin: "1px 0 0",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {q.description}
                      </p>
                    </div>
                  </div>

                  {/* Middle */}
                  <div>
                    <p style={{ fontSize: 11, color: T.muted, margin: 0, lineHeight: 1.5 }}>
                      <span style={{ fontSize: 9.5, textTransform: "uppercase", letterSpacing: "0.06em" }}>Issued </span>
                      {q.issued}
                    </p>
                    <p style={{ fontSize: 11, color: T.muted, margin: 0, lineHeight: 1.5 }}>
                      <span style={{ fontSize: 9.5, textTransform: "uppercase", letterSpacing: "0.06em" }}>Expires </span>
                      {q.expires}
                    </p>
                  </div>

                  {/* Right */}
                  <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
                    <StatusPill status={status} />
                    <div style={{ textAlign: "right" }}>
                      <p style={{ fontSize: 13.5, fontWeight: 700, color: T.ink, margin: 0 }}>
                        {fmtGBP(gross)}
                      </p>
                    </div>
                    <span style={{ color: T.muted, lineHeight: 0 }}>
                      {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </span>
                  </div>
                </button>

                {/* Expanded body */}
                {expanded && (
                  <div
                    style={{
                      borderTop: `1px solid ${T.border}`,
                      background: "#FAFAFA",
                      padding: "16px 20px 20px",
                    }}
                  >
                    {/* Line items table */}
                    <div
                      style={{
                        borderRadius: 8,
                        border: `1px solid ${T.border}`,
                        overflow: "hidden",
                        marginBottom: 16,
                      }}
                    >
                      {/* Table header */}
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 60px 100px 100px",
                          gap: 8,
                          padding: "7px 14px",
                          background: T.surface2,
                          fontSize: 10.5,
                          fontWeight: 600,
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                          color: T.muted,
                        }}
                      >
                        <span>Description</span>
                        <span style={{ textAlign: "right" }}>Qty</span>
                        <span style={{ textAlign: "right" }}>Unit price</span>
                        <span style={{ textAlign: "right" }}>Total</span>
                      </div>
                      {/* Items */}
                      {q.items.map((item, i) => (
                        <div
                          key={i}
                          style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 60px 100px 100px",
                            gap: 8,
                            padding: "9px 14px",
                            borderTop: `1px solid ${T.border}`,
                            fontSize: 12.5,
                          }}
                        >
                          <span style={{ color: T.ink }}>{item.desc}</span>
                          <span style={{ textAlign: "right", color: T.muted, fontVariantNumeric: "tabular-nums" }}>
                            {item.qty}
                          </span>
                          <span style={{ textAlign: "right", color: T.muted, fontVariantNumeric: "tabular-nums" }}>
                            {fmtGBP(item.unit)}
                          </span>
                          <span style={{ textAlign: "right", color: T.ink, fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>
                            {fmtGBP(item.qty * item.unit)}
                          </span>
                        </div>
                      ))}
                      {/* Totals */}
                      <div
                        style={{
                          borderTop: `1px solid ${T.border}`,
                          padding: "10px 14px",
                          background: T.surface2,
                          display: "flex",
                          flexDirection: "column",
                          gap: 4,
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                          <span style={{ color: T.muted }}>Net total</span>
                          <span style={{ color: T.ink, fontVariantNumeric: "tabular-nums" }}>{fmtGBP(net)}</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                          <span style={{ color: T.blue }}>VAT @ 20%</span>
                          <span style={{ color: T.blue, fontVariantNumeric: "tabular-nums" }}>{fmtGBP(vat)}</span>
                        </div>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            fontSize: 18,
                            fontWeight: 700,
                            marginTop: 4,
                            paddingTop: 6,
                            borderTop: `1px solid ${T.border}`,
                          }}
                        >
                          <span style={{ color: T.ink }}>Gross total</span>
                          <span style={{ color: T.ink, fontVariantNumeric: "tabular-nums" }}>{fmtGBP(gross)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {status === "draft" && (
                        <>
                          <ActionBtn primary onClick={() => setStatus(q.id, "sent")}>Mark as sent</ActionBtn>
                          <ActionBtn ghost>Edit</ActionBtn>
                          <ActionBtn ghost>Delete</ActionBtn>
                        </>
                      )}
                      {status === "sent" && (
                        <>
                          <ActionBtn primary onClick={() => setStatus(q.id, "accepted")}>Mark accepted</ActionBtn>
                          <ActionBtn ghost onClick={() => setStatus(q.id, "expired")}>Mark expired</ActionBtn>
                          <ActionBtn ghost>Send reminder</ActionBtn>
                        </>
                      )}
                      {status === "accepted" && (
                        <>
                          <ActionBtn
                            style={{ background: T.green, color: "#fff", border: "none" }}
                            onClick={() => setStatus(q.id, "converted")}
                          >
                            Convert to invoice
                          </ActionBtn>
                          <ActionBtn ghost>Download PDF</ActionBtn>
                        </>
                      )}
                      {status === "expired" && (
                        <ActionBtn ghost onClick={() => setStatus(q.id, "sent")}>Re-send</ActionBtn>
                      )}
                      {status === "converted" && (
                        <span style={{ fontSize: 12, color: T.green, fontWeight: 600 }}>
                          ✓ Converted to invoice
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function KpiCard({
  label,
  value,
  sub,
  valueColor,
}: {
  label: string;
  value: string;
  sub?: string;
  valueColor?: string;
}) {
  return (
    <div
      style={{
        background: "#FFFFFF",
        borderRadius: 12,
        border: `1px solid rgba(0,0,0,0.08)`,
        padding: "16px 18px",
      }}
    >
      <p style={{ fontSize: 10.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", color: "#8A8680", margin: 0 }}>
        {label}
      </p>
      <p style={{ fontSize: 20, fontWeight: 700, color: valueColor ?? "#1A1916", margin: "8px 0 0", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
        {value}
      </p>
      {sub && (
        <p style={{ fontSize: 11, color: "#8A8680", margin: "4px 0 0" }}>{sub}</p>
      )}
    </div>
  );
}

function ActionBtn({
  children,
  primary,
  ghost,
  onClick,
  style: extraStyle,
}: {
  children: React.ReactNode;
  primary?: boolean;
  ghost?: boolean;
  onClick?: () => void;
  style?: React.CSSProperties;
}) {
  const base: React.CSSProperties = {
    height: 32,
    padding: "0 14px",
    borderRadius: 999,
    fontSize: 12.5,
    fontWeight: 600,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
  };
  const variant: React.CSSProperties = primary
    ? { background: "#1A1916", color: "#fff", border: "none" }
    : ghost
    ? { background: "transparent", color: "#1A1916", border: "1px solid rgba(0,0,0,0.12)" }
    : {};

  return (
    <button
      type="button"
      onClick={onClick}
      style={{ ...base, ...variant, ...extraStyle }}
    >
      {children}
    </button>
  );
}
