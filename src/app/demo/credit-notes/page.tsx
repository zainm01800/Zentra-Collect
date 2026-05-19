"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

// ─── Design tokens ───────────────────────────────────────────────────────────
const T = {
  bg:       "var(--zn-bg)",
  card:     "var(--zn-surface)",
  hover:    "var(--zn-surface-2)",
  surface2: "var(--zn-surface-2)",
  ink:      "var(--zn-ink)",
  muted:    "var(--zn-ink-3)",
  border:   "var(--zn-line-soft)",
  green:    "var(--zn-safe)",
  amber:    "var(--zn-warn)",
  red:      "var(--zn-risk)",
  blue:     "var(--zn-info)",
};

// ─── Data ────────────────────────────────────────────────────────────────────
const CREDIT_NOTES = [
  {
    id: "cn1", ref: "CN-0028", customer: "BluePeak Ltd",
    reason: "Overcharge correction — 4 hours design billed twice (INV-2026-0138)",
    issued: "14 May 2026", invoiceRef: "INV-2026-0138", netCredit: 1800.00,
  },
  {
    id: "cn2", ref: "CN-0027", customer: "Meridian Studio",
    reason: "Service not delivered — workshop cancelled, full reversal (INV-2026-0151)",
    issued: "10 May 2026", invoiceRef: "INV-2026-0151", netCredit: 2000.00,
  },
  {
    id: "cn3", ref: "CN-0026", customer: "Harrow Digital",
    reason: "Goodwill discount — applied retrospectively for late delivery",
    issued: "6 May 2026", invoiceRef: "INV-2026-0144", netCredit: 350.00,
  },
  {
    id: "cn4", ref: "CN-0025", customer: "Oaktree Consulting",
    reason: "Returned goods — 2 hard-copy reports replaced under warranty",
    issued: "30 Apr 2026", invoiceRef: "INV-2026-0131", netCredit: 125.00,
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtGBP(n: number): string {
  const v = Math.abs(n).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `£${v}`;
}

// ─── Page ────────────────────────────────────────────────────────────────────
export default function DemoCreditNotesPage() {
  const [openId, setOpenId] = useState<string | null>("cn1");
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  function showToast(msg: string) {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2800);
  }

  // Totals (hardcoded per spec)
  const TOTAL_NET   = 4275;
  const TOTAL_VAT   = 855;
  const TOTAL_GROSS = 5130;

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
              Credit notes
            </h1>
            <p style={{ fontSize: 13, color: T.muted, margin: "4px 0 0" }}>
              4 credit notes this quarter · {fmtGBP(TOTAL_GROSS)} reversed
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
                background: "var(--zn-surface)",
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
                background: "var(--zn-bg-inverse)",
                color: "#fff",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              New credit note
            </button>
          </div>
        </div>

        {/* KPI row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
          <KpiCard
            label="Total credited"
            value={`−${fmtGBP(TOTAL_NET)}`}
            sub="net amount reversed"
          />
          <KpiCard
            label="VAT reversed"
            value={`−${fmtGBP(TOTAL_VAT)}`}
            valueColor={T.blue}
          />
          <KpiCard
            label="Gross credited"
            value={`−${fmtGBP(TOTAL_GROSS)}`}
            valueColor={T.red}
          />
        </div>

        {/* Credit note list */}
        <div
          style={{
            background: T.card,
            borderRadius: 12,
            border: `1px solid ${T.border}`,
            overflow: "hidden",
          }}
        >
          {CREDIT_NOTES.map((cn, idx) => {
            const vat = cn.netCredit * 0.2;
            const gross = cn.netCredit * 1.2;
            const expanded = openId === cn.id;

            return (
              <div
                key={cn.id}
                style={{ borderTop: idx === 0 ? "none" : `1px solid ${T.border}` }}
              >
                {/* Row header */}
                <button
                  type="button"
                  onClick={() => setOpenId(expanded ? null : cn.id)}
                  style={{
                    width: "100%",
                    display: "grid",
                    gridTemplateColumns: "1.6fr 1fr auto",
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
                        width: 80,
                        flexShrink: 0,
                      }}
                    >
                      {cn.ref}
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: T.ink, margin: 0, lineHeight: 1.3 }}>
                        {cn.customer}
                      </p>
                      <p
                        style={{
                          fontSize: 11,
                          color: T.muted,
                          fontStyle: "italic",
                          margin: "1px 0 0",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {cn.reason}
                      </p>
                    </div>
                  </div>

                  {/* Middle */}
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 11, color: T.muted }}>{cn.issued}</span>
                    <span style={{ fontSize: 11, color: T.muted }}>·</span>
                    <span
                      style={{
                        fontFamily: "monospace",
                        fontSize: 10.5,
                        color: T.muted,
                        background: T.surface2,
                        borderRadius: 4,
                        padding: "1px 5px",
                      }}
                    >
                      {cn.invoiceRef}
                    </span>
                  </div>

                  {/* Right */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                    <p
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: T.red,
                        margin: 0,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      −{fmtGBP(gross)}
                    </p>
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
                      background: "var(--zn-surface-2)",
                      padding: "16px 20px 20px",
                    }}
                  >
                    {/* Summary grid */}
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(3, 1fr)",
                        gap: 12,
                        marginBottom: 16,
                      }}
                    >
                      <SummaryCell label="Net credit" value={`−${fmtGBP(cn.netCredit)}`} />
                      <SummaryCell label="VAT reversal" value={`−${fmtGBP(vat)}`} valueColor={T.blue} />
                      <SummaryCell label="Gross total" value={`−${fmtGBP(gross)}`} valueColor={T.red} />
                    </div>

                    {/* Impact paragraph */}
                    <div
                      style={{
                        background: "var(--zn-info-soft)",
                        borderRadius: 8,
                        padding: "12px 14px",
                        fontSize: 12.5,
                        color: "var(--zn-info)",
                        lineHeight: 1.6,
                        marginBottom: 16,
                      }}
                    >
                      This credit note reduces your <strong>VAT liability</strong> by{" "}
                      <strong>{fmtGBP(vat)}</strong> for the current quarter. The net amount of{" "}
                      <strong>{fmtGBP(cn.netCredit)}</strong> reduces taxable income reported on Box 9
                      of your SA103S Self Assessment return.
                    </div>

                    {/* Linked invoice */}
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 11.5, color: T.muted }}>Linked invoice</span>
                      <button
                        type="button"
                        onClick={() => showToast(`Opening ${cn.invoiceRef}…`)}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 5,
                          fontFamily: "monospace",
                          fontSize: 11.5,
                          color: T.blue,
                          background: "var(--zn-info-soft)",
                          border: "none",
                          borderRadius: 5,
                          padding: "3px 8px",
                          cursor: "pointer",
                          fontWeight: 600,
                        }}
                      >
                        {cn.invoiceRef}
                        <span style={{ fontSize: 11 }}>→</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

      {/* Toast */}
      {toastMsg && (
        <div
          style={{
            position: "fixed",
            bottom: 24,
            left: "50%",
            transform: "translateX(-50%)",
            background: "var(--zn-bg-inverse)",
            color: "#fff",
            borderRadius: 8,
            padding: "10px 18px",
            fontSize: 13,
            fontWeight: 500,
            zIndex: 9999,
            pointerEvents: "none",
          }}
        >
          {toastMsg}
        </div>
      )}
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
        background: "var(--zn-surface)",
        borderRadius: 12,
        border: "1px solid var(--zn-line-soft)",
        padding: "16px 18px",
      }}
    >
      <p style={{ fontSize: 10.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--zn-ink-3)", margin: 0 }}>
        {label}
      </p>
      <p style={{ fontSize: 20, fontWeight: 700, color: valueColor ?? "var(--zn-ink)", margin: "8px 0 0", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
        {value}
      </p>
      {sub && (
        <p style={{ fontSize: 11, color: "var(--zn-ink-3)", margin: "4px 0 0" }}>{sub}</p>
      )}
    </div>
  );
}

function SummaryCell({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <div
      style={{
        background: "var(--zn-surface)",
        borderRadius: 8,
        border: "1px solid var(--zn-line-soft)",
        padding: "12px 14px",
      }}
    >
      <p style={{ fontSize: 10.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--zn-ink-3)", margin: 0 }}>
        {label}
      </p>
      <p style={{ fontSize: 16, fontWeight: 700, color: valueColor ?? "var(--zn-ink)", margin: "6px 0 0", fontVariantNumeric: "tabular-nums" }}>
        {value}
      </p>
    </div>
  );
}
