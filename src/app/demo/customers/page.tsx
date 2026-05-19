"use client";

import { useState, useMemo, useRef } from "react";
import { Users, Info, Search, ChevronDown } from "lucide-react";
import { DEMO_AR_CUSTOMERS, DEMO_AR_TOTALS, type DemoARCustomer } from "@/lib/demo-data/demo-ar-data";

// ── Tokens ────────────────────────────────────────────────────────────────────
const T = {
  bg:      "var(--zn-bg)",
  card:    "var(--zn-surface)",
  surf2:   "var(--zn-surface-2)",
  ink:     "var(--zn-ink)",
  ink2:    "var(--zn-ink-2)",
  muted:   "var(--zn-ink-3)",
  border:  "var(--zn-line-soft)",
  green:   "var(--zn-safe)",
  amber:   "var(--zn-warn)",
  red:     "var(--zn-risk)",
  blue:    "var(--zn-info)",
  greenBg: "var(--zn-safe-soft)",
  amberBg: "var(--zn-warn-soft)",
  redBg:   "var(--zn-risk-soft)",
  blueBg:  "var(--zn-info-soft)",
} as const;

type Customer = DemoARCustomer;

const HIGH_RISK_OUTSTANDING = DEMO_AR_CUSTOMERS
  .filter((c) => c.riskLevel >= 4)
  .reduce((s, c) => s + c.outstanding, 0);

const REL_META: Record<string, { label: string; color: string }> = {
  regular: { label: "Regular",     color: T.green },
  slow:    { label: "Slow payer",  color: T.amber },
  problem: { label: "Problematic", color: T.red   },
  new:     { label: "New",         color: T.blue  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtGBP(n: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}
function fmtGBPExact(n: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}
function overdueColor(d: number) {
  if (d === 0) return T.muted;
  if (d <= 30) return T.amber;
  if (d <= 60) return T.amber;
  return T.red;
}
function riskPipColor(pip: number, level: number) {
  if (pip > level) return T.border;
  if (level <= 2)  return "var(--zn-muted)";
  if (level === 3) return T.amber;
  return T.red;
}
function riskLabelColor(level: number) {
  if (level <= 2) return T.muted;
  if (level === 3) return T.amber;
  return T.red;
}
function statusPillStyle(status: string): { color: string; background: string } {
  switch (status) {
    case "Action now":   return { color: T.red,   background: T.redBg   };
    case "Final notice": return { color: T.red,   background: T.redBg   };
    case "Follow up":    return { color: T.amber, background: T.amberBg };
    default:             return { color: T.muted, background: T.surf2   };
  }
}

// ── Risk tooltip ──────────────────────────────────────────────────────────────
function RiskTooltip({ factors }: { factors: readonly string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <button type="button"
        onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}
        style={{ color: T.muted, lineHeight: 1, background: "none", border: "none", cursor: "pointer", padding: 0 }}
      >
        <Info size={13} />
      </button>
      {open && (
        <div style={{
          position: "absolute", zIndex: 50, left: 18, top: 0,
          background: T.ink, borderRadius: 10,
          padding: "10px 12px", fontSize: 11.5, lineHeight: 1.55,
          width: 240, boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
        }}>
          <p style={{ fontWeight: 700, marginBottom: 6, color: T.card }}>Risk factors</p>
          {factors.map((f, i) => (
            <p key={i} style={{ margin: "2px 0", color: T.muted }}>· {f}</p>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Customer detail panel ─────────────────────────────────────────────────────
function DetailPanel({
  customer, notesDraft, notesSaved, onNotesChange, onNotesBlur,
}: {
  customer: Customer | null;
  notesDraft: Record<string, string>;
  notesSaved: string | null;
  onNotesChange: (id: string, v: string) => void;
  onNotesBlur: (id: string, v: string) => void;
}) {
  if (!customer) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", minHeight: 320, gap: 12, padding: 40, textAlign: "center" }}>
        <Users size={32} style={{ color: T.muted, opacity: 0.3 }} />
        <p style={{ fontSize: 13, color: T.muted, margin: 0 }}>Select a customer to see their profile</p>
      </div>
    );
  }

  const rel   = REL_META[customer.relationship] ?? { label: customer.relationship, color: T.muted };
  const notes = notesDraft[customer.id] ?? customer.notes;
  const saved = notesSaved === customer.id;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, padding: "20px 20px 28px" }}>
      {/* Header */}
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: rel.color, display: "inline-block", flexShrink: 0 }} />
          <span style={{ fontSize: 11, color: T.muted }}>{rel.label} · since {customer.since}</span>
        </div>
        <h2 style={{ fontSize: 18, fontWeight: 600, color: T.ink, margin: 0, letterSpacing: "-0.01em", lineHeight: 1.2 }}>
          {customer.name}
        </h2>
        <p style={{ fontSize: 12.5, color: T.muted, margin: "4px 0 0" }}>
          {customer.contact} · {customer.role} · {customer.type}
        </p>
      </div>

      {/* Summary grid 2×2 */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, borderRadius: 10, overflow: "hidden", background: T.border }}>
        {[
          { label: "Outstanding",      value: fmtGBP(customer.outstanding),                                               color: customer.outstanding > 0 ? T.ink : T.muted },
          { label: "Open invoices",    value: String(customer.openInvoices),                                              color: T.ink },
          { label: "Max overdue",      value: customer.maxOverdue > 0 ? `${customer.maxOverdue} days` : "—",             color: overdueColor(customer.maxOverdue) },
          { label: "Avg payment days", value: `${customer.avgPaymentDays} days`,                                         color: T.ink },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background: T.surf2, padding: "12px 14px" }}>
            <p style={{ fontSize: 10.5, color: T.muted, margin: "0 0 3px", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>{label}</p>
            <p style={{ fontSize: 17, fontWeight: 600, color, margin: 0, fontVariantNumeric: "tabular-nums" }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Risk */}
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: T.muted, margin: 0 }}>Risk</p>
          <RiskTooltip factors={customer.riskFactors} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          {[1,2,3,4,5].map((pip) => (
            <span key={pip} style={{ display: "inline-block", width: 24, height: 6, borderRadius: 3, background: riskPipColor(pip, customer.riskLevel) }} />
          ))}
          <span style={{ fontSize: 12, fontWeight: 600, color: riskLabelColor(customer.riskLevel), marginLeft: 4 }}>{customer.riskLabel}</span>
        </div>
      </div>

      {/* Open invoices */}
      <div>
        <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: T.muted, margin: "0 0 10px" }}>Open invoices</p>
        <div style={{ border: `1px solid ${T.border}`, borderRadius: 10, overflow: "hidden" }}>
          {customer.invoices.map((inv, i) => {
            const pill = statusPillStyle(inv.status);
            return (
              <div key={inv.ref} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderTop: i > 0 ? `1px solid ${T.border}` : "none", background: T.card }}>
                <span style={{ fontFamily: "monospace", fontSize: 10.5, color: T.muted, flexGrow: 1, minWidth: 0 }}>{inv.ref}</span>
                <span style={{ fontSize: 12.5, fontWeight: 600, fontVariantNumeric: "tabular-nums", color: T.ink, flexShrink: 0 }}>{fmtGBPExact(inv.amount)}</span>
                <span style={{ fontSize: 11, color: overdueColor(inv.overdue), width: 32, textAlign: "right", flexShrink: 0 }}>{inv.overdue > 0 ? `${inv.overdue}d` : "—"}</span>
                <span style={{ ...pill, borderRadius: 99, padding: "2px 8px", fontSize: 10.5, fontWeight: 600, flexShrink: 0 }}>{inv.status}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Notes */}
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: T.muted, margin: 0 }}>Notes</p>
          {saved && <span style={{ fontSize: 11, fontWeight: 600, color: T.green }}>Saved ✓</span>}
        </div>
        <textarea rows={3} value={notes}
          onChange={(e) => onNotesChange(customer.id, e.target.value)}
          onBlur={(e) => onNotesBlur(customer.id, e.target.value)}
          style={{ width: "100%", borderRadius: 10, padding: "10px 12px", fontSize: 12.5, lineHeight: 1.6, resize: "none", outline: "none", boxSizing: "border-box", background: T.surf2, border: `1px solid ${T.border}`, color: T.ink }}
        />
      </div>

      {/* Quick actions */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <a href={`mailto:${customer.email}`}
          style={{ borderRadius: 999, padding: "8px 16px", fontSize: 12.5, fontWeight: 600, color: T.card, background: "var(--zn-bg-inverse)", textDecoration: "none", display: "inline-block" }}>
          Email {customer.contact.split(" ")[0]}
        </a>
        {(["Log a call", "View statement"] as const).map((label) => (
          <button key={label} type="button"
            style={{ borderRadius: 999, padding: "8px 16px", fontSize: 12.5, fontWeight: 600, color: T.ink, background: "transparent", border: `1.5px solid ${T.border}`, cursor: "pointer" }}>
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function DemoCustomersPage() {
  const [selectedId, setSelectedId] = useState<string | null>("pemberton");
  const [search, setSearch]         = useState("");
  const [sort, setSort]             = useState("outstanding");
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});
  const [notesSaved, setNotesSaved] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedCustomer = useMemo(
    () => DEMO_AR_CUSTOMERS.find((c) => c.id === selectedId) ?? null,
    [selectedId],
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    let list = [...DEMO_AR_CUSTOMERS] as Customer[];
    if (q) list = list.filter((c) => c.name.toLowerCase().includes(q) || c.contact.toLowerCase().includes(q) || c.email.toLowerCase().includes(q));
    list.sort((a, b) => {
      if (sort === "name")    return a.name.localeCompare(b.name);
      if (sort === "overdue") return b.maxOverdue - a.maxOverdue;
      return b.outstanding - a.outstanding;
    });
    return list;
  }, [search, sort]);

  function handleNotesChange(id: string, value: string) {
    setNotesDraft((p) => ({ ...p, [id]: value }));
  }
  function handleNotesBlur(id: string, value: string) {
    setNotesDraft((p) => ({ ...p, [id]: value }));
    setNotesSaved(id);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => setNotesSaved(null), 1500);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Page header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: T.ink, margin: 0, letterSpacing: "-0.02em", lineHeight: 1.1 }}>Customers</h1>
          <p style={{ fontSize: 13.5, color: T.muted, margin: "6px 0 0" }}>
            {DEMO_AR_TOTALS.customerCount} customers · {fmtGBP(DEMO_AR_TOTALS.totalOutstanding)} outstanding · <span style={{ color: T.red }}>{fmtGBP(HIGH_RISK_OUTSTANDING)} at high risk</span>
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" style={{ borderRadius: 999, padding: "8px 16px", fontSize: 13, fontWeight: 500, color: T.ink, background: "transparent", border: `1.5px solid ${T.border}`, cursor: "pointer" }}>
            Import customers
          </button>
          <button type="button" style={{ borderRadius: 999, padding: "8px 16px", fontSize: 13, fontWeight: 600, color: "#fff", background: "var(--zn-bg-inverse)", border: "none", cursor: "pointer" }}>
            Add customer
          </button>
        </div>
      </div>

      {/* Two-panel */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr min(380px, 40%)", gap: 20, alignItems: "start" }}>

        {/* ── Left: customer list ── */}
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden" }}>

          {/* Search + sort */}
          <div style={{ padding: "12px 16px", borderBottom: `1px solid ${T.border}`, display: "flex", gap: 10, alignItems: "center" }}>
            <div style={{ position: "relative", flex: 1 }}>
              <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: T.muted, pointerEvents: "none" }} />
              <input type="text" placeholder="Search customers…" value={search} onChange={(e) => setSearch(e.target.value)}
                style={{ width: "100%", paddingLeft: 30, paddingRight: 12, paddingTop: 7, paddingBottom: 7, borderRadius: 8, border: `1px solid ${T.border}`, background: T.surf2, fontSize: 13, color: T.ink, outline: "none", boxSizing: "border-box" }}
              />
            </div>
            <div style={{ position: "relative", flexShrink: 0 }}>
              <select value={sort} onChange={(e) => setSort(e.target.value)}
                style={{ appearance: "none", paddingLeft: 10, paddingRight: 26, paddingTop: 7, paddingBottom: 7, borderRadius: 8, border: `1px solid ${T.border}`, background: T.surf2, fontSize: 13, color: T.ink, cursor: "pointer", outline: "none" }}
              >
                <option value="outstanding">Outstanding</option>
                <option value="overdue">Max overdue</option>
                <option value="name">Name A–Z</option>
              </select>
              <ChevronDown size={12} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", color: T.muted, pointerEvents: "none" }} />
            </div>
          </div>

          {/* Column headers */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 64px 96px 100px", padding: "8px 16px", borderBottom: `1px solid ${T.border}`, background: T.surf2, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: T.muted }}>
            <span>Customer</span>
            <span style={{ textAlign: "right" }}>Overdue</span>
            <span style={{ textAlign: "right" }}>Outstanding</span>
            <span style={{ paddingLeft: 12 }}>Status</span>
          </div>

          {/* Rows */}
          <div style={{ overflowY: "auto", maxHeight: "calc(100vh - 300px)" }}>
            {filtered.length === 0 && (
              <p style={{ padding: "40px 20px", textAlign: "center", fontSize: 13, color: T.muted }}>No customers match.</p>
            )}
            {filtered.map((c, idx) => {
              const rel = REL_META[c.relationship] ?? { label: c.relationship, color: T.muted };
              const isSelected = selectedId === c.id;
              return (
                <button key={c.id} type="button"
                  onClick={() => setSelectedId(isSelected ? null : c.id)}
                  style={{
                    width: "100%", textAlign: "left", display: "grid",
                    gridTemplateColumns: "1fr 64px 96px 100px",
                    alignItems: "center",
                    padding: "13px 16px", border: "none", cursor: "pointer",
                    borderBottom: idx < filtered.length - 1 ? `1px solid ${T.border}` : "none",
                    borderLeft: isSelected ? `2px solid ${T.ink}` : "2px solid transparent",
                    background: isSelected ? T.surf2 : T.card,
                    transition: "background 0.1s",
                  }}
                  onMouseEnter={(e) => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = T.surf2; }}
                  onMouseLeave={(e) => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = T.card; }}
                >
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: T.ink, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</p>
                    <p style={{ fontSize: 11, color: T.muted, margin: "2px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.contact}</p>
                  </div>
                  <span style={{ fontSize: 12, fontVariantNumeric: "tabular-nums", color: overdueColor(c.maxOverdue), textAlign: "right" }}>
                    {c.maxOverdue > 0 ? `${c.maxOverdue}d` : "—"}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 600, fontVariantNumeric: "tabular-nums", color: T.ink, textAlign: "right" }}>
                    {fmtGBP(c.outstanding)}
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: 5, paddingLeft: 12 }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: rel.color, display: "inline-block", flexShrink: 0 }} />
                    <span style={{ fontSize: 11.5, color: T.muted }}>{rel.label}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Right: detail panel ── */}
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden" }}>
          <DetailPanel
            customer={selectedCustomer}
            notesDraft={notesDraft}
            notesSaved={notesSaved}
            onNotesChange={handleNotesChange}
            onNotesBlur={handleNotesBlur}
          />
        </div>
      </div>

    </div>
  );
}
