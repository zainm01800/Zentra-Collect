"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { ChevronDown, ChevronRight, Info, Pencil, Check, X, Paperclip, AlertTriangle } from "lucide-react";

// ── Category definitions ──────────────────────────────────────────────────────

type ExpenseCategory =
  | "Software" | "Office" | "Travel" | "Communications"
  | "Insurance" | "Entertaining" | "Professional Services"
  | "Marketing" | "Equipment";

interface CategoryMeta {
  color:        string;
  bg:           string;
  allowablePct: number;
  vatClaimable: boolean;
  hint:         string;
}

const CATEGORY_META: Record<ExpenseCategory, CategoryMeta> = {
  "Software":              { color: "var(--zn-info)",   bg: "var(--zn-info-soft)",   allowablePct: 100, vatClaimable: true,  hint: "Business software and subscriptions — fully allowable for Self Assessment." },
  "Office":                { color: "var(--zn-ink-2)",  bg: "var(--zn-surface-2)",   allowablePct: 100, vatClaimable: true,  hint: "Office supplies — fully allowable for Self Assessment." },
  "Travel":                { color: "var(--zn-safe)",   bg: "var(--zn-safe-soft)",   allowablePct: 100, vatClaimable: false, hint: "Business travel is fully allowable. Most public transport is zero-rated — no VAT to reclaim." },
  "Communications":        { color: "var(--zn-accent)", bg: "var(--zn-accent-soft)", allowablePct: 50,  vatClaimable: true,  hint: "HMRC typically allows 50% for phone/broadband on mixed personal/business use. 50% of VAT is reclaimable." },
  "Insurance":             { color: "var(--zn-warn)",   bg: "var(--zn-warn-soft)",   allowablePct: 100, vatClaimable: false, hint: "Business insurance is fully allowable. Premiums are VAT-exempt — nothing to reclaim." },
  "Entertaining":          { color: "var(--zn-risk)",   bg: "var(--zn-risk-soft)",   allowablePct: 0,   vatClaimable: false, hint: "HMRC does not allow client entertainment as a tax deduction. VAT on entertaining is also blocked input tax." },
  "Professional Services": { color: "var(--zn-info)",   bg: "var(--zn-info-soft)",   allowablePct: 100, vatClaimable: true,  hint: "Accountant, legal and professional fees — fully allowable for Self Assessment." },
  "Marketing":             { color: "var(--zn-ink-2)",  bg: "var(--zn-surface-2)",   allowablePct: 100, vatClaimable: true,  hint: "Advertising and marketing spend — fully allowable for Self Assessment." },
  "Equipment":             { color: "var(--zn-safe)",   bg: "var(--zn-safe-soft)",   allowablePct: 100, vatClaimable: true,  hint: "Business equipment — fully allowable via the Annual Investment Allowance (AIA)." },
};

const CATEGORY_LIST = Object.keys(CATEGORY_META) as ExpenseCategory[];

// ── VAT line & expense data model ─────────────────────────────────────────────

interface VatLine {
  label:       string;
  net:         number;
  vatRate:     number;  // 20 | 5 | 0 | -1 (exempt/outside scope)
  vat:         number;
  gross:       number;
  reclaimable: boolean;
}

interface DemoExpense {
  id:         string;
  date:       string;
  description:string;
  category:   ExpenseCategory;
  hasReceipt: boolean;
  vatLines:   VatLine[];
}

// Helper label for a VAT rate number
function vatRateLabel(rate: number) {
  if (rate === -1) return "Exempt";
  if (rate === 0)  return "0%";
  return `${rate}%`;
}

// ── Demo data ─────────────────────────────────────────────────────────────────

const BASE_EXPENSES: DemoExpense[] = [
  {
    id: "e-1", date: "2026-05-12", description: "Adobe Creative Cloud",
    category: "Software", hasReceipt: true,
    vatLines: [{ label: "Monthly subscription", net: 49.99, vatRate: 20, vat: 10.00, gross: 59.99, reclaimable: true }],
  },
  {
    id: "e-2", date: "2026-05-10", description: "Client lunch — BluePeak",
    category: "Entertaining", hasReceipt: false,
    vatLines: [{ label: "Restaurant bill", net: 68.00, vatRate: 20, vat: 13.60, gross: 81.60, reclaimable: false }],
  },
  {
    id: "e-3", date: "2026-05-08", description: "Hotel — London client meeting",
    category: "Travel", hasReceipt: true,
    vatLines: [
      { label: "Room (1 night)",    net: 160.00, vatRate: 20, vat: 32.00, gross: 192.00, reclaimable: true },
      { label: "Breakfast",         net:  12.00, vatRate: 20, vat:  2.40, gross:  14.40, reclaimable: true },
      { label: "Parking (on-site)", net:  18.00, vatRate: -1, vat:  0.00, gross:  18.00, reclaimable: false },
    ],
  },
  {
    id: "e-4", date: "2026-05-07", description: "Office supplies — Ryman",
    category: "Office", hasReceipt: true,
    vatLines: [{ label: "Stationery and supplies", net: 24.50, vatRate: 20, vat: 4.90, gross: 29.40, reclaimable: true }],
  },
  {
    id: "e-5", date: "2026-04-28", description: "Broadband — BT Business",
    category: "Communications", hasReceipt: true,
    vatLines: [{ label: "Monthly broadband", net: 42.00, vatRate: 20, vat: 8.40, gross: 50.40, reclaimable: true }],
  },
  {
    id: "e-6", date: "2026-04-22", description: "Train — London client visit",
    category: "Travel", hasReceipt: false,
    vatLines: [{ label: "Return rail ticket", net: 87.40, vatRate: 0, vat: 0.00, gross: 87.40, reclaimable: false }],
  },
  {
    id: "e-7", date: "2026-04-18", description: "GitHub Pro",
    category: "Software", hasReceipt: true,
    vatLines: [{ label: "Annual plan (monthly)", net: 3.99, vatRate: 20, vat: 0.80, gross: 4.79, reclaimable: true }],
  },
  {
    id: "e-8", date: "2026-04-15", description: "Printer ink cartridges",
    category: "Office", hasReceipt: false,
    vatLines: [{ label: "Ink cartridges ×4", net: 31.20, vatRate: 20, vat: 6.24, gross: 37.44, reclaimable: true }],
  },
  {
    id: "e-9", date: "2026-04-09", description: "Mobile phone bill",
    category: "Communications", hasReceipt: true,
    vatLines: [{ label: "Monthly contract", net: 35.00, vatRate: 20, vat: 7.00, gross: 42.00, reclaimable: true }],
  },
  {
    id: "e-10", date: "2026-04-05", description: "Professional indemnity ins.",
    category: "Insurance", hasReceipt: true,
    vatLines: [{ label: "Annual premium", net: 220.00, vatRate: -1, vat: 0.00, gross: 220.00, reclaimable: false }],
  },
  {
    id: "e-11", date: "2026-04-02", description: "Canva Pro subscription",
    category: "Software", hasReceipt: false,
    vatLines: [{ label: "Annual plan", net: 9.99, vatRate: 20, vat: 2.00, gross: 11.99, reclaimable: true }],
  },
  {
    id: "e-12", date: "2026-03-28", description: "Google Ads — March",
    category: "Marketing", hasReceipt: true,
    vatLines: [{ label: "Paid search ads", net: 180.00, vatRate: 20, vat: 36.00, gross: 216.00, reclaimable: true }],
  },
  {
    id: "e-13", date: "2026-03-20", description: "Accountant — Q4 filing",
    category: "Professional Services", hasReceipt: true,
    vatLines: [{ label: "Quarterly bookkeeping + filing", net: 350.00, vatRate: 20, vat: 70.00, gross: 420.00, reclaimable: true }],
  },
  {
    id: "e-14", date: "2026-05-01", description: "Electricity — office supply",
    category: "Office", hasReceipt: true,
    // Electricity billed at 5% reduced rate (small business qualifying usage)
    // Standing charge is at the standard 20% rate — a common mixed-rate utility scenario
    vatLines: [
      { label: "Units consumed (reduced rate 5%)", net: 85.00, vatRate: 5,  vat: 4.25,  gross: 89.25,  reclaimable: true },
      { label: "Standing charge (standard rate 20%)", net: 15.00, vatRate: 20, vat: 3.00, gross: 18.00, reclaimable: true },
    ],
  },
  {
    id: "e-15", date: "2026-04-25", description: "Conference catering — team day",
    category: "Marketing", hasReceipt: true,
    // Cold food is zero-rated (no VAT); hot drinks and room hire are standard 20%
    // This illustrates how a single supplier invoice can have 3 different VAT treatments
    vatLines: [
      { label: "Cold sandwiches & buffet (zero-rated)", net: 120.00, vatRate: 0,  vat: 0.00,  gross: 120.00, reclaimable: false },
      { label: "Hot drinks & coffee (standard 20%)",   net:  30.00, vatRate: 20, vat: 6.00,  gross:  36.00, reclaimable: true },
      { label: "Room hire (standard 20%)",             net:  80.00, vatRate: 20, vat: 16.00, gross:  96.00, reclaimable: true },
    ],
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtGBP(n: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", minimumFractionDigits: 2 }).format(n);
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
function r2(n: number) { return Math.round(n * 100) / 100; }

function linesNet(lines: VatLine[])   { return r2(lines.reduce((s, l) => s + l.net,   0)); }
function linesVat(lines: VatLine[])   { return r2(lines.reduce((s, l) => s + l.vat,   0)); }
function linesGross(lines: VatLine[]) { return r2(lines.reduce((s, l) => s + l.gross,  0)); }
function linesReclaimVat(lines: VatLine[]) {
  return r2(lines.filter(l => l.reclaimable).reduce((s, l) => s + l.vat, 0));
}
function isMultiRate(lines: VatLine[]) {
  const rates = new Set(lines.map(l => l.vatRate));
  return lines.length > 1 && rates.size > 1;
}
function vatPctSummary(lines: VatLine[]): string {
  if (lines.length === 0) return "—";
  const rates = [...new Set(lines.map(l => l.vatRate))];
  if (rates.length === 1) return vatRateLabel(rates[0]);
  return "Mixed";
}

// ── Tab type ──────────────────────────────────────────────────────────────────

type Tab = "all" | "claimable" | "vat";

// ── Main component ────────────────────────────────────────────────────────────

export default function DemoExpensesPage() {
  const [activeTab,         setActiveTab]         = useState<Tab>("all");
  const [categoryOverrides, setCategoryOverrides] = useState<Record<string, ExpenseCategory>>({});
  const [notClaimable,      setNotClaimable]      = useState<Set<string>>(new Set());
  const [openHints,         setOpenHints]         = useState<Set<string>>(new Set());
  const [catFilter,         setCatFilter]         = useState<ExpenseCategory | null>(null);
  const [expandedVat,       setExpandedVat]       = useState<Set<string>>(new Set());
  const [receiptOverrides,  setReceiptOverrides]  = useState<Record<string, boolean>>({});
  const [vatOverrides,      setVatOverrides]      = useState<Record<string, VatLine[]>>({});
  // VAT inline edit state: stores { id, lineIdx } while editing
  const [editingVat,        setEditingVat]        = useState<{ id: string; lineIdx: number } | null>(null);
  const [vatDraft,          setVatDraft]          = useState("");

  // Resolve all per-expense effective values
  const expenses = useMemo(() => BASE_EXPENSES.map((e) => {
    const cat        = categoryOverrides[e.id] ?? e.category;
    const meta       = CATEGORY_META[cat];
    const forced0    = notClaimable.has(e.id);
    const pct        = forced0 ? 0 : meta.allowablePct;
    const vatLines   = vatOverrides[e.id] ?? e.vatLines;
    const hasReceipt = receiptOverrides[e.id] ?? e.hasReceipt;

    const net        = linesNet(vatLines);
    const vat        = linesVat(vatLines);
    const gross      = linesGross(vatLines);
    const allowNet   = r2(net * (pct / 100));

    // Reclaimable VAT: only if category allows it, not forced to 0, and receipt is attached
    const maxReclaimVat   = (!meta.vatClaimable || forced0) ? 0 : r2(linesReclaimVat(vatLines) * (pct / 100));
    const confirmedVat    = hasReceipt ? maxReclaimVat : 0;
    const pendingVat      = hasReceipt ? 0 : maxReclaimVat;

    const hasAnyVat    = vat > 0;
    const multiLine    = vatLines.length > 1;
    const mixedRates   = isMultiRate(vatLines);

    return { ...e, cat, meta, pct, vatLines, hasReceipt, net, vat, gross, allowNet,
             maxReclaimVat, confirmedVat, pendingVat, forced0, hasAnyVat, multiLine, mixedRates };
  }), [categoryOverrides, notClaimable, vatOverrides, receiptOverrides]);

  const claimableExpenses = expenses.filter(e => e.pct > 0);
  const vatExpenses       = expenses.filter(e => e.maxReclaimVat > 0);

  // Summary totals
  const totalGross        = r2(expenses.reduce((s, e) => s + e.gross,          0));
  const totalAllowNet     = r2(expenses.reduce((s, e) => s + e.allowNet,       0));
  const totalConfirmedVat = r2(expenses.reduce((s, e) => s + e.confirmedVat,   0));
  const totalPendingVat   = r2(expenses.reduce((s, e) => s + e.pendingVat,     0));
  const totalDisallowed   = r2(expenses.reduce((s, e) => s + (e.net - e.allowNet), 0));
  const taxSaving20       = r2(totalAllowNet * 0.20);

  // Handlers
  function handleCategoryChange(id: string, cat: ExpenseCategory) {
    setCategoryOverrides(p => ({ ...p, [id]: cat }));
    setNotClaimable(p => { const s = new Set(p); s.delete(id); return s; });
  }
  function toggleClaimable(id: string) {
    setNotClaimable(p => { const s = new Set(p); s.has(id) ? s.delete(id) : s.add(id); return s; });
  }
  function toggleHint(id: string) {
    setOpenHints(p => { const s = new Set(p); s.has(id) ? s.delete(id) : s.add(id); return s; });
  }
  function toggleVatExpand(id: string) {
    setExpandedVat(p => { const s = new Set(p); s.has(id) ? s.delete(id) : s.add(id); return s; });
  }
  function toggleReceipt(id: string, current: boolean) {
    setReceiptOverrides(p => ({ ...p, [id]: !current }));
  }

  function startVatEdit(id: string, lineIdx: number, currentVat: number) {
    setEditingVat({ id, lineIdx });
    setVatDraft(String(currentVat));
  }
  function cancelVatEdit() { setEditingVat(null); setVatDraft(""); }
  function saveVatEdit(id: string, lineIdx: number) {
    const raw = parseFloat(vatDraft);
    if (!isNaN(raw) && raw >= 0) {
      setVatOverrides(p => {
        const baseLines = p[id] ?? (BASE_EXPENSES.find(e => e.id === id)!.vatLines);
        const newLines  = baseLines.map((l, i) => {
          if (i !== lineIdx) return l;
          const newVat   = r2(raw);
          const newGross = r2(l.net + newVat);
          const newRate  = l.net > 0 ? r2((raw / l.net) * 100) : l.vatRate;
          return { ...l, vat: newVat, gross: newGross, vatRate: newRate };
        });
        return { ...p, [id]: newLines };
      });
    }
    setEditingVat(null);
    setVatDraft("");
  }

  // Category bar chart
  const catTotals = useMemo(() => {
    const m: Record<string, number> = {};
    expenses.forEach(e => { m[e.cat] = (m[e.cat] ?? 0) + e.net; });
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [expenses]);
  const maxCatTotal = catTotals[0]?.[1] ?? 1;

  // Filtered & grouped list
  const baseList = activeTab === "claimable" ? claimableExpenses
                 : activeTab === "vat"       ? vatExpenses
                 : expenses;
  const filtered = catFilter ? baseList.filter(e => e.cat === catFilter) : baseList;
  const grouped  = useMemo(() => {
    const g: Record<string, typeof filtered> = {};
    filtered.forEach(e => { if (!g[e.cat]) g[e.cat] = []; g[e.cat].push(e); });
    return g;
  }, [filtered]);

  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <p className="zn-section-label">Demo · Books</p>
        <h1 className="text-[28px] font-semibold tracking-[-0.02em] leading-[1.1] mt-1" style={{ color: "var(--zn-ink)" }}>
          Expenses
        </h1>
        <p className="mt-1 text-[13.5px]" style={{ color: "var(--zn-ink-3)" }}>
          Track allowable business expenses. Edit VAT amounts inline, attach invoices to confirm reclaim, and change categories — totals update instantly.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard label="Total gross"     value={fmtGBP(totalGross)} />
        <StatCard label="Claimable net"   value={fmtGBP(totalAllowNet)} accent="var(--zn-safe)" />
        <StatCard label="Est. tax saving" value={fmtGBP(taxSaving20)}  accent="var(--zn-safe)" sub="@ 20% basic rate" />
        <StatCard
          label="VAT reclaimable"
          value={fmtGBP(totalConfirmedVat)}
          accent="var(--zn-accent)"
          sub={totalPendingVat > 0 ? `+${fmtGBP(totalPendingVat)} needs invoice` : "All invoiced"}
        />
        <StatCard label="Not allowable"   value={fmtGBP(totalDisallowed)} accent="var(--zn-risk)" sub="e.g. entertaining" />
      </div>

      {/* Category bar chart */}
      <div className="zn-card px-5 py-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.07em] mb-3" style={{ color: "var(--zn-ink-3)" }}>
          Spend by category — click to filter
        </p>
        <div className="space-y-2.5">
          {catTotals.map(([cat, amt]) => {
            const meta   = CATEGORY_META[cat as ExpenseCategory];
            const active = catFilter === cat;
            return (
              <button key={cat} type="button"
                onClick={() => setCatFilter(active ? null : cat as ExpenseCategory)}
                className="w-full flex items-center gap-3 rounded-lg py-0.5"
              >
                <span className="w-[130px] text-left text-[11.5px] font-medium shrink-0 truncate"
                  style={{ color: active ? meta.color : "var(--zn-ink-3)" }}>
                  {cat}
                </span>
                <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "var(--zn-surface-2)" }}>
                  <div className="h-full rounded-full transition-all duration-300" style={{
                    width: `${Math.round((amt / maxCatTotal) * 100)}%`,
                    background: active ? meta.color : meta.bg,
                    outline: `1.5px solid ${meta.color}`,
                  }} />
                </div>
                <span className="w-20 text-right text-[12px] font-semibold tabular-nums shrink-0"
                  style={{ color: active ? meta.color : "var(--zn-ink-2)" }}>
                  {fmtGBP(amt)}
                </span>
              </button>
            );
          })}
        </div>
        {catFilter && (
          <button type="button" onClick={() => setCatFilter(null)}
            className="mt-3 text-[11px] underline underline-offset-2 hover:no-underline"
            style={{ color: "var(--zn-ink-3)" }}>
            Clear filter ×
          </button>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 p-1 rounded-[12px]" style={{ background: "var(--zn-surface-2)" }}>
        {([
          ["all",       "All expenses",    expenses.length],
          ["claimable", "Claimable",       claimableExpenses.length],
          ["vat",       "VAT reclaimable", vatExpenses.length],
        ] as [Tab, string, number][]).map(([id, label, count]) => (
          <button key={id} type="button" onClick={() => setActiveTab(id)}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-[9px] py-2 text-[12.5px] font-medium transition-all"
            style={{
              background: activeTab === id ? "var(--zn-surface)" : "transparent",
              color:      activeTab === id ? "var(--zn-ink)"     : "var(--zn-ink-3)",
              boxShadow:  activeTab === id ? "var(--zn-shadow-soft)" : "none",
            }}>
            {label}
            <span className="text-[10px] rounded-full px-1.5 py-0.5 font-semibold tabular-nums"
              style={{
                background: activeTab === id ? "var(--zn-surface-2)" : "transparent",
                color:      activeTab === id ? "var(--zn-ink-2)"     : "var(--zn-ink-3)",
              }}>
              {count}
            </span>
          </button>
        ))}
      </div>

      {/* Tab summary strips */}
      {activeTab === "claimable" && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 rounded-[12px] text-[12.5px]"
          style={{ background: "var(--zn-safe-soft)", color: "var(--zn-safe)" }}>
          <span className="font-semibold">{fmtGBP(totalAllowNet)} claimable net</span>
          <span style={{ color: "var(--zn-ink-3)" }}>·</span>
          <span>Est. <strong>{fmtGBP(taxSaving20)}</strong> off your bill at 20%</span>
          <span style={{ color: "var(--zn-ink-3)" }} className="hidden sm:inline">·</span>
          <span className="hidden sm:inline" style={{ color: "var(--zn-ink-3)" }}>
            40% taxpayer? Est. {fmtGBP(r2(totalAllowNet * 0.4))} saving
          </span>
        </div>
      )}
      {activeTab === "vat" && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 rounded-[12px] text-[12.5px]"
          style={{ background: "var(--zn-accent-soft)", color: "var(--zn-accent)" }}>
          <span className="font-semibold">{fmtGBP(totalConfirmedVat)} confirmed</span>
          {totalPendingVat > 0 && (
            <>
              <span style={{ color: "var(--zn-ink-3)" }}>·</span>
              <span style={{ color: "var(--zn-warn)" }}>
                {fmtGBP(totalPendingVat)} needs an invoice attached to claim
              </span>
            </>
          )}
          <span style={{ color: "var(--zn-ink-3)" }} className="hidden sm:inline">·</span>
          <span className="hidden sm:inline" style={{ color: "var(--zn-ink-3)" }}>
            Only applicable if your business is VAT-registered.
          </span>
        </div>
      )}

      {/* Expense list */}
      {Object.keys(grouped).length === 0 ? (
        <div className="zn-card px-5 py-12 text-center text-[13.5px]" style={{ color: "var(--zn-ink-3)" }}>
          No expenses in this view.
          {catFilter && (
            <button type="button" onClick={() => setCatFilter(null)} className="ml-2 underline underline-offset-2">
              Clear filter
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([cat, rows]) => {
            const meta       = CATEGORY_META[cat as ExpenseCategory];
            const groupNet   = r2(rows.reduce((s, e) => s + e.net,           0));
            const groupAllow = r2(rows.reduce((s, e) => s + e.allowNet,      0));
            const groupConf  = r2(rows.reduce((s, e) => s + e.confirmedVat,  0));
            const groupPend  = r2(rows.reduce((s, e) => s + e.pendingVat,    0));

            return (
              <div key={cat} className="zn-card overflow-hidden">
                {/* Group header */}
                <div className="flex items-center justify-between gap-3 px-5 py-2.5 border-b"
                  style={{ borderColor: "var(--zn-line-soft)", background: "var(--zn-surface-2)" }}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11.5px] font-semibold px-2.5 py-0.5 rounded-full"
                      style={{ background: meta.bg, color: meta.color }}>
                      {cat}
                    </span>
                    {meta.allowablePct < 100 && (
                      <span className="text-[10.5px] font-medium px-2 py-0.5 rounded-full"
                        style={{
                          background: meta.allowablePct === 0 ? "var(--zn-risk-soft)" : "var(--zn-warn-soft)",
                          color:      meta.allowablePct === 0 ? "var(--zn-risk)"      : "var(--zn-warn)",
                        }}>
                        {meta.allowablePct === 0 ? "Not allowable" : `${meta.allowablePct}% allowable`}
                      </span>
                    )}
                    <span className="text-[10.5px]" style={{ color: "var(--zn-ink-3)" }}>
                      {rows.length} item{rows.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 shrink-0 text-right">
                    {activeTab === "vat" ? (
                      <div>
                        <span className="text-[12.5px] font-semibold tabular-nums" style={{ color: "var(--zn-accent)" }}>
                          {fmtGBP(groupConf)}
                        </span>
                        {groupPend > 0 && (
                          <p className="text-[10px] tabular-nums" style={{ color: "var(--zn-warn)" }}>
                            +{fmtGBP(groupPend)} pending
                          </p>
                        )}
                      </div>
                    ) : (
                      <>
                        {groupAllow < groupNet && (
                          <span className="text-[11.5px] tabular-nums hidden sm:block" style={{ color: "var(--zn-ink-3)" }}>
                            {fmtGBP(groupAllow)} claimable
                          </span>
                        )}
                        <span className="text-[12.5px] font-semibold tabular-nums" style={{ color: "var(--zn-ink)" }}>
                          {fmtGBP(groupNet)} net
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Column headers */}
                <div className="hidden sm:grid px-5 py-2 border-b text-[10.5px] font-semibold uppercase tracking-[0.06em]"
                  style={{ gridTemplateColumns: "20px 72px 1fr 150px 120px 56px 160px auto", gap: "12px",
                           borderColor: "var(--zn-line-soft)", color: "var(--zn-ink-3)" }}>
                  <span />
                  <span>Date</span>
                  <span>Description</span>
                  <span>Category</span>
                  <span>Allowability</span>
                  <span className="text-center">VAT %</span>
                  <span className="text-right">Amount</span>
                  <span className="text-right">Claimable</span>
                </div>

                {/* Rows */}
                <div className="divide-y" style={{ borderColor: "var(--zn-line-soft)" }}>
                  {rows.map(e => (
                    <ExpenseRow
                      key={e.id}
                      expense={e}
                      activeTab={activeTab}
                      hintOpen={openHints.has(e.id)}
                      vatExpanded={expandedVat.has(e.id)}
                      editingVat={editingVat}
                      vatDraft={vatDraft}
                      onToggleHint={() => toggleHint(e.id)}
                      onToggleVatExpand={() => toggleVatExpand(e.id)}
                      onCategoryChange={c => handleCategoryChange(e.id, c)}
                      onToggleClaimable={() => toggleClaimable(e.id)}
                      onToggleReceipt={() => toggleReceipt(e.id, e.hasReceipt)}
                      onStartVatEdit={(li, v) => startVatEdit(e.id, li, v)}
                      onSaveVatEdit={li => saveVatEdit(e.id, li)}
                      onCancelVatEdit={cancelVatEdit}
                      onVatDraftChange={setVatDraft}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer */}
      <p className="text-[11.5px] pb-2" style={{ color: "var(--zn-ink-3)" }}>
        Sample data only. Allowability follows HMRC guidelines for UK sole traders.
        VAT reclaim requires a valid VAT invoice — attach one per expense to confirm.
        Always verify with your accountant.
      </p>
    </div>
  );
}

// ── VatCell ───────────────────────────────────────────────────────────────────

function VatCell({
  lineIdx, line, isEditing, vatDraft, pendingVat,
  onStartEdit, onSaveEdit, onCancelEdit, onDraftChange,
}: {
  lineIdx:       number;
  line:          VatLine;
  isEditing:     boolean;
  vatDraft:      string;
  pendingVat:    number;
  onStartEdit:   (li: number, v: number) => void;
  onSaveEdit:    (li: number) => void;
  onCancelEdit:  () => void;
  onDraftChange: (v: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (isEditing) inputRef.current?.focus(); }, [isEditing]);

  const draftNum  = parseFloat(vatDraft);
  const liveRate  = isEditing && !isNaN(draftNum) && line.net > 0
    ? r2((draftNum / line.net) * 100)
    : null;

  if (isEditing) {
    return (
      <span className="inline-flex items-center gap-1 flex-wrap">
        <span className="text-[10.5px]" style={{ color: "var(--zn-ink-3)" }}>£</span>
        <input
          ref={inputRef}
          type="number" min="0" step="0.01"
          value={vatDraft}
          onChange={e => onDraftChange(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter")  onSaveEdit(lineIdx);
            if (e.key === "Escape") onCancelEdit();
          }}
          className="w-16 text-[12px] tabular-nums rounded-md px-1.5 py-0.5 border"
          style={{ color: "var(--zn-accent)", borderColor: "var(--zn-accent)", background: "var(--zn-accent-soft)", outline: "none" }}
        />
        {liveRate !== null && (
          <span className="text-[10px] tabular-nums" style={{ color: "var(--zn-ink-3)" }}>
            → {vatRateLabel(liveRate)}
          </span>
        )}
        <button type="button" onClick={() => onSaveEdit(lineIdx)}
          className="rounded-full p-0.5" title="Save">
          <Check className="size-3" style={{ color: "var(--zn-safe)" }} />
        </button>
        <button type="button" onClick={onCancelEdit}
          className="rounded-full p-0.5" title="Cancel">
          <X className="size-3" style={{ color: "var(--zn-risk)" }} />
        </button>
      </span>
    );
  }

  if (line.vat === 0) {
    return (
      <span className="text-[11px] tabular-nums" style={{ color: "var(--zn-ink-3)" }}>
        {vatRateLabel(line.vatRate)} — no VAT
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onStartEdit(lineIdx, line.vat)}
      className="group inline-flex items-center gap-1 hover:opacity-80 transition-opacity"
      title="Click to edit VAT amount"
    >
      <span
        className="text-[12px] font-semibold tabular-nums"
        style={{ color: pendingVat > 0 ? "var(--zn-warn)" : "var(--zn-accent)" }}
      >
        +{fmtGBP(line.vat)} VAT
      </span>
      <span className="text-[10px] tabular-nums" style={{ color: "var(--zn-ink-3)" }}>
        · {vatRateLabel(line.vatRate)}
      </span>
      <Pencil
        className="size-2.5 opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ color: "var(--zn-ink-3)" }}
      />
    </button>
  );
}

// ── Expense row ───────────────────────────────────────────────────────────────

type ResolvedExpense = DemoExpense & {
  cat: ExpenseCategory; meta: CategoryMeta; pct: number;
  vatLines: VatLine[]; hasReceipt: boolean;
  net: number; vat: number; gross: number; allowNet: number;
  maxReclaimVat: number; confirmedVat: number; pendingVat: number;
  forced0: boolean; hasAnyVat: boolean; multiLine: boolean; mixedRates: boolean;
};

function ExpenseRow({
  expense, activeTab, hintOpen, vatExpanded, editingVat, vatDraft,
  onToggleHint, onToggleVatExpand, onCategoryChange, onToggleClaimable,
  onToggleReceipt, onStartVatEdit, onSaveVatEdit, onCancelVatEdit, onVatDraftChange,
}: {
  expense:           ResolvedExpense;
  activeTab:         Tab;
  hintOpen:          boolean;
  vatExpanded:       boolean;
  editingVat:        { id: string; lineIdx: number } | null;
  vatDraft:          string;
  onToggleHint:      () => void;
  onToggleVatExpand: () => void;
  onCategoryChange:  (c: ExpenseCategory) => void;
  onToggleClaimable: () => void;
  onToggleReceipt:   () => void;
  onStartVatEdit:    (lineIdx: number, currentVat: number) => void;
  onSaveVatEdit:     (lineIdx: number) => void;
  onCancelVatEdit:   () => void;
  onVatDraftChange:  (v: string) => void;
}) {
  const {
    id, date, description, cat, meta, pct, vatLines, hasReceipt,
    net, vat, gross, allowNet, confirmedVat, pendingVat, forced0,
    hasAnyVat, multiLine, mixedRates,
  } = expense;

  const isNotClaimable = pct === 0;
  const isPartial      = pct > 0 && pct < 100;
  const badgeColor     = isNotClaimable ? "var(--zn-risk)" : isPartial ? "var(--zn-warn)" : "var(--zn-safe)";
  const badgeBg        = isNotClaimable ? "var(--zn-risk-soft)" : isPartial ? "var(--zn-warn-soft)" : "var(--zn-safe-soft)";
  const badgeLabel     = isNotClaimable ? "Not allowable" : isPartial ? `${pct}% allowable` : "Allowable";

  return (
    <div>
      {/* ── Desktop row ── */}
      <div
        className="hidden sm:grid items-start gap-3 px-5 py-3.5 transition-opacity"
        style={{
          gridTemplateColumns: "20px 72px 1fr 150px 120px 56px 160px auto",
          opacity: isNotClaimable && activeTab === "claimable" ? 0.45 : 1,
        }}
      >
        {/* Receipt indicator */}
        <div className="flex items-center pt-0.5">
          <button
            type="button"
            onClick={onToggleReceipt}
            title={hasReceipt ? "Invoice attached — click to remove" : "No invoice — click to mark as attached"}
            className="rounded-full transition-opacity hover:opacity-70"
          >
            {hasReceipt ? (
              <Paperclip className="size-3.5" style={{ color: "var(--zn-safe)" }} />
            ) : (
              <AlertTriangle className="size-3.5" style={{ color: "var(--zn-warn)" }} />
            )}
          </button>
        </div>

        {/* Date */}
        <span className="text-[11.5px] tabular-nums pt-0.5" style={{ color: "var(--zn-ink-3)" }}>
          {fmtDate(date)}
        </span>

        {/* Description + VAT detail */}
        <div className="min-w-0">
          <p
            className={`text-[13px] font-medium${isNotClaimable ? " line-through" : ""}`}
            style={{ color: isNotClaimable ? "var(--zn-ink-3)" : "var(--zn-ink)" }}
          >
            {description}
          </p>
          {/* VAT line(s) under description */}
          {hasAnyVat && !multiLine && (
            <div className="mt-0.5">
              <VatCell
                lineIdx={0} line={vatLines[0]}
                isEditing={editingVat?.id === id && editingVat?.lineIdx === 0}
                vatDraft={vatDraft} pendingVat={pendingVat}
                onStartEdit={onStartVatEdit} onSaveEdit={onSaveVatEdit}
                onCancelEdit={onCancelVatEdit} onDraftChange={onVatDraftChange}
              />
            </div>
          )}
          {multiLine && (
            <button
              type="button"
              onClick={onToggleVatExpand}
              className="mt-0.5 inline-flex items-center gap-1 text-[11px] transition-opacity hover:opacity-70"
              style={{ color: mixedRates ? "var(--zn-warn)" : "var(--zn-accent)" }}
            >
              {vatExpanded ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
              {mixedRates ? "Mixed VAT rates" : "Multiple lines"} · {vatLines.length} items
              · {fmtGBP(vat)} total VAT
            </button>
          )}
          {/* Pending receipt warning */}
          {!hasReceipt && hasAnyVat && meta.vatClaimable && !forced0 && (
            <p className="mt-0.5 text-[10.5px]" style={{ color: "var(--zn-warn)" }}>
              ⚠ Attach invoice to confirm {fmtGBP(pendingVat)} VAT reclaim
            </p>
          )}
        </div>

        {/* Category */}
        <div>
          <CategorySelect cat={cat} onChange={onCategoryChange} />
        </div>

        {/* Allowability */}
        <AllowBadge
          label={badgeLabel} color={badgeColor} bg={badgeBg}
          hintOpen={hintOpen} onToggleHint={onToggleHint}
        />

        {/* VAT % */}
        <div className="text-center pt-0.5">
          <span
            className="text-[11px] font-semibold tabular-nums"
            style={{ color: mixedRates ? "var(--zn-warn)" : vat > 0 ? "var(--zn-accent)" : "var(--zn-ink-3)" }}
            title={mixedRates ? "Multiple VAT rates — expand to see breakdown" : undefined}
          >
            {vatPctSummary(vatLines)}
          </span>
        </div>

        {/* Amount */}
        <div className="text-right">
          {activeTab === "vat" ? (
            <>
              <p className="text-[13px] font-semibold tabular-nums" style={{ color: confirmedVat > 0 ? "var(--zn-accent)" : "var(--zn-warn)" }}>
                {confirmedVat > 0 ? fmtGBP(confirmedVat) : `${fmtGBP(pendingVat)} pending`}
              </p>
              <p className="text-[10.5px] tabular-nums" style={{ color: "var(--zn-ink-3)" }}>
                of {fmtGBP(vat)} total VAT
              </p>
            </>
          ) : activeTab === "claimable" ? (
            <>
              <p className="text-[13px] font-semibold tabular-nums"
                style={{ color: isNotClaimable ? "var(--zn-risk)" : "var(--zn-safe)" }}>
                {fmtGBP(allowNet)}
              </p>
              <p className="text-[10.5px] tabular-nums" style={{ color: "var(--zn-ink-3)" }}>
                {fmtGBP(gross)} gross
              </p>
            </>
          ) : (
            <>
              <p className="text-[13px] font-semibold tabular-nums" style={{ color: "var(--zn-ink)" }}>
                {fmtGBP(gross)}
              </p>
              <p className="text-[10.5px] tabular-nums" style={{ color: "var(--zn-ink-3)" }}>
                {fmtGBP(net)} net
              </p>
            </>
          )}
        </div>

        {/* Claimable toggle */}
        <div className="flex justify-end pt-0.5">
          <ClaimableToggle
            on={!forced0 && meta.allowablePct > 0}
            categoryIsZero={meta.allowablePct === 0 && !forced0}
            onToggle={onToggleClaimable}
          />
        </div>
      </div>

      {/* ── VAT breakdown (multi-line expanded) ── */}
      {multiLine && vatExpanded && (
        <div className="hidden sm:block mx-5 mb-3 rounded-[10px] overflow-hidden border"
          style={{ borderColor: "var(--zn-line-soft)" }}>
          <div className="grid text-[10.5px] font-semibold uppercase tracking-[0.06em] px-4 py-2 border-b"
            style={{ gridTemplateColumns: "1fr 80px 60px 90px 90px 80px",
                     background: "var(--zn-surface-2)", borderColor: "var(--zn-line-soft)", color: "var(--zn-ink-3)" }}>
            <span>Description</span>
            <span className="text-right">Net</span>
            <span className="text-center">VAT rate</span>
            <span className="text-right">VAT amount</span>
            <span className="text-right">Gross</span>
            <span className="text-center">Reclaimable</span>
          </div>
          {vatLines.map((line, i) => (
            <div key={i}
              className="grid items-center px-4 py-2.5 border-b last:border-0 text-[12.5px]"
              style={{ gridTemplateColumns: "1fr 80px 60px 90px 90px 80px",
                       borderColor: "var(--zn-line-soft)" }}>
              <span style={{ color: "var(--zn-ink-2)" }}>{line.label}</span>
              <span className="text-right tabular-nums" style={{ color: "var(--zn-ink-3)" }}>
                {fmtGBP(line.net)}
              </span>
              <span className="text-center tabular-nums text-[11px]" style={{ color: "var(--zn-ink-3)" }}>
                {vatRateLabel(line.vatRate)}
              </span>
              <span className="text-right">
                <VatCell
                  lineIdx={i} line={line}
                  isEditing={editingVat?.id === id && editingVat?.lineIdx === i}
                  vatDraft={vatDraft} pendingVat={pendingVat}
                  onStartEdit={onStartVatEdit} onSaveEdit={onSaveVatEdit}
                  onCancelEdit={onCancelVatEdit} onDraftChange={onVatDraftChange}
                />
              </span>
              <span className="text-right tabular-nums font-semibold" style={{ color: "var(--zn-ink)" }}>
                {fmtGBP(line.gross)}
              </span>
              <span className="flex justify-center">
                {line.reclaimable && line.vat > 0 ? (
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                    style={{ background: "var(--zn-safe-soft)", color: "var(--zn-safe)" }}>✓</span>
                ) : (
                  <span className="text-[10px]" style={{ color: "var(--zn-ink-3)" }}>—</span>
                )}
              </span>
            </div>
          ))}
          {/* Total row */}
          <div className="grid items-center px-4 py-2.5 text-[12.5px] font-semibold"
            style={{ gridTemplateColumns: "1fr 80px 60px 90px 90px 80px",
                     background: "var(--zn-surface-2)" }}>
            <span style={{ color: "var(--zn-ink-3)" }}>Total</span>
            <span className="text-right tabular-nums" style={{ color: "var(--zn-ink)" }}>{fmtGBP(net)}</span>
            <span />
            <span className="text-right tabular-nums" style={{ color: "var(--zn-accent)" }}>+{fmtGBP(vat)}</span>
            <span className="text-right tabular-nums" style={{ color: "var(--zn-ink)" }}>{fmtGBP(gross)}</span>
            <span />
          </div>
        </div>
      )}
      {multiLine && vatExpanded && mixedRates && (
        <p className="mx-5 mb-3 text-[11px] leading-relaxed" style={{ color: "var(--zn-warn)" }}>
          ⚠ Mixed VAT rates on this invoice — each line must be recorded at its own rate on your VAT return. Click any VAT amount to adjust it.
        </p>
      )}

      {/* HMRC hint */}
      {hintOpen && (
        <div className="mx-5 mb-3 px-3.5 py-2.5 rounded-[10px] text-[11.5px] leading-relaxed"
          style={{ background: "var(--zn-warn-soft)", color: "var(--zn-warn)" }}>
          <strong>HMRC note · {cat}:</strong> {meta.hint}
        </div>
      )}

      {/* ── Mobile card ── */}
      <div className="sm:hidden px-4 py-3.5 space-y-2 transition-opacity"
        style={{ opacity: isNotClaimable && activeTab === "claimable" ? 0.45 : 1 }}>
        {/* Row 1: description + gross */}
        <div className="flex items-start justify-between gap-3">
          <p className={`text-[13px] font-medium leading-snug flex-1${isNotClaimable ? " line-through" : ""}`}
            style={{ color: isNotClaimable ? "var(--zn-ink-3)" : "var(--zn-ink)" }}>
            {description}
          </p>
          <div className="text-right shrink-0">
            <p className="text-[13px] font-semibold tabular-nums" style={{ color: "var(--zn-ink)" }}>
              {fmtGBP(gross)}
            </p>
            {hasAnyVat && (
              <p className="text-[10px] tabular-nums" style={{ color: pendingVat > 0 ? "var(--zn-warn)" : "var(--zn-ink-3)" }}>
                +{fmtGBP(vat)} VAT
              </p>
            )}
          </div>
        </div>
        {/* Row 2: date · receipt · category · allowability */}
        <div className="flex items-center gap-2 flex-wrap">
          <button type="button" onClick={onToggleReceipt}
            className="inline-flex items-center gap-1 text-[10.5px] font-medium rounded-full px-2 py-0.5"
            style={{
              background: hasReceipt ? "var(--zn-safe-soft)" : "var(--zn-warn-soft)",
              color:      hasReceipt ? "var(--zn-safe)"      : "var(--zn-warn)",
            }}>
            {hasReceipt ? <Paperclip className="size-2.5" /> : <AlertTriangle className="size-2.5" />}
            {hasReceipt ? "Invoice attached" : "No invoice"}
          </button>
          <span className="text-[10.5px]" style={{ color: "var(--zn-ink-3)" }}>{fmtDate(date)}</span>
          <CategorySelect cat={cat} onChange={onCategoryChange} />
          <AllowBadge label={badgeLabel} color={badgeColor} bg={badgeBg}
            hintOpen={hintOpen} onToggleHint={onToggleHint} />
        </div>
        {/* Row 3: toggle + claimable amount */}
        <div className="flex items-center gap-2">
          <ClaimableToggle
            on={!forced0 && meta.allowablePct > 0}
            categoryIsZero={meta.allowablePct === 0 && !forced0}
            onToggle={onToggleClaimable}
          />
          <span className="text-[11px]" style={{ color: "var(--zn-ink-3)" }}>
            {forced0 ? "Marked not claimable" : meta.allowablePct === 0 ? "Not allowable (HMRC)" : "Claimable"}
          </span>
          {allowNet > 0 && activeTab !== "vat" && (
            <>
              <span style={{ color: "var(--zn-ink-3)" }}>·</span>
              <span className="text-[11px] font-medium" style={{ color: "var(--zn-safe)" }}>
                {fmtGBP(allowNet)} net
              </span>
            </>
          )}
        </div>
        {/* Multi-line expand on mobile */}
        {multiLine && (
          <button type="button" onClick={onToggleVatExpand}
            className="inline-flex items-center gap-1 text-[11px]"
            style={{ color: "var(--zn-accent)" }}>
            {vatExpanded ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
            {vatLines.length} VAT lines · tap to {vatExpanded ? "hide" : "show"} breakdown
          </button>
        )}
        {/* Mobile VAT breakdown */}
        {multiLine && vatExpanded && (
          <div className="rounded-[10px] overflow-hidden border mt-1"
            style={{ borderColor: "var(--zn-line-soft)" }}>
            {vatLines.map((line, i) => (
              <div key={i} className="flex items-center justify-between gap-2 px-3 py-2 border-b last:border-0 text-[11.5px]"
                style={{ borderColor: "var(--zn-line-soft)" }}>
                <div className="min-w-0">
                  <p style={{ color: "var(--zn-ink-2)" }}>{line.label}</p>
                  <p style={{ color: "var(--zn-ink-3)" }}>{vatRateLabel(line.vatRate)} · {fmtGBP(line.net)} net</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-semibold" style={{ color: "var(--zn-ink)" }}>{fmtGBP(line.gross)}</p>
                  {line.vat > 0 && (
                    <p style={{ color: line.reclaimable ? "var(--zn-accent)" : "var(--zn-ink-3)" }}>
                      +{fmtGBP(line.vat)} VAT
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function CategorySelect({ cat, onChange }: { cat: ExpenseCategory; onChange: (c: ExpenseCategory) => void }) {
  const meta = CATEGORY_META[cat];
  return (
    <div className="relative inline-flex items-center shrink-0">
      <span className="text-[11px] font-semibold pl-2.5 pr-5 py-0.5 rounded-full pointer-events-none whitespace-nowrap"
        style={{ background: meta.bg, color: meta.color }}>
        {cat}
      </span>
      <ChevronDown className="absolute right-1.5 size-2.5 pointer-events-none" style={{ color: meta.color }} />
      <select value={cat} onChange={e => onChange(e.target.value as ExpenseCategory)}
        className="absolute inset-0 opacity-0 cursor-pointer w-full"
        aria-label="Change expense category" title="Change category">
        {CATEGORY_LIST.map(c => <option key={c} value={c}>{c}</option>)}
      </select>
    </div>
  );
}

function AllowBadge({ label, color, bg, hintOpen, onToggleHint }: {
  label: string; color: string; bg: string; hintOpen: boolean; onToggleHint: () => void;
}) {
  return (
    <div className="inline-flex items-center gap-1 shrink-0">
      <span className="text-[10.5px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap"
        style={{ background: bg, color }}>{label}</span>
      <button type="button" onClick={onToggleHint} title="HMRC guidance for this category"
        className="rounded-full p-0.5 hover:opacity-70 transition-opacity"
        style={{ color: hintOpen ? color : "var(--zn-ink-3)" }}>
        <Info className="size-2.5" />
      </button>
    </div>
  );
}

function ClaimableToggle({ on, categoryIsZero, onToggle }: {
  on: boolean; categoryIsZero: boolean; onToggle: () => void;
}) {
  return (
    <button type="button"
      onClick={categoryIsZero ? undefined : onToggle}
      title={categoryIsZero ? "Change category to override HMRC rule" : on ? "Mark as not claimable" : "Mark as claimable"}
      className="relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors duration-150"
      style={{
        background: on ? "var(--zn-safe)" : "var(--zn-line)",
        opacity:    categoryIsZero ? 0.3 : 1,
        cursor:     categoryIsZero ? "not-allowed" : "pointer",
      }}>
      <span className="inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-150 mt-0.5"
        style={{ transform: on ? "translateX(17px)" : "translateX(2px)" }} />
    </button>
  );
}

function StatCard({ label, value, accent, sub }: {
  label: string; value: string; accent?: string; sub?: string;
}) {
  return (
    <div className="zn-card p-4">
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.07em]" style={{ color: "var(--zn-ink-3)" }}>
        {label}
      </p>
      <p className="mt-2 text-[20px] font-bold tabular-nums leading-none" style={{ color: accent ?? "var(--zn-ink)" }}>
        {value}
      </p>
      {sub && <p className="mt-1 text-[10px]" style={{ color: "var(--zn-ink-3)" }}>{sub}</p>}
    </div>
  );
}
