"use client";

import { useState, useMemo } from "react";

// ---------------------------------------------------------------------------
// HMRC AMAP allowance
// ---------------------------------------------------------------------------
function calcAllowance(miles: number, runningBefore: number): number {
  const TIER = 10000;
  if (runningBefore >= TIER) return miles * 0.25;
  const remaining = TIER - runningBefore;
  if (miles <= remaining) return miles * 0.45;
  return remaining * 0.45 + (miles - remaining) * 0.25;
}

function rateLabel(miles: number, runningBefore: number): string {
  const TIER = 10000;
  if (runningBefore >= TIER) return "@ 25p";
  const remaining = TIER - runningBefore;
  if (miles <= remaining) return "@ 45p";
  return "split rate";
}

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------
interface Trip {
  id: string;
  date: string;
  month: string;
  purpose: string;
  from: string;
  to: string;
  miles: number;
}

const INITIAL_TRIPS: Trip[] = [
  { id: "t1", date: "14 May 2026", month: "May 2026", purpose: "Site survey — Harborgate Architects", from: "London office", to: "Bristol site",  miles: 118 },
  { id: "t2", date: "12 May 2026", month: "May 2026", purpose: "Client visit — BluePeak Ltd",         from: "London",        to: "Manchester",      miles: 200 },
  { id: "t3", date: "9 May 2026",  month: "May 2026", purpose: "Heathrow airport run",                from: "Office",        to: "LHR T5",          miles: 32  },
  { id: "t4", date: "5 May 2026",  month: "May 2026", purpose: "Workshop — Meridian Studio",          from: "Office",        to: "Hoxton",          miles: 8   },
  { id: "t5", date: "2 May 2026",  month: "May 2026", purpose: "Quarterly review — Oaktree",         from: "Office",        to: "Canary Wharf",    miles: 11  },
  { id: "t6", date: "24 Apr 2026", month: "April 2026", purpose: "Site visit — Pemberton & Co",      from: "London",        to: "Birmingham",      miles: 240 },
  { id: "t7", date: "16 Apr 2026", month: "April 2026", purpose: "Client meeting — Harrow Digital",  from: "Office",        to: "King's Cross",    miles: 6   },
  { id: "t8", date: "8 Apr 2026",  month: "April 2026", purpose: "Studio visit — Meridian",          from: "Office",        to: "Hoxton",          miles: 8   },
];

function fmtGBP(n: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency", currency: "GBP",
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(n);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function DemoMileagePage() {
  const [trips, setTrips] = useState<Trip[]>(INITIAL_TRIPS);
  const [showForm, setShowForm] = useState(false);
  const [formPurpose, setFormPurpose] = useState("");
  const [formDate, setFormDate] = useState("2026-05-19");
  const [formFrom, setFormFrom] = useState("");
  const [formTo, setFormTo] = useState("");
  const [formMiles, setFormMiles] = useState("");

  // Compute running totals and per-trip allowances
  const enriched = useMemo(() => {
    let running = 0;
    return trips.map((t) => {
      const allowance = calcAllowance(t.miles, running);
      const label = rateLabel(t.miles, running);
      running += t.miles;
      return { ...t, allowance, rateLabel: label };
    });
  }, [trips]);

  const totalMiles = trips.reduce((s, t) => s + t.miles, 0);
  const totalAllowance = enriched.reduce((s, t) => s + t.allowance, 0);
  const estimatedTaxSaving = totalAllowance * 0.2;

  // Live preview in form
  const previewMiles = parseFloat(formMiles) || 0;
  const previewAllowance = calcAllowance(previewMiles, totalMiles);
  const previewRate = previewMiles > 0 ? rateLabel(previewMiles, totalMiles) : null;

  // Group by month (preserve insertion order)
  const monthOrder: string[] = [];
  const byMonth: Record<string, typeof enriched> = {};
  for (const t of enriched) {
    if (!byMonth[t.month]) { byMonth[t.month] = []; monthOrder.push(t.month); }
    byMonth[t.month].push(t);
  }

  function handleAddTrip() {
    const m = parseFloat(formMiles);
    if (!formPurpose.trim() || !(m >= 1)) return;
    const newTrip: Trip = {
      id: `u-${Date.now()}`,
      date: formDate ? new Date(formDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "19 May 2026",
      month: "May 2026",
      purpose: formPurpose.trim(),
      from: formFrom.trim(),
      to: formTo.trim(),
      miles: m,
    };
    setTrips((prev) => [newTrip, ...prev]);
    setShowForm(false);
    setFormPurpose(""); setFormDate("2026-05-19"); setFormFrom(""); setFormTo(""); setFormMiles("");
  }

  const canSubmit = formPurpose.trim().length > 0 && parseFloat(formMiles) >= 1;

  return (
    <div>
      {/* ---- Narrow content column ---- */}
      <div style={{ maxWidth: 860, margin: "0 auto", padding: "40px 24px 64px" }}>

        {/* Page header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--zn-ink)", margin: 0 }}>Mileage</h1>
            <p style={{ fontSize: 13.5, color: "var(--zn-ink-3)", marginTop: 4 }}>
              {totalMiles} miles logged · {fmtGBP(totalAllowance)} HMRC allowance
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button style={ghostBtn}>Export CSV</button>
            <button style={pillBtn} onClick={() => setShowForm(true)}>+ Add trip</button>
          </div>
        </div>

        {/* HMRC info box */}
        <div style={{
          background: "var(--zn-surface-2)", border: "1px solid var(--zn-line-soft)", borderRadius: 10,
          padding: "10px 14px", fontSize: 12, color: "var(--zn-ink-3)", marginBottom: 24, lineHeight: 1.55,
        }}>
          HMRC AMAP rate: <strong style={{ color: "var(--zn-ink)" }}>45p/mile</strong> for the first 10,000 miles,{" "}
          <strong style={{ color: "var(--zn-ink)" }}>25p/mile</strong> thereafter. Allowance is deducted from taxable income and reduces your self-assessment tax bill.
        </div>

        {/* KPI row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 28 }}>
          <KpiCard label="Total miles" value={`${totalMiles} mi`} />
          <KpiCard label="HMRC allowance" value={fmtGBP(totalAllowance)} valueColor="var(--zn-safe)" />
          <KpiCard label="Est. tax saving (20%)" value={fmtGBP(estimatedTaxSaving)} valueColor="var(--zn-safe)" />
        </div>

        {/* Trip list by month */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {monthOrder.map((month) => {
            const mTrips = byMonth[month];
            const mMiles = mTrips.reduce((s, t) => s + t.miles, 0);
            const mAllowance = mTrips.reduce((s, t) => s + t.allowance, 0);
            return (
              <div key={month} style={card}>
                {/* Month header */}
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "12px 20px", borderBottom: "1px solid var(--zn-line-soft)",
                }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: "var(--zn-ink)" }}>{month}</span>
                    <span style={{ fontSize: 12, color: "var(--zn-ink-3)" }}>{mTrips.length} trip{mTrips.length !== 1 ? "s" : ""}</span>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span style={{ fontSize: 13, color: "var(--zn-ink-3)", marginRight: 12 }}>{mMiles} mi</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--zn-safe)" }}>{fmtGBP(mAllowance)}</span>
                  </div>
                </div>
                {/* Rows */}
                {mTrips.map((t, i) => (
                  <div key={t.id} style={{
                    display: "grid", gridTemplateColumns: "1fr auto auto",
                    gap: 16, alignItems: "center",
                    padding: "12px 20px",
                    borderBottom: i < mTrips.length - 1 ? "1px solid var(--zn-line-soft)" : undefined,
                  }}>
                    {/* Left */}
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 600, color: "var(--zn-ink)", margin: 0 }}>{t.purpose}</p>
                      {(t.from || t.to) && (
                        <p style={{ fontSize: 11, color: "var(--zn-ink-3)", marginTop: 2 }}>
                          {t.from}{t.from && t.to ? " → " : ""}{t.to}
                        </p>
                      )}
                      <p style={{ fontSize: 11, color: "var(--zn-ink-3)", marginTop: 1 }}>{t.date}</p>
                    </div>
                    {/* Miles */}
                    <div style={{ textAlign: "right" }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "var(--zn-ink)" }}>{t.miles}</span>
                      <span style={{ fontSize: 11, color: "var(--zn-ink-3)", marginLeft: 2 }}>mi</span>
                    </div>
                    {/* Allowance */}
                    <div style={{ textAlign: "right", minWidth: 90 }}>
                      <span style={{ fontSize: 11, color: "var(--zn-safe)" }}>{fmtGBP(t.allowance)} {t.rateLabel}</span>
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {/* ---- Add trip slide-in panel ---- */}
      {showForm && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 60,
          display: "flex", justifyContent: "flex-end",
          background: "rgba(0,0,0,0.35)",
        }} onClick={() => setShowForm(false)}>
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(420px, 100vw)", height: "100%",
              background: "var(--zn-surface)", overflowY: "auto",
              boxShadow: "-4px 0 32px rgba(0,0,0,0.12)",
              display: "flex", flexDirection: "column",
            }}
          >
            {/* Panel header */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "20px 24px 16px", borderBottom: "1px solid var(--zn-line-soft)",
            }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: "var(--zn-ink)" }}>Add trip</span>
              <button onClick={() => setShowForm(false)} style={{
                background: "none", border: "none", cursor: "pointer",
                fontSize: 20, color: "var(--zn-ink-3)", lineHeight: 1, padding: 4,
              }}>✕</button>
            </div>

            {/* Fields */}
            <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: 16, flex: 1 }}>
              <FormField label="Purpose *" placeholder="e.g. Client visit — Acme Ltd" value={formPurpose} onChange={setFormPurpose} />
              <FormField label="Date" type="date" value={formDate} onChange={setFormDate} />
              <FormField label="From" placeholder="e.g. London" value={formFrom} onChange={setFormFrom} />
              <FormField label="To" placeholder="e.g. Birmingham" value={formTo} onChange={setFormTo} />
              <FormField label="Miles *" type="number" placeholder="e.g. 42" value={formMiles} onChange={setFormMiles} />

              {/* Live allowance preview */}
              {previewMiles > 0 && (
                <div style={{
                  background: "var(--zn-safe-soft)", border: "1px solid var(--zn-line-soft)",
                  borderRadius: 8, padding: "10px 14px", fontSize: 12,
                }}>
                  <span style={{ color: "var(--zn-safe)", fontWeight: 700 }}>{fmtGBP(previewAllowance)}</span>
                  <span style={{ color: "var(--zn-ink-3)", marginLeft: 6 }}>
                    {previewRate === "@ 45p" ? "All at 45p/mile (under 10,000 mi total)" :
                     previewRate === "@ 25p" ? "All at 25p/mile (over 10,000 mi total)" :
                     "Split rate (crosses 10,000 mi threshold)"}
                  </span>
                </div>
              )}

              {/* Actions */}
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
                <button style={ghostBtn} onClick={() => setShowForm(false)}>Cancel</button>
                <button
                  style={{ ...pillBtn, opacity: canSubmit ? 1 : 0.4, cursor: canSubmit ? "pointer" : "not-allowed" }}
                  disabled={!canSubmit}
                  onClick={handleAddTrip}
                >
                  Add trip
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------
function KpiCard({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div style={{ ...card, padding: "16px 20px" }}>
      <p style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--zn-ink-3)", margin: 0 }}>{label}</p>
      <p style={{ fontSize: 22, fontWeight: 700, color: valueColor ?? "var(--zn-ink)", marginTop: 8, marginBottom: 0 }}>{value}</p>
    </div>
  );
}

function FormField({
  label, value, onChange, placeholder, type = "text",
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <label style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--zn-ink-3)" }}>{label}</label>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        style={{
          border: "1px solid var(--zn-line-soft)", borderRadius: 8,
          padding: "8px 12px", fontSize: 13, color: "var(--zn-ink)",
          background: "var(--zn-surface-2)", outline: "none", width: "100%", boxSizing: "border-box",
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared styles
// ---------------------------------------------------------------------------
const card: React.CSSProperties = {
  background: "var(--zn-surface)",
  border: "1px solid var(--zn-line-soft)",
  borderRadius: 12,
  overflow: "hidden",
};

const pillBtn: React.CSSProperties = {
  background: "var(--zn-bg-inverse)", color: "#fff",
  border: "none", borderRadius: 999,
  padding: "8px 18px", fontSize: 13, fontWeight: 600,
  cursor: "pointer", whiteSpace: "nowrap",
};

const ghostBtn: React.CSSProperties = {
  background: "transparent", color: "var(--zn-ink)",
  border: "1px solid var(--zn-line-soft)", borderRadius: 999,
  padding: "8px 18px", fontSize: 13, fontWeight: 600,
  cursor: "pointer", whiteSpace: "nowrap",
};
