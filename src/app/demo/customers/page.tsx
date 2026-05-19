"use client";

import { useState, useMemo, useRef } from "react";
import { Users, Info, Search, ChevronDown } from "lucide-react";

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

// ── Data ──────────────────────────────────────────────────────────────────────
const CUSTOMERS = [
  {
    id: "pemberton", name: "Pemberton & Co", contact: "James Pemberton", role: "Managing Director",
    email: "j.pemberton@pemberton-co.uk", phone: "+44 121 555 0167",
    type: "Family-office advisory", location: "Birmingham, UK", since: "Nov 2021",
    relationship: "problem", riskLevel: 5, riskLabel: "Critical risk",
    outstanding: 23750, openInvoices: 4, maxOverdue: 112, avgPaymentDays: 78, paidOnTime: 6, paidLate: 11,
    invoices: [
      { ref: "INV-2026-0098", amount: 9500,  overdue: 112, status: "Final notice" },
      { ref: "INV-2026-0107", amount: 7250,  overdue: 94,  status: "Action now"   },
      { ref: "INV-2026-0124", amount: 4500,  overdue: 70,  status: "Action now"   },
      { ref: "INV-2026-0143", amount: 2500,  overdue: 41,  status: "Follow up"    },
    ],
    riskFactors: ["4 open invoices · oldest 112 days past due", "11 of 17 lifetime invoices paid late", "Avg 78-day payment vs Net-30 terms", "Statutory interest accruing on 3 invoices"],
    notes: "Sent pre-action protocol letter on 12 May. James acknowledged but offered no payment date. Recommend credit hold and county-court letter prep.",
  },
  {
    id: "bluepeak", name: "BluePeak Ltd", contact: "Daniel Okafor", role: "Head of Finance",
    email: "accounts@bluepeak.ltd.uk", phone: "+44 161 555 0142",
    type: "Logistics SME", location: "Manchester, UK", since: "Aug 2024",
    relationship: "slow", riskLevel: 3, riskLabel: "Medium risk",
    outstanding: 17200, openInvoices: 3, maxOverdue: 31, avgPaymentDays: 43, paidOnTime: 4, paidLate: 2,
    invoices: [
      { ref: "INV-2026-0138", amount: 12250, overdue: 23, status: "Action now" },
      { ref: "INV-2026-0147", amount: 3200,  overdue: 31, status: "Follow up"  },
      { ref: "INV-2026-0152", amount: 1750,  overdue: 0,  status: "Current"    },
    ],
    riskFactors: ["2 of 6 invoices paid late in past 6 months", "Average 43-day payment vs Net-30 terms", "AP cycle runs on the 15th and end-of-month"],
    notes: "AP team only processes runs on the 15th and end-of-month. Best to align invoice timing.",
  },
  {
    id: "oaktree", name: "Oaktree Consulting", contact: "Priya Raman", role: "Managing Partner",
    email: "priya@oaktree-consulting.com", phone: "+44 20 3964 7720",
    type: "Strategy consultancy", location: "London, UK", since: "Jun 2022",
    relationship: "regular", riskLevel: 2, riskLabel: "Low risk",
    outstanding: 11300, openInvoices: 2, maxOverdue: 47, avgPaymentDays: 26, paidOnTime: 20, paidLate: 1,
    invoices: [
      { ref: "INV-2026-0142", amount: 8400, overdue: 47, status: "Action now" },
      { ref: "INV-2026-0149", amount: 2900, overdue: 15, status: "Follow up"  },
    ],
    riskFactors: ["47-day overdue on INV-2026-0142 — unusually long for Oaktree", "20 of 21 lifetime invoices paid on time", "Past dispute resolved amicably in Sep 2025"],
    notes: "Priya prefers direct calls over emails for anything over £5,000. Note to follow up the formal pre-action letter with a call.",
  },
  {
    id: "meridian", name: "Meridian Studio", contact: "Sarah Whitford", role: "Operations Director",
    email: "sarah.whitford@meridianstudio.co.uk", phone: "+44 20 7946 0118",
    type: "Design agency", location: "London, UK", since: "Mar 2023",
    relationship: "regular", riskLevel: 2, riskLabel: "Low risk",
    outstanding: 9900, openInvoices: 3, maxOverdue: 62, avgPaymentDays: 31, paidOnTime: 14, paidLate: 0,
    invoices: [
      { ref: "INV-2026-0153", amount: 2350, overdue: 62, status: "Action now"  },
      { ref: "INV-2026-0151", amount: 4800, overdue: 14, status: "Follow up"   },
      { ref: "INV-2026-0155", amount: 2750, overdue: 0,  status: "Current"     },
    ],
    riskFactors: ["Two unanswered reminders on INV-2026-0153 (62 days)", "Otherwise perfect 14-invoice on-time history", "Net-30 standard terms"],
    notes: "Sarah is the right contact for finance queries. CFO change rumoured in Q3 — flag if payment cycle shifts.",
  },
  {
    id: "harrow", name: "Harrow Digital", contact: "Adeola Thompson", role: "Finance Manager",
    email: "finance@harrowdigital.io", phone: "+44 20 4538 7711",
    type: "Digital marketing", location: "London, UK", since: "Jan 2026",
    relationship: "new", riskLevel: 1, riskLabel: "Low risk",
    outstanding: 4200, openInvoices: 1, maxOverdue: 0, avgPaymentDays: 18, paidOnTime: 3, paidLate: 0,
    invoices: [
      { ref: "INV-2026-0158", amount: 4200, overdue: 0, status: "Current" },
    ],
    riskFactors: ["New client — 3 invoices to date, all paid within 18 days", "Net-14 terms requested", "No outstanding queries"],
    notes: "Onboarded Jan 2026. Quick payer so far — keep an eye as volume scales in Q3.",
  },
] as const;

type Customer = (typeof CUSTOMERS)[number];

const REL_META: Record<string, { label: string; color: string }> = {
  regular: { label: "Regular",     color: T.green },
  slow:    { label: "Slow payer",  color: T.amber },
  problem: { label: "Problematic", color: T.red   },
  new:     { label: "New",         color: T.blue  },
};

// ── Aged debt buckets ─────────────────────────────────────────────────────────
interface Bucket { label: string; min: number; max: number | null; color: string; bg: string }
const BUCKETS: Bucket[] = [
  { label: "Current",    min: 0,  max: 0,   color: T.muted, bg: T.surf2   },
  { label: "1–30 days",  min: 1,  max: 30,  color: T.amber, bg: T.amberBg },
  { label: "31–60 days", min: 31, max: 60,  color: T.red,   bg: T.redBg   },
  { label: "61–90 days", min: 61, max: 90,  color: T.red,   bg: T.redBg   },
  { label: "90+ days",   min: 91, max: null, color: T.red,  bg: T.redBg   },
];

function bucketAmount(invoices: readonly { overdue: number; amount: number }[], b: Bucket) {
  return invoices
    .filter((i) => i.overdue >= b.min && (b.max === null || i.overdue <= b.max))
    .reduce((s, i) => s + i.amount, 0);
}

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

// ── Aged debt table ───────────────────────────────────────────────────────────
function AgedDebt() {
  const grandTotals = BUCKETS.map((b) => ({
    ...b,
    total: CUSTOMERS.reduce((s, c) => s + bucketAmount(c.invoices, b), 0),
  }));
  const grandTotal = CUSTOMERS.reduce((s, c) => s + c.outstanding, 0);

  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden" }}>
      <div style={{ padding: "14px 20px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, color: T.ink, margin: 0 }}>Aged debt</h2>
        <span style={{ fontSize: 12, color: T.muted }}>All customers · {fmtGBP(grandTotal)} outstanding</span>
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
            {[...CUSTOMERS].sort((a, b) => b.outstanding - a.outstanding).filter((c) => c.outstanding > 0).map((c, i, arr) => (
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
                {fmtGBP(grandTotal)}
              </td>
            </tr>
          </tfoot>
        </table>
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
    () => CUSTOMERS.find((c) => c.id === selectedId) ?? null,
    [selectedId],
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    let list = [...CUSTOMERS] as Customer[];
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
            5 customers · {fmtGBP(66350)} outstanding · <span style={{ color: T.red }}>{fmtGBP(23750)} at high risk</span>
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
      <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 20, alignItems: "start" }}>

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

      {/* Aged debt */}
      <AgedDebt />
    </div>
  );
}
