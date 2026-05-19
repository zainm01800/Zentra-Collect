"use client";

/**
 * src/app/demo/customers/page.tsx
 *
 * Zentra Collect — Demo Customers page.
 * Hardcoded data only. No imports from @/lib or @/data.
 */

import { useState, useMemo, useRef } from "react";
import { Info, X, Search, ChevronDown } from "lucide-react";

// ---------------------------------------------------------------------------
// Colour tokens (inline style values)
// ---------------------------------------------------------------------------
const C = {
  bg:      "#FAF7F2",
  card:    "#FFFFFF",
  hover:   "#FAFAFA",
  surface2:"#F4F4F5",
  text:    "#1A1916",
  muted:   "#8A8680",
  border:  "rgba(0,0,0,0.08)",
  green:   "#16A34A",
  amber:   "#C28800",
  red:     "#DC2626",
  blue:    "#2563EB",
} as const;

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------
const CUSTOMERS = [
  {
    id: "meridian", name: "Meridian Studio", contact: "Sarah Whitford", role: "Operations Director",
    email: "sarah.whitford@meridianstudio.co.uk", phone: "+44 20 7946 0118",
    type: "Design agency", location: "London, UK", since: "Mar 2023",
    relationship: "regular", riskLevel: 2, riskLabel: "Low risk",
    outstanding: 9900, openInvoices: 3, maxOverdue: 62, avgPaymentDays: 31, paidOnTime: 14, paidLate: 0,
    invoices: [
      { ref: "INV-2026-0153", issued: "1 Mar 2026",  amount: 2350, overdue: 62, status: "Action now"  },
      { ref: "INV-2026-0151", issued: "21 Apr 2026", amount: 4800, overdue: 14, status: "Follow up"   },
      { ref: "INV-2026-0155", issued: "5 May 2026",  amount: 2750, overdue: 0,  status: "Current"     },
    ],
    riskFactors: [
      "Two unanswered reminders on INV-2026-0153 (62 days)",
      "Otherwise perfect 14-invoice on-time history",
      "Net-30 standard terms",
    ],
    notes: "Sarah is the right contact for finance queries. CFO change rumoured in Q3 — flag if payment cycle shifts.",
  },
  {
    id: "bluepeak", name: "BluePeak Ltd", contact: "Daniel Okafor", role: "Head of Finance",
    email: "accounts@bluepeak.ltd.uk", phone: "+44 161 555 0142",
    type: "Logistics SME", location: "Manchester, UK", since: "Aug 2024",
    relationship: "slow", riskLevel: 3, riskLabel: "Medium risk",
    outstanding: 17200, openInvoices: 3, maxOverdue: 31, avgPaymentDays: 43, paidOnTime: 4, paidLate: 2,
    invoices: [
      { ref: "INV-2026-0138", issued: "12 Apr 2026", amount: 12250, overdue: 23, status: "Action now" },
      { ref: "INV-2026-0147", issued: "4 May 2026",  amount: 3200,  overdue: 31, status: "Follow up"  },
      { ref: "INV-2026-0152", issued: "12 May 2026", amount: 1750,  overdue: 0,  status: "Current"    },
    ],
    riskFactors: [
      "2 of 6 invoices paid late in past 6 months",
      "Average 43-day payment vs Net-30 terms",
      "AP cycle runs on the 15th and end-of-month",
    ],
    notes: "AP team only processes runs on the 15th and end-of-month. Best to align invoice timing.",
  },
  {
    id: "oaktree", name: "Oaktree Consulting", contact: "Priya Raman", role: "Managing Partner",
    email: "priya@oaktree-consulting.com", phone: "+44 20 3964 7720",
    type: "Strategy consultancy", location: "London, UK", since: "Jun 2022",
    relationship: "regular", riskLevel: 2, riskLabel: "Low risk",
    outstanding: 11300, openInvoices: 2, maxOverdue: 47, avgPaymentDays: 26, paidOnTime: 20, paidLate: 1,
    invoices: [
      { ref: "INV-2026-0142", issued: "1 Apr 2026",  amount: 8400, overdue: 47, status: "Action now" },
      { ref: "INV-2026-0149", issued: "4 Apr 2026",  amount: 2900, overdue: 15, status: "Follow up"  },
    ],
    riskFactors: [
      "47-day overdue on INV-2026-0142 — unusually long for Oaktree",
      "20 of 21 lifetime invoices paid on time",
      "Past dispute resolved amicably in Sep 2025",
    ],
    notes: "Priya prefers direct calls over emails for anything over £5,000. Note to follow up the formal pre-action letter with a call.",
  },
  {
    id: "harrow", name: "Harrow Digital", contact: "Adeola Thompson", role: "Finance Manager",
    email: "finance@harrowdigital.io", phone: "+44 20 4538 7711",
    type: "Digital marketing", location: "London, UK", since: "Jan 2026",
    relationship: "new", riskLevel: 1, riskLabel: "Low risk",
    outstanding: 4200, openInvoices: 1, maxOverdue: 0, avgPaymentDays: 18, paidOnTime: 3, paidLate: 0,
    invoices: [
      { ref: "INV-2026-0158", issued: "10 May 2026", amount: 4200, overdue: 0, status: "Current" },
    ],
    riskFactors: [
      "New client — 3 invoices to date, all paid within 18 days",
      "Net-14 terms requested",
      "No outstanding queries",
    ],
    notes: "Onboarded Jan 2026. Quick payer so far — keep an eye as volume scales in Q3.",
  },
  {
    id: "pemberton", name: "Pemberton & Co", contact: "James Pemberton", role: "Managing Director",
    email: "j.pemberton@pemberton-co.uk", phone: "+44 121 555 0167",
    type: "Family-office advisory", location: "Birmingham, UK", since: "Nov 2021",
    relationship: "problem", riskLevel: 5, riskLabel: "Critical risk",
    outstanding: 23750, openInvoices: 4, maxOverdue: 112, avgPaymentDays: 78, paidOnTime: 6, paidLate: 11,
    invoices: [
      { ref: "INV-2026-0098", issued: "27 Jan 2026", amount: 9500, overdue: 112, status: "Final notice" },
      { ref: "INV-2026-0107", issued: "14 Feb 2026", amount: 7250, overdue: 94,  status: "Action now"   },
      { ref: "INV-2026-0124", issued: "10 Mar 2026", amount: 4500, overdue: 70,  status: "Action now"   },
      { ref: "INV-2026-0143", issued: "8 Apr 2026",  amount: 2500, overdue: 41,  status: "Follow up"    },
    ],
    riskFactors: [
      "4 open invoices · oldest 112 days past due",
      "11 of 17 lifetime invoices paid late",
      "Avg 78-day payment vs Net-30 terms",
      "Statutory interest accruing on 3 invoices",
    ],
    notes: "Sent pre-action protocol letter on 12 May. James acknowledged but offered no payment date. Recommend credit hold and county-court letter prep.",
  },
] as const;

type Customer = (typeof CUSTOMERS)[number];

const RELATIONSHIP_META: Record<string, { label: string; dot: string }> = {
  regular: { label: "Regular",     dot: C.green },
  slow:    { label: "Slow payer",  dot: C.amber },
  problem: { label: "Problematic", dot: C.red   },
  new:     { label: "New",         dot: C.blue  },
};

const TOTAL_OUTSTANDING = 66350;
const TOTAL_AT_RISK     = 23750;
const TOTAL_OPEN_INV    = 13;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function fmtGBP(n: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency", currency: "GBP",
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(n);
}

function fmtGBPExact(n: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency", currency: "GBP",
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(n);
}

function overdueColor(days: number): string {
  if (days === 0)  return C.muted;
  if (days <= 30)  return C.muted;
  if (days <= 60)  return C.amber;
  return C.red;
}

function statusPillStyle(status: string): { color: string; background: string } {
  switch (status) {
    case "Action now":   return { color: C.red,   background: "#FEE2E2" };
    case "Final notice": return { color: C.red,   background: "#FEE2E2" };
    case "Follow up":    return { color: C.amber, background: "#FEF9C3" };
    case "Current":      return { color: C.muted, background: C.surface2 };
    case "Monitoring":   return { color: C.muted, background: C.surface2 };
    default:             return { color: C.muted, background: C.surface2 };
  }
}

function riskPipColor(pip: number, riskLevel: number): string {
  if (pip > riskLevel) return C.border;
  if (riskLevel <= 2) return "#9CA3AF";   // grey
  if (riskLevel === 3) return C.amber;
  return C.red;
}

function riskLabelColor(riskLevel: number): string {
  if (riskLevel <= 2) return C.muted;
  if (riskLevel === 3) return C.amber;
  return C.red;
}

// ---------------------------------------------------------------------------
// Risk Tooltip
// ---------------------------------------------------------------------------
function RiskTooltip({ factors }: { factors: readonly string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative inline-block">
      <button
        type="button"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        aria-label="Risk score information"
        style={{ color: C.muted, lineHeight: 1 }}
      >
        <Info size={13} />
      </button>
      {open && (
        <div
          className="absolute z-50 left-5 top-0 w-64 rounded-xl p-3 text-[11.5px] leading-relaxed shadow-lg"
          style={{ background: C.text, color: "#FAF7F2", minWidth: 220 }}
        >
          <p className="font-semibold mb-1.5" style={{ color: "#FAF7F2" }}>How risk is scored</p>
          <ul className="flex flex-col gap-1 list-none">
            {factors.map((f, i) => (
              <li key={i} style={{ color: "#D1D5DB" }}>· {f}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Customer Drawer
// ---------------------------------------------------------------------------
function CustomerDrawer({
  customer,
  notesDraft,
  notesSaved,
  onNotesBlur,
  onNotesChange,
  onClose,
}: {
  customer: Customer | null;
  notesDraft: Record<string, string>;
  notesSaved: string | null;
  onNotesBlur: (id: string, value: string) => void;
  onNotesChange: (id: string, value: string) => void;
  onClose: () => void;
}) {
  if (!customer) return null;

  const meta   = RELATIONSHIP_META[customer.relationship] ?? { label: customer.relationship, dot: C.muted };
  const notes  = notesDraft[customer.id] ?? customer.notes;
  const saved  = notesSaved === customer.id;

  return (
    <div
      className="flex flex-col overflow-y-auto shrink-0"
      style={{
        width: "40%",
        minWidth: 340,
        maxWidth: 480,
        background: C.card,
        borderLeft: `1px solid ${C.border}`,
        borderRadius: "0 16px 16px 0",
      }}
    >
      {/* Header */}
      <div
        className="flex items-start justify-between gap-3 px-5 py-4 sticky top-0 z-10"
        style={{ background: C.card, borderBottom: `1px solid ${C.border}` }}
      >
        <div className="min-w-0">
          {/* Eyebrow */}
          <div className="flex items-center gap-1.5 mb-1">
            <span
              className="inline-block rounded-full"
              style={{ width: 7, height: 7, background: meta.dot, flexShrink: 0 }}
            />
            <span className="text-[11px]" style={{ color: C.muted }}>
              {meta.label} · Customer since {customer.since}
            </span>
          </div>
          <h2 className="text-[18px] font-semibold leading-tight" style={{ color: C.text }}>
            {customer.name}
          </h2>
          <p className="text-[12.5px] mt-0.5" style={{ color: C.muted }}>
            {customer.contact} · {customer.role} · {customer.type}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 hover:bg-black/5 shrink-0 mt-0.5"
          aria-label="Close"
        >
          <X size={15} style={{ color: C.muted }} />
        </button>
      </div>

      <div className="flex flex-col gap-5 px-5 py-5">
        {/* Summary grid 2x2 */}
        <div
          className="grid grid-cols-2 gap-px rounded-xl overflow-hidden"
          style={{ background: C.border }}
        >
          {[
            { label: "Outstanding",      value: fmtGBP(customer.outstanding),   color: customer.outstanding > 0 ? C.text : C.muted },
            { label: "Open invoices",    value: `${customer.openInvoices}`,      color: C.text },
            { label: "Max overdue",      value: customer.maxOverdue > 0 ? `${customer.maxOverdue} days` : "—", color: overdueColor(customer.maxOverdue) },
            { label: "Avg payment days", value: `${customer.avgPaymentDays} days`, color: C.text },
          ].map(({ label, value, color }) => (
            <div key={label} className="flex flex-col gap-0.5 px-4 py-3" style={{ background: C.surface2 }}>
              <span className="text-[10.5px]" style={{ color: C.muted }}>{label}</span>
              <span className="text-[17px] font-semibold tabular-nums leading-tight" style={{ color }}>
                {value}
              </span>
            </div>
          ))}
        </div>

        {/* Risk */}
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.07em]" style={{ color: C.muted }}>Risk</span>
            <RiskTooltip factors={customer.riskFactors} />
          </div>
          <div className="flex items-center gap-1.5">
            {[1, 2, 3, 4, 5].map((pip) => (
              <span
                key={pip}
                className="rounded"
                style={{
                  display: "inline-block",
                  width: 24,
                  height: 6,
                  background: pip <= customer.riskLevel
                    ? riskPipColor(pip, customer.riskLevel)
                    : "rgba(0,0,0,0.08)",
                }}
              />
            ))}
            <span className="ml-1 text-[12px] font-medium" style={{ color: riskLabelColor(customer.riskLevel) }}>
              {customer.riskLabel}
            </span>
          </div>
        </div>

        {/* Open invoices */}
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.07em] mb-2" style={{ color: C.muted }}>
            Open invoices
          </p>
          <div
            className="rounded-xl overflow-hidden"
            style={{ border: `1px solid ${C.border}` }}
          >
            {customer.invoices.map((inv, i) => {
              const pillStyle = statusPillStyle(inv.status);
              return (
                <div
                  key={inv.ref}
                  className="flex items-center gap-2 px-3.5 py-2.5"
                  style={{
                    borderTop: i > 0 ? `1px solid ${C.border}` : undefined,
                    background: C.card,
                  }}
                >
                  {/* Ref */}
                  <span
                    className="shrink-0"
                    style={{ fontFamily: "monospace", fontSize: 10.5, color: C.muted, width: 108 }}
                  >
                    {inv.ref}
                  </span>
                  {/* Issued */}
                  <span className="grow text-[11.5px]" style={{ color: C.muted }}>{inv.issued}</span>
                  {/* Amount */}
                  <span className="text-[12.5px] font-semibold tabular-nums shrink-0" style={{ color: C.text }}>
                    {fmtGBPExact(inv.amount)}
                  </span>
                  {/* Overdue */}
                  <span
                    className="text-[11.5px] tabular-nums shrink-0 w-10 text-right"
                    style={{ color: overdueColor(inv.overdue) }}
                  >
                    {inv.overdue > 0 ? `${inv.overdue}d` : "—"}
                  </span>
                  {/* Status pill */}
                  <span
                    className="rounded-full px-2 py-0.5 text-[10.5px] font-semibold shrink-0"
                    style={pillStyle}
                  >
                    {inv.status}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Notes */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.07em]" style={{ color: C.muted }}>Notes</p>
            {saved && (
              <span className="text-[11px] font-medium" style={{ color: C.green }}>Saved ✓</span>
            )}
          </div>
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => onNotesChange(customer.id, e.target.value)}
            onBlur={(e) => onNotesBlur(customer.id, e.target.value)}
            className="w-full rounded-xl px-3.5 py-2.5 text-[12.5px] leading-relaxed resize-none outline-none"
            style={{
              background: C.surface2,
              border: `1px solid ${C.border}`,
              color: C.text,
            }}
            placeholder="Add notes…"
          />
        </div>

        {/* Quick actions */}
        <div className="flex flex-wrap gap-2">
          <a
            href={`mailto:${customer.email}`}
            className="rounded-full px-4 py-2 text-[12.5px] font-semibold text-white"
            style={{ background: C.text }}
          >
            Email {customer.contact.split(" ")[0]}
          </a>
          <button
            type="button"
            className="rounded-full px-4 py-2 text-[12.5px] font-semibold"
            style={{ border: `1.5px solid ${C.border}`, color: C.text, background: "transparent" }}
          >
            Log a call
          </button>
          <button
            type="button"
            className="rounded-full px-4 py-2 text-[12.5px] font-semibold"
            style={{ border: `1.5px solid ${C.border}`, color: C.text, background: "transparent" }}
          >
            View statement
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function DemoCustomersPage() {
  const [selectedId, setSelectedId]   = useState<string | null>(null);
  const [search, setSearch]           = useState<string>("");
  const [sort, setSort]               = useState<string>("outstanding");
  const [notesDraft, setNotesDraft]   = useState<Record<string, string>>({});
  const [notesSaved, setNotesSaved]   = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedCustomer = useMemo(
    () => CUSTOMERS.find((c) => c.id === selectedId) ?? null,
    [selectedId],
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    let list = [...CUSTOMERS];
    if (q) {
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.contact.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          c.type.toLowerCase().includes(q),
      );
    }
    list.sort((a, b) => {
      if (sort === "name")        return a.name.localeCompare(b.name);
      if (sort === "overdue")     return b.maxOverdue - a.maxOverdue;
      return b.outstanding - a.outstanding; // default: outstanding
    });
    return list;
  }, [search, sort]);

  function handleNotesChange(id: string, value: string) {
    setNotesDraft((prev) => ({ ...prev, [id]: value }));
  }

  function handleNotesBlur(id: string, value: string) {
    setNotesDraft((prev) => ({ ...prev, [id]: value }));
    setNotesSaved(id);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => setNotesSaved(null), 1500);
  }

  const drawerOpen = selectedId !== null;

  return (
    <div className="flex flex-col gap-5" style={{ background: C.bg, minHeight: "100%" }}>
      {/* Page header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[28px] font-semibold tracking-[-0.02em] leading-[1.1]" style={{ color: C.text }}>
            Customers
          </h1>
          <p className="mt-1 text-[13.5px]" style={{ color: C.muted }}>
            5 customers&nbsp;·&nbsp;{fmtGBP(TOTAL_OUTSTANDING)} outstanding&nbsp;·&nbsp;
            <span style={{ color: C.red }}>{fmtGBP(TOTAL_AT_RISK)} at high risk</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-full px-4 py-2 text-[13px] font-semibold"
            style={{ border: `1.5px solid ${C.border}`, color: C.text, background: "transparent" }}
          >
            Import customers
          </button>
          <button
            type="button"
            className="rounded-full px-4 py-2 text-[13px] font-semibold text-white"
            style={{ background: C.text }}
          >
            Add customer
          </button>
        </div>
      </div>

      {/* Tools bar */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Search */}
        <div className="relative" style={{ width: 280 }}>
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: C.muted }} />
          <input
            type="text"
            placeholder="Search customers…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl pl-8 pr-3.5 py-2 text-[13px] outline-none"
            style={{
              background: C.card,
              border: `1px solid ${C.border}`,
              color: C.text,
            }}
          />
        </div>

        {/* Sort */}
        <div className="relative">
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="appearance-none rounded-xl pl-3.5 pr-8 py-2 text-[13px] outline-none cursor-pointer"
            style={{
              background: C.card,
              border: `1px solid ${C.border}`,
              color: C.text,
            }}
          >
            <option value="outstanding">Sort: Outstanding</option>
            <option value="name">Sort: Name</option>
            <option value="overdue">Sort: Overdue days</option>
          </select>
          <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: C.muted }} />
        </div>
      </div>

      {/* List + drawer flex row */}
      <div className="flex gap-0 rounded-2xl overflow-hidden" style={{ border: `1px solid ${C.border}`, background: C.card }}>
        {/* Customer table */}
        <div className="flex flex-col" style={{ flex: drawerOpen ? "0 0 60%" : "1 1 100%" }}>
          {/* Column headers */}
          <div
            className="hidden sm:grid gap-4 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.06em] border-b"
            style={{
              gridTemplateColumns: "1fr auto auto auto 130px",
              color: C.muted,
              borderColor: C.border,
              background: C.surface2,
            }}
          >
            <span>Customer</span>
            <span className="text-center">Open</span>
            <span className="text-right">Max overdue</span>
            <span className="text-right">Outstanding</span>
            <span>Relationship</span>
          </div>

          {/* Rows */}
          <div className="divide-y" style={{ borderColor: C.border }}>
            {filtered.length === 0 && (
              <p className="px-5 py-8 text-[13px] text-center" style={{ color: C.muted }}>
                No customers match your search.
              </p>
            )}
            {filtered.map((c) => {
              const meta      = RELATIONSHIP_META[c.relationship] ?? { label: c.relationship, dot: C.muted };
              const isSelected = selectedId === c.id;
              const overdueCol = overdueColor(c.maxOverdue);

              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedId(isSelected ? null : c.id)}
                  className="w-full text-left hidden sm:grid gap-4 px-5 py-3.5 transition-colors"
                  style={{
                    gridTemplateColumns: "1fr auto auto auto 130px",
                    background: isSelected ? C.surface2 : undefined,
                    borderLeft: isSelected ? `2px solid ${C.text}` : "2px solid transparent",
                    cursor: "pointer",
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) (e.currentTarget as HTMLElement).style.background = C.hover;
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) (e.currentTarget as HTMLElement).style.background = "";
                  }}
                >
                  {/* c1: name + contact · email */}
                  <div className="min-w-0">
                    <p
                      className="truncate"
                      style={{ fontSize: 13, fontWeight: 600, color: C.text }}
                    >
                      {c.name}
                    </p>
                    <p
                      className="truncate mt-0.5"
                      style={{ fontSize: 11, color: C.muted }}
                    >
                      {c.contact}&nbsp;·&nbsp;{c.email}
                    </p>
                  </div>

                  {/* c2: open invoices pill */}
                  <div className="flex items-center justify-center">
                    <span
                      className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold tabular-nums"
                      style={{ background: C.surface2, color: C.muted }}
                    >
                      {c.openInvoices} invoice{c.openInvoices !== 1 ? "s" : ""}
                    </span>
                  </div>

                  {/* c3: max overdue */}
                  <div
                    className="flex items-center justify-end text-[12.5px] tabular-nums"
                    style={{ color: overdueCol }}
                  >
                    {c.maxOverdue === 0 ? "—" : `${c.maxOverdue}d`}
                  </div>

                  {/* c4: outstanding */}
                  <div
                    className="flex items-center justify-end text-[13px] font-semibold tabular-nums"
                    style={{ color: C.text }}
                  >
                    {fmtGBP(c.outstanding)}
                  </div>

                  {/* c5: relationship pill */}
                  <div className="flex items-center gap-1.5">
                    <span
                      className="rounded-full inline-block shrink-0"
                      style={{ width: 7, height: 7, background: meta.dot }}
                    />
                    <span className="text-[11.5px]" style={{ color: C.muted }}>
                      {meta.label}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Mobile rows (simple) */}
          <div className="sm:hidden divide-y" style={{ borderColor: C.border }}>
            {filtered.map((c) => {
              const meta = RELATIONSHIP_META[c.relationship] ?? { label: c.relationship, dot: C.muted };
              const isSelected = selectedId === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedId(isSelected ? null : c.id)}
                  className="w-full text-left flex items-center justify-between gap-3 px-4 py-3.5"
                  style={{
                    background: isSelected ? C.surface2 : undefined,
                    borderLeft: isSelected ? `2px solid ${C.text}` : "2px solid transparent",
                  }}
                >
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold truncate" style={{ color: C.text }}>{c.name}</p>
                    <p className="text-[11px] mt-0.5 truncate" style={{ color: C.muted }}>{c.contact}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[13px] font-semibold tabular-nums" style={{ color: C.text }}>{fmtGBP(c.outstanding)}</p>
                    <div className="flex items-center justify-end gap-1 mt-0.5">
                      <span className="rounded-full inline-block" style={{ width: 6, height: 6, background: meta.dot }} />
                      <span className="text-[10.5px]" style={{ color: C.muted }}>{meta.label}</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Drawer panel (no overlay — part of page flow) */}
        {drawerOpen && (
          <CustomerDrawer
            customer={selectedCustomer}
            notesDraft={notesDraft}
            notesSaved={notesSaved}
            onNotesChange={handleNotesChange}
            onNotesBlur={handleNotesBlur}
            onClose={() => setSelectedId(null)}
          />
        )}
      </div>
    </div>
  );
}
