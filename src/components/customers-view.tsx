"use client";

import { useState, useMemo } from "react";
import { Edit2 } from "lucide-react";
import { demoCustomers, demoInvoices } from "@/lib/demo-data/zentra-demo-data";
import { formatCurrency, formatDate } from "@/lib/formatters";

// ── Industry labels ────────────────────────────────────────────────────────────
const INDUSTRY: Record<string, string> = {
  "BrightPath Media Ltd":    "Media & PR",
  "Northline Creative":      "Creative agency",
  "Atlas IT Support":        "IT services",
  "Greenstone Consulting":   "Management consulting",
  "Riverbank Studios":       "Creative studio",
  "Clearview Recruitment":   "Recruitment",
  "Ashford Digital":         "Digital marketing",
  "BluePeak Design":         "Design studio",
  "Harbour Works Ltd":       "Facilities management",
  "Lancaster Dental Group":  "Healthcare",
  "Maple & Stone Property":  "Property",
  "Orchard HR Ltd":          "HR services",
  "Pioneer Retail Group":    "Retail",
  "Summit Ventures":         "Venture investment",
  "Studio Elevate":          "Film production",
  "Willow Training Co":      "Training & development",
  "Kentmere Kitchens":       "Interior fit-out",
  "Elmstead Legal Services": "Legal services",
  "Redfern Architecture":    "Architecture",
};

// ── Avatar colours (deterministic by name hash) ───────────────────────────────
const AVATAR_PALETTE = [
  { bg: "#7B4F3A", text: "#fff" },
  { bg: "#4A6741", text: "#fff" },
  { bg: "#2F5480", text: "#fff" },
  { bg: "#7A3D5A", text: "#fff" },
  { bg: "#5C4A7A", text: "#fff" },
  { bg: "#B86A25", text: "#fff" },
  { bg: "#3A6B6B", text: "#fff" },
  { bg: "#8B4513", text: "#fff" },
];

function avatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
}

function initials(name: string) {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

// ── Per-customer stats derived from invoices ──────────────────────────────────
function buildStats(customerId: string) {
  const all = demoInvoices.filter((i) => i.customerId === customerId);
  const open = all.filter((i) => i.status !== "paid");
  const overdue = all.filter((i) => i.daysOverdue > 0 && i.status !== "paid");

  const outstanding = open.reduce((s, i) => s + i.amountOutstanding, 0);
  const avgDaysLate = overdue.length
    ? Math.round(overdue.reduce((s, i) => s + i.daysOverdue, 0) / overdue.length)
    : 0;
  const remindersTypical = all.length
    ? Math.round(all.reduce((s, i) => s + i.previousChaseCount, 0) / all.length)
    : 0;
  const missedPromises = all.filter((i) => i.status === "missed_promise").length;
  const disputes = all.filter((i) => i.status === "disputed").length;

  // Synthetic 6-month sparkline — shows upward trend ending at current daysOverdue
  const base = avgDaysLate > 0 ? Math.max(5, avgDaysLate - 25) : 5;
  const sparkData = [base, base + 3, base + 6, base + 10, base + 15, avgDaysLate || base + 18];

  return { outstanding, avgDaysLate, remindersTypical, missedPromises, disputes, open, sparkData };
}

// ── Risk derived from outstanding / daysOverdue ───────────────────────────────
function riskLevel(oldest: number): "high" | "med" | "low" {
  if (oldest > 60) return "high";
  if (oldest > 25) return "med";
  return "low";
}

const RISK_LABEL = { high: "High risk", med: "Medium risk", low: "Low risk" };
const RISK_COLOR = {
  high: { bg: "var(--zn-risk-soft)", text: "var(--zn-risk)" },
  med:  { bg: "var(--zn-warn-soft)", text: "var(--zn-warn)" },
  low:  { bg: "var(--zn-safe-soft)", text: "var(--zn-safe)" },
};

// ── Sparkline SVG ─────────────────────────────────────────────────────────────
function Sparkline({ data }: { data: number[] }) {
  const w = 320, h = 80, pad = 8;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const stepX = (w - pad * 2) / (data.length - 1);
  const pts = data.map((v, i) => [
    pad + i * stepX,
    h - pad - ((v - min) / span) * (h - pad * 2),
  ]);
  const d = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const area = `${d} L${pts[pts.length - 1][0].toFixed(1)},${h - pad} L${pts[0][0].toFixed(1)},${h - pad} Z`;
  const last = pts[pts.length - 1];
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ overflow: "visible" }}>
      <path d={area} fill="var(--zn-accent)" opacity="0.12" />
      <path d={d} fill="none" stroke="var(--zn-accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r="3.5" fill="var(--zn-accent)" />
    </svg>
  );
}

// ── Customer detail panel ─────────────────────────────────────────────────────
function CustomerDetail({ customerId }: { customerId: string }) {
  const customer = demoCustomers.find((c) => c.id === customerId);
  const [editingNote, setEditingNote] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  if (!customer) return null;

  const stats = buildStats(customerId);
  const oldest = stats.open.length
    ? Math.max(...stats.open.map((i) => i.daysOverdue))
    : 0;
  const risk = riskLevel(oldest);
  const color = avatarColor(customer.name);
  const industry = INDUSTRY[customer.name] ?? customer.relationshipType;
  const behaviourNote = note ?? customer.customerNotes;

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="zn-card p-5 lg:p-6">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div className="flex items-center gap-4">
            <div
              className="size-12 rounded-xl flex items-center justify-center text-[15px] font-semibold flex-shrink-0"
              style={{ background: color.bg, color: color.text }}
            >
              {initials(customer.name)}
            </div>
            <div>
              <h2 className="text-[20px] font-semibold text-[#1d1813] leading-tight">
                {customer.name}
              </h2>
              <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[12.5px]" style={{ color: "var(--zn-ink-3)" }}>
                <span>{industry}</span>
                {customer.contactName && (
                  <>
                    <span>·</span>
                    <span>{customer.contactName}</span>
                  </>
                )}
                {customer.email && (
                  <>
                    <span>·</span>
                    <a
                      href={`mailto:${customer.email}`}
                      className="hover:underline"
                      style={{ color: "var(--zn-ink-3)" }}
                    >
                      {customer.email}
                    </a>
                  </>
                )}
              </div>
            </div>
          </div>
          <span
            className="zn-chip flex-shrink-0"
            style={{ background: RISK_COLOR[risk].bg, color: RISK_COLOR[risk].text, borderColor: "transparent" }}
          >
            <span
              className="size-1.5 rounded-full inline-block mr-1"
              style={{ background: RISK_COLOR[risk].text }}
            />
            {RISK_LABEL[risk]}
          </span>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {[
            { label: "Outstanding",      value: formatCurrency(stats.outstanding) },
            { label: "Avg days late",    value: stats.avgDaysLate > 0 ? `${stats.avgDaysLate}d` : "—" },
            { label: "Reminders typical",value: String(stats.remindersTypical) },
            { label: "Missed promises",  value: String(stats.missedPromises) },
            { label: "Disputes (12m)",   value: String(stats.disputes) },
          ].map(({ label, value }) => (
            <div key={label} className="flex flex-col gap-1">
              <div className="zn-label !p-0">{label}</div>
              <div className="text-[18px] font-semibold text-[#1d1813] tabular-nums leading-none mt-0.5">
                {value}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Behaviour note */}
      <div
        className="zn-card p-5"
        style={{ border: "1px solid var(--zn-line-soft)" }}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="zn-label !p-0">Behaviour note</div>
          {!editingNote && (
            <button
              onClick={() => setEditingNote(true)}
              className="flex items-center gap-1.5 text-[12px] font-medium"
              style={{ color: "var(--zn-ink-3)" }}
            >
              <Edit2 className="size-3" /> Edit
            </button>
          )}
        </div>
        {editingNote ? (
          <div className="flex flex-col gap-2">
            <textarea
              className="w-full rounded-lg border p-2.5 text-[13px] resize-none outline-none"
              style={{
                borderColor: "var(--zn-line)",
                background: "var(--zn-surface)",
                color: "var(--zn-ink)",
                minHeight: 72,
              }}
              value={behaviourNote}
              onChange={(e) => setNote(e.target.value)}
            />
            <div className="flex gap-2">
              <button
                className="zn-pill"
                style={{ height: 28, fontSize: 12, padding: "0 12px" }}
                onClick={() => setEditingNote(false)}
              >
                Save
              </button>
              <button
                className="zn-pill zn-pill-ghost"
                style={{ height: 28, fontSize: 12, padding: "0 12px" }}
                onClick={() => { setNote(null); setEditingNote(false); }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <p className="text-[13.5px] italic leading-relaxed" style={{ color: "var(--zn-ink-2)" }}>
            &ldquo;{behaviourNote}&rdquo;
          </p>
        )}
      </div>

      {/* Charts + open invoices */}
      <div className="grid gap-5 lg:grid-cols-2">
        {/* Sparkline */}
        <div className="zn-card p-5">
          <div className="zn-label !p-0 mb-1">Days late</div>
          <div className="text-[15px] font-medium text-[#1d1813] mb-4">Last 6 months</div>
          {stats.avgDaysLate > 0 ? (
            <Sparkline data={stats.sparkData} />
          ) : (
            <div className="h-20 flex items-center justify-center text-[13px]" style={{ color: "var(--zn-ink-3)" }}>
              No overdue history
            </div>
          )}
        </div>

        {/* Open invoices */}
        <div className="zn-card p-0 overflow-hidden">
          <div className="p-5 pb-3">
            <div className="zn-label !p-0">Open invoices</div>
          </div>
          {stats.open.length === 0 ? (
            <div className="px-5 pb-5 text-[13px]" style={{ color: "var(--zn-ink-3)" }}>
              No open invoices.
            </div>
          ) : (
            <div className="flex flex-col">
              {stats.open.slice(0, 6).map((inv) => (
                <div
                  key={inv.id}
                  className="flex items-center justify-between px-5 py-3"
                  style={{ borderTop: "1px solid var(--zn-line-soft)" }}
                >
                  <div>
                    <div className="text-[13px] font-medium text-[#1d1813]">{inv.invoiceNumber}</div>
                    <div className="text-[12px] mt-0.5" style={{ color: "var(--zn-ink-3)" }}>
                      Due {inv.dueDate ? formatDate(inv.dueDate) : "—"}
                      {inv.daysOverdue > 0 && (
                        <span className="ml-1.5 font-semibold" style={{ color: "var(--zn-risk)" }}>
                          {inv.daysOverdue}d overdue
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-[14px] font-semibold tabular-nums text-[#1d1813]">
                    {formatCurrency(inv.amountOutstanding)}
                  </div>
                </div>
              ))}
              {stats.open.length > 6 && (
                <div
                  className="px-5 py-3 text-[12px] text-center"
                  style={{ color: "var(--zn-ink-3)", borderTop: "1px solid var(--zn-line-soft)" }}
                >
                  +{stats.open.length - 6} more
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main customers view ───────────────────────────────────────────────────────
export function CustomersView() {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string>(demoCustomers[0]?.id ?? "");

  const customerStats = useMemo(() =>
    demoCustomers.map((c) => {
      const all = demoInvoices.filter((i) => i.customerId === c.id);
      const open = all.filter((i) => i.status !== "paid");
      const oldest = open.length ? Math.max(...open.map((i) => i.daysOverdue)) : 0;
      const outstanding = open.reduce((s, i) => s + i.amountOutstanding, 0);
      return { ...c, outstanding, oldest, risk: riskLevel(oldest) };
    })
    .sort((a, b) => b.outstanding - a.outstanding),
  []);

  const filtered = useMemo(() =>
    customerStats.filter((c) =>
      c.name.toLowerCase().includes(query.toLowerCase()) ||
      (INDUSTRY[c.name] ?? "").toLowerCase().includes(query.toLowerCase())
    ),
  [customerStats, query]);

  return (
    <div className="flex gap-5 min-h-0">
      {/* Left: customer list */}
      <div
        className="flex flex-col flex-shrink-0 rounded-xl overflow-hidden"
        style={{
          width: 296,
          background: "var(--zn-surface)",
          border: "1px solid var(--zn-line-soft)",
        }}
      >
        {/* Search */}
        <div className="p-3" style={{ borderBottom: "1px solid var(--zn-line-soft)" }}>
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5"
              style={{ color: "var(--zn-ink-3)" }}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search customers"
              className="w-full rounded-lg border py-2 pl-9 pr-3 text-[13px] outline-none"
              style={{
                background: "var(--zn-bg-2)",
                borderColor: "var(--zn-line)",
                color: "var(--zn-ink)",
              }}
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {filtered.map((c) => {
            const color = avatarColor(c.name);
            const active = c.id === selectedId;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedId(c.id)}
                className="w-full text-left px-3 py-3 transition-colors"
                style={{
                  borderBottom: "1px solid var(--zn-line-soft)",
                  background: active ? "var(--zn-surface-2)" : "transparent",
                  boxShadow: active ? "inset 3px 0 0 var(--zn-accent)" : "none",
                }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="size-9 rounded-lg flex items-center justify-center text-[11px] font-semibold flex-shrink-0"
                    style={{ background: color.bg, color: color.text }}
                  >
                    {initials(c.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[13px] font-semibold text-[#1d1813] truncate">{c.name}</span>
                      <span className="text-[12.5px] font-medium tabular-nums text-[#1d1813] flex-shrink-0">
                        {formatCurrency(c.outstanding)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-1 mt-0.5">
                      <span className="text-[11.5px] truncate" style={{ color: "var(--zn-ink-3)" }}>
                        {INDUSTRY[c.name] ?? c.relationshipType}
                      </span>
                      <span
                        className="text-[10.5px] font-semibold flex-shrink-0 px-1.5 py-0.5 rounded-full"
                        style={{
                          background: RISK_COLOR[c.risk].bg,
                          color: RISK_COLOR[c.risk].text,
                        }}
                      >
                        <span
                          className="inline-block size-1.5 rounded-full mr-1"
                          style={{ background: RISK_COLOR[c.risk].text }}
                        />
                        {RISK_LABEL[c.risk]}
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
          {filtered.length === 0 && (
            <div className="p-6 text-center text-[13px]" style={{ color: "var(--zn-ink-3)" }}>
              No customers match.
            </div>
          )}
        </div>
      </div>

      {/* Right: detail */}
      <div className="flex-1 min-w-0">
        {selectedId ? (
          <CustomerDetail customerId={selectedId} />
        ) : (
          <div className="zn-card p-10 text-center text-[13px]" style={{ color: "var(--zn-ink-3)" }}>
            Select a customer to see their profile.
          </div>
        )}
      </div>
    </div>
  );
}
