"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Edit2, ExternalLink, Users, FileText, Upload, Mail } from "lucide-react";
import { demoCustomers, demoInvoices } from "@/lib/demo-data/zentra-demo-data";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { CustomerRiskProfile } from "@/components/customer-risk-profile";
import { CustomerAiDiagnosis } from "@/components/customer-ai-diagnosis";
import { CustomerTimeline } from "@/components/customer-timeline";
import { computeCustomerRisk } from "@/lib/risk-score";
import { useLocalAccount } from "@/lib/billing/use-local-account";
import { importedInvoicesStorageKey } from "@/lib/import/zentra-import";
import {
  readActiveClientId,
  clientInvoicesKey,
} from "@/lib/bookkeeper-clients";
import type { Invoice } from "@/types/zentra";

const BOOKKEEPER_PLAN_IDS = ["bookkeeper_starter", "bookkeeper_pro"];

// ── Customer contact overrides storage ────────────────────────────────────────
const CONTACT_OVERRIDES_KEY = "zentra.customerOverrides.v1";

type ContactOverrides = Record<string, { name?: string; email?: string }>;

function readContactOverrides(): ContactOverrides {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(CONTACT_OVERRIDES_KEY);
    return raw ? (JSON.parse(raw) as ContactOverrides) : {};
  } catch {
    return {};
  }
}

function saveContactOverride(customerId: string, patch: { name?: string; email?: string }) {
  const overrides = readContactOverrides();
  overrides[customerId] = { ...overrides[customerId], ...patch };
  try {
    localStorage.setItem(CONTACT_OVERRIDES_KEY, JSON.stringify(overrides));
  } catch { /* quota */ }
}

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
function buildStats(customerId: string, invoices: Invoice[]) {
  const all = invoices.filter((i) => i.customerId === customerId);
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

// ── Synthetic customer object built from imported invoices ────────────────────
type VirtualCustomer = {
  id: string;
  name: string;
  email?: string;
  contactName?: string;
  relationshipType: string;
  customerNotes?: string;
  creditLimit?: number;
};

function buildVirtualCustomers(invoices: Invoice[]): VirtualCustomer[] {
  const map = new Map<string, VirtualCustomer>();
  for (const inv of invoices) {
    if (!map.has(inv.customerId)) {
      map.set(inv.customerId, {
        id: inv.customerId,
        name: inv.customerName,
        email: inv.customerEmail,
        relationshipType: inv.relationshipType ?? "client",
        customerNotes: inv.customerNotes,
      });
    }
  }
  return Array.from(map.values());
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

// ── Credit limit bar ──────────────────────────────────────────────────────────
function CreditLimitBar({ outstanding, creditLimit }: { outstanding: number; creditLimit: number }) {
  const pct = Math.min(100, Math.round((outstanding / creditLimit) * 100));
  const isOver = outstanding > creditLimit;
  const isWarning = pct >= 80;

  const barColor = isOver
    ? "var(--zn-risk)"
    : isWarning
    ? "var(--zn-warn)"
    : "var(--zn-safe)";

  return (
    <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--zn-line-soft)" }}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--zn-ink-3)" }}>
          Credit limit
        </span>
        <div className="flex items-center gap-2">
          {isOver && (
            <span
              className="text-[10.5px] font-semibold px-2 py-0.5 rounded-full"
              style={{ background: "var(--zn-risk-soft)", color: "var(--zn-risk)" }}
            >
              Over limit
            </span>
          )}
          <span className="text-[12px] font-semibold tabular-nums" style={{ color: isOver ? "var(--zn-risk)" : "var(--zn-ink-2)" }}>
            {formatCurrency(outstanding)} / {formatCurrency(creditLimit)}
          </span>
          <span className="text-[11px] font-medium tabular-nums" style={{ color: barColor }}>
            {pct}%
          </span>
        </div>
      </div>
      <div
        className="w-full h-1.5 rounded-full overflow-hidden"
        style={{ background: "var(--zn-line-soft)" }}
      >
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: barColor }}
        />
      </div>
    </div>
  );
}

// ── Customer detail panel ─────────────────────────────────────────────────────
export function CustomerDetail({
  customerId,
  customer: propCustomer,
  invoices: propInvoices,
  isImported = false,
}: {
  customerId: string;
  customer?: VirtualCustomer;
  invoices?: Invoice[];
  /** True for real users — enables contact editing */
  isImported?: boolean;
}) {
  const rawCustomer = propCustomer ?? demoCustomers.find((c) => c.id === customerId);
  const invoices = propInvoices ?? demoInvoices;
  const [editingNote, setEditingNote] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [editingContact, setEditingContact] = useState(false);
  const [contactOverride, setContactOverride] = useState<{ name?: string; email?: string }>({});

  // Load contact overrides from localStorage on mount
  useEffect(() => {
    const overrides = readContactOverrides();
    setContactOverride(overrides[customerId] ?? {});
  }, [customerId]);

  if (!rawCustomer) return null;

  // Merge overrides: show edited values, fall back to raw customer data
  const customer = {
    ...rawCustomer,
    name:  contactOverride.name  ?? rawCustomer.name,
    email: contactOverride.email ?? rawCustomer.email,
  };

  const stats = buildStats(customerId, invoices);
  const oldest = stats.open.length
    ? Math.max(...stats.open.map((i) => i.daysOverdue))
    : 0;
  const risk = riskLevel(oldest);
  const color = avatarColor(customer.name);
  const industry = INDUSTRY[rawCustomer.name] ?? rawCustomer.relationshipType;
  const behaviourNote = note ?? rawCustomer.customerNotes ?? "";

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="zn-card p-5 lg:p-6">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <div
              className="size-12 rounded-xl flex items-center justify-center text-[15px] font-semibold flex-shrink-0"
              style={{ background: color.bg, color: color.text }}
            >
              {initials(customer.name)}
            </div>
            <div className="min-w-0 flex-1">
              {editingContact ? (
                <div className="flex flex-col gap-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10.5px] font-semibold uppercase tracking-[0.07em]" style={{ color: "var(--zn-ink-3)" }}>
                      Display name
                    </label>
                    <input
                      type="text"
                      value={contactOverride.name ?? customer.name}
                      onChange={(e) => setContactOverride((o) => ({ ...o, name: e.target.value }))}
                      className="w-full rounded-lg border px-2.5 py-1.5 text-[13px] outline-none"
                      style={{ borderColor: "var(--zn-line)", background: "var(--zn-bg-2)", color: "var(--zn-ink)" }}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10.5px] font-semibold uppercase tracking-[0.07em]" style={{ color: "var(--zn-ink-3)" }}>
                      Email
                    </label>
                    <input
                      type="email"
                      value={contactOverride.email ?? customer.email ?? ""}
                      onChange={(e) => setContactOverride((o) => ({ ...o, email: e.target.value }))}
                      className="w-full rounded-lg border px-2.5 py-1.5 text-[13px] outline-none"
                      style={{ borderColor: "var(--zn-line)", background: "var(--zn-bg-2)", color: "var(--zn-ink)" }}
                    />
                  </div>
                  <div className="flex gap-2 mt-1">
                    <button
                      className="zn-pill"
                      style={{ height: 26, fontSize: 11.5, padding: "0 12px" }}
                      onClick={() => {
                        saveContactOverride(customerId, contactOverride);
                        setEditingContact(false);
                      }}
                    >
                      Save
                    </button>
                    <button
                      className="zn-pill zn-pill-ghost"
                      style={{ height: 26, fontSize: 11.5, padding: "0 12px" }}
                      onClick={() => {
                        const overrides = readContactOverrides();
                        setContactOverride(overrides[customerId] ?? {});
                        setEditingContact(false);
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <h2 className="text-[20px] font-semibold text-[#1d1813] dark:text-[#f0e8d5] leading-tight">
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
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span
              className="zn-chip"
              style={{ background: RISK_COLOR[risk].bg, color: RISK_COLOR[risk].text, borderColor: "transparent" }}
            >
              <span
                className="size-1.5 rounded-full inline-block mr-1"
                style={{ background: RISK_COLOR[risk].text }}
              />
              {RISK_LABEL[risk]}
            </span>
            {isImported && !editingContact && (
              <button
                type="button"
                onClick={() => setEditingContact(true)}
                className="flex-shrink-0 rounded-lg p-1.5 transition-colors hover:bg-[#ece3cc] dark:hover:bg-[#28231c]"
                title="Edit contact"
                aria-label="Edit contact name and email"
              >
                <Mail className="size-3.5" style={{ color: "var(--zn-ink-3)" }} />
              </button>
            )}
            <Link
              href={`/customers/${customerId}/statement`}
              onClick={(e) => e.stopPropagation()}
              className="flex-shrink-0 rounded-lg p-1.5 transition-colors hover:bg-[#ece3cc] dark:hover:bg-[#28231c]"
              title="View statement"
              aria-label="View statement"
            >
              <FileText className="size-3.5" style={{ color: "var(--zn-ink-3)" }} />
            </Link>
            <Link
              href={`/customers/${customerId}`}
              onClick={(e) => e.stopPropagation()}
              className="flex-shrink-0 rounded-lg p-1.5 transition-colors hover:bg-[#ece3cc] dark:hover:bg-[#28231c]"
              title="Open full page"
              aria-label="Open full page"
            >
              <ExternalLink className="size-3.5" style={{ color: "var(--zn-ink-3)" }} />
            </Link>
          </div>
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
              <div className="text-[18px] font-semibold text-[#1d1813] dark:text-[#f0e8d5] tabular-nums leading-none mt-0.5">
                {value}
              </div>
            </div>
          ))}
        </div>

        {/* Credit limit utilisation */}
        {customer.creditLimit && customer.creditLimit > 0 && (
          <CreditLimitBar outstanding={stats.outstanding} creditLimit={customer.creditLimit} />
        )}
      </div>

      {/* Risk profile — payment behaviour + statutory interest + Companies House */}
      <CustomerRiskProfile
        customerName={customer.name}
        invoices={invoices.filter((inv) => inv.customerId === customerId)}
      />

      {/* AI diagnosis — generates a 2-sentence summary + concrete next action */}
      {(() => {
        const customerInvoices = invoices.filter((inv) => inv.customerId === customerId);
        const risk = computeCustomerRisk(customer.name, customerInvoices);
        return (
          <CustomerAiDiagnosis
            input={{
              customerName:       customer.name,
              openInvoiceCount:   risk.stats.openInvoiceCount,
              totalOutstanding:   risk.stats.totalOutstanding,
              averageDaysOverdue: risk.stats.averageDaysOverdue,
              maxDaysOverdue:     risk.stats.maxDaysOverdue,
              totalChaseCount:    risk.stats.totalChaseCount,
              brokenPromises:     risk.stats.brokenPromises,
              disputedInvoices:   risk.stats.disputedInvoices,
            }}
          />
        );
      })()}

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
        ) : behaviourNote ? (
          <p className="text-[13.5px] italic leading-relaxed" style={{ color: "var(--zn-ink-2)" }}>
            &ldquo;{behaviourNote}&rdquo;
          </p>
        ) : (
          <p className="text-[13px]" style={{ color: "var(--zn-ink-3)" }}>
            No note yet. Click Edit to add one.
          </p>
        )}
      </div>

      {/* Communication timeline */}
      <div className="zn-card p-5">
        <div className="zn-label !p-0 mb-4">Communication history</div>
        <CustomerTimeline
          invoices={invoices.filter((inv) => inv.customerId === customerId)}
        />
      </div>

      {/* Charts + open invoices */}
      <div className="grid gap-5 lg:grid-cols-2">
        {/* Sparkline */}
        <div className="zn-card p-5">
          <div className="zn-label !p-0 mb-1">Days late</div>
          <div className="text-[15px] font-medium text-[#1d1813] dark:text-[#f0e8d5] mb-4">Last 6 months</div>
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
                <Link
                  key={inv.id}
                  href={`/invoices/${inv.id}`}
                  className="flex items-center justify-between px-5 py-3 transition-colors hover:bg-[#f3ecd8] dark:hover:bg-[#2d2820]"
                  style={{ borderTop: "1px solid var(--zn-line-soft)" }}
                >
                  <div>
                    <div className="text-[13px] font-medium text-[#1d1813] dark:text-[#f0e8d5]">{inv.invoiceNumber}</div>
                    <div className="text-[12px] mt-0.5" style={{ color: "var(--zn-ink-3)" }}>
                      Due {inv.dueDate ? formatDate(inv.dueDate) : "—"}
                      {inv.daysOverdue > 0 && (
                        <span className="ml-1.5 font-semibold" style={{ color: "var(--zn-risk)" }}>
                          {inv.daysOverdue}d overdue
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-[14px] font-semibold tabular-nums text-[#1d1813] dark:text-[#f0e8d5]">
                    {formatCurrency(inv.amountOutstanding)}
                  </div>
                </Link>
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
  const { account } = useLocalAccount();
  const isDemo = account?.planId === "demo";

  const [query, setQuery] = useState("");
  const [mobileDetail, setMobileDetail] = useState(false);

  // ── Load imported invoices from localStorage for real users ────────────────
  const [importedInvoices, setImportedInvoices] = useState<Invoice[]>([]);
  useEffect(() => {
    if (isDemo) return;
    try {
      // Bookkeeper plan users with an active client: load from that client's key
      let storageKey = importedInvoicesStorageKey;
      if (account && BOOKKEEPER_PLAN_IDS.includes(account.planId)) {
        const activeClientId = readActiveClientId();
        if (activeClientId && activeClientId !== "all") {
          storageKey = clientInvoicesKey(activeClientId);
        }
      }
      const raw = localStorage.getItem(storageKey);
      if (raw) setImportedInvoices(JSON.parse(raw) as Invoice[]);
    } catch {
      // ignore parse errors
    }
  }, [isDemo, account]);

  // ── Build virtual customers from imported invoices ────────────────────────
  const virtualCustomers = useMemo(
    () => (isDemo ? [] : buildVirtualCustomers(importedInvoices)),
    [isDemo, importedInvoices],
  );

  // ── Combine source-of-truth depending on mode ─────────────────────────────
  const sourceCustomers = isDemo ? demoCustomers : virtualCustomers;
  const sourceInvoices  = isDemo ? demoInvoices  : importedInvoices;

  const customerStats = useMemo(() => {
    return sourceCustomers.map((c) => {
      const all = sourceInvoices.filter((i) => i.customerId === c.id);
      const open = all.filter((i) => i.status !== "paid");
      const oldest = open.length ? Math.max(...open.map((i) => i.daysOverdue)) : 0;
      const outstanding = open.reduce((s, i) => s + i.amountOutstanding, 0);
      return { ...c, outstanding, oldest, risk: riskLevel(oldest) };
    }).sort((a, b) => b.outstanding - a.outstanding);
  }, [sourceCustomers, sourceInvoices]);

  const [selectedId, setSelectedId] = useState<string>("");

  // Auto-select first customer once data loads
  useEffect(() => {
    if (customerStats.length > 0 && !selectedId) {
      setSelectedId(customerStats[0].id);
    }
  }, [customerStats, selectedId]);

  const filtered = useMemo(() =>
    customerStats.filter((c) =>
      c.name.toLowerCase().includes(query.toLowerCase()) ||
      (INDUSTRY[c.name] ?? "").toLowerCase().includes(query.toLowerCase())
    ),
  [customerStats, query]);

  // ── Empty state for authenticated users with no imports ───────────────────
  if (!isDemo && importedInvoices.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-4 rounded-2xl p-14 text-center"
        style={{ border: "1px solid var(--zn-line-soft)", background: "var(--zn-surface)" }}
      >
        <div
          className="size-12 rounded-2xl flex items-center justify-center"
          style={{ background: "var(--zn-bg-2)" }}
        >
          <Users className="size-5" style={{ color: "var(--zn-ink-3)" }} />
        </div>
        <div>
          <p className="text-[15px] font-semibold text-[#1d1813] dark:text-[#f0e8d5]">No customers yet</p>
          <p className="mt-1 text-[13px]" style={{ color: "var(--zn-ink-3)" }}>
            Import an invoice export to see your customers here.
          </p>
        </div>
        <Link
          href="/import"
          className="flex items-center gap-2 zn-pill"
          style={{ height: 36, padding: "0 18px", fontSize: 13 }}
        >
          <Upload className="size-3.5" />
          Import invoices
        </Link>
      </div>
    );
  }

  function selectCustomer(id: string) {
    setSelectedId(id);
    setMobileDetail(true);
  }

  const selectedCustomer = isDemo
    ? undefined
    : virtualCustomers.find((c) => c.id === selectedId);

  return (
    <div className="flex gap-5 min-h-0 relative">
      {/* Left: customer list — hidden on mobile when detail is open */}
      <div
        className={`flex-col flex-shrink-0 rounded-xl overflow-hidden ${mobileDetail ? "hidden md:flex" : "flex w-full"}`}
        style={{
          width: "100%",
          maxWidth: 296,
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
                onClick={() => selectCustomer(c.id)}
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
                      <span className="text-[13px] font-semibold text-[#1d1813] dark:text-[#f0e8d5] truncate">{c.name}</span>
                      <span className="text-[12.5px] font-medium tabular-nums text-[#1d1813] dark:text-[#f0e8d5] flex-shrink-0">
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

      {/* Right: detail — full-screen on mobile, side panel on desktop */}
      <div className={`flex-1 min-w-0 ${mobileDetail ? "flex flex-col" : "hidden md:block"}`}>
        {selectedId ? (
          <>
            {/* Mobile back button */}
            <button
              type="button"
              onClick={() => setMobileDetail(false)}
              className="md:hidden flex items-center gap-1.5 mb-3 text-[13px] font-medium transition-colors"
              style={{ color: "var(--zn-ink-3)" }}
            >
              <ArrowLeft className="size-4" />
              All customers
            </button>
            <CustomerDetail
              customerId={selectedId}
              customer={selectedCustomer}
              invoices={isDemo ? undefined : sourceInvoices}
              isImported={!isDemo}
            />
          </>
        ) : (
          <div className="zn-card p-10 text-center text-[13px]" style={{ color: "var(--zn-ink-3)" }}>
            Select a customer to see their profile.
          </div>
        )}
      </div>
    </div>
  );
}
