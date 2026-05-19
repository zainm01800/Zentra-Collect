"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import {
  ChevronDown, ChevronRight, Pencil, Check, X,
  Paperclip, AlertTriangle, Square, CheckSquare, Download,
} from "lucide-react";
import { BASE_EXPENSES as _BASE_EXPENSES } from "@/lib/demo-data/demo-expenses-data";

// ── Category definitions ──────────────────────────────────────────────────────

type ExpenseCategory =
  | "Software" | "Office" | "Travel" | "Communications"
  | "Insurance" | "Entertaining" | "Professional Services"
  | "Marketing" | "Equipment";

interface CategoryMeta {
  color:        string;
  bg:           string;
  dot:          string;
  allowablePct: number;
  vatClaimable: boolean;
  hint:         string;
  hmrcShort:    string;
}

const CATEGORY_META: Record<ExpenseCategory, CategoryMeta> = {
  "Software":              { color: "var(--zn-info)",   bg: "var(--zn-info-soft)",   dot: "#2563EB", allowablePct: 100, vatClaimable: true,  hint: "Business software and subscriptions — fully allowable for Self Assessment.", hmrcShort: "Fully allowable" },
  "Office":                { color: "var(--zn-ink-2)",  bg: "var(--zn-surface-2)",   dot: "#4B5563", allowablePct: 100, vatClaimable: true,  hint: "Office supplies — fully allowable for Self Assessment.", hmrcShort: "Fully allowable" },
  "Travel":                { color: "var(--zn-safe)",   bg: "var(--zn-safe-soft)",   dot: "#0EA5A4", allowablePct: 100, vatClaimable: false, hint: "Business travel is fully allowable. Most public transport is zero-rated — no VAT to reclaim.", hmrcShort: "Fully allowable · business travel" },
  "Communications":        { color: "var(--zn-accent)", bg: "var(--zn-accent-soft)", dot: "#7C3AED", allowablePct: 50,  vatClaimable: true,  hint: "HMRC typically allows 50% for phone/broadband on mixed personal/business use. 50% of VAT is reclaimable.", hmrcShort: "50% mixed-use rule" },
  "Insurance":             { color: "var(--zn-warn)",   bg: "var(--zn-warn-soft)",   dot: "#C28800", allowablePct: 100, vatClaimable: false, hint: "Business insurance is fully allowable. Premiums are VAT-exempt — nothing to reclaim.", hmrcShort: "Fully allowable · VAT exempt" },
  "Entertaining":          { color: "var(--zn-risk)",   bg: "var(--zn-risk-soft)",   dot: "#DC2626", allowablePct: 0,   vatClaimable: false, hint: "HMRC does not allow client entertainment as a tax deduction. VAT on entertaining is also blocked input tax.", hmrcShort: "Not allowable · client entertaining" },
  "Professional Services": { color: "var(--zn-info)",   bg: "var(--zn-info-soft)",   dot: "#0369A1", allowablePct: 100, vatClaimable: true,  hint: "Accountant, legal and professional fees — fully allowable for Self Assessment.", hmrcShort: "Fully allowable" },
  "Marketing":             { color: "var(--zn-ink-2)",  bg: "var(--zn-surface-2)",   dot: "#DB2777", allowablePct: 100, vatClaimable: true,  hint: "Advertising and marketing spend — fully allowable for Self Assessment.", hmrcShort: "Fully allowable" },
  "Equipment":             { color: "var(--zn-safe)",   bg: "var(--zn-safe-soft)",   dot: "#0369A1", allowablePct: 100, vatClaimable: true,  hint: "Business equipment — fully allowable via the Annual Investment Allowance (AIA).", hmrcShort: "Capital allowance · AIA" },
};

const CATEGORY_LIST = Object.keys(CATEGORY_META) as ExpenseCategory[];

// ── Data model ────────────────────────────────────────────────────────────────

interface VatLine {
  label: string; net: number; vatRate: number; vat: number; gross: number; reclaimable: boolean;
}

interface DemoExpense {
  id: string; date: string; description: string;
  category: ExpenseCategory; hasReceipt: boolean; vatLines: VatLine[];
}

const BASE_EXPENSES = _BASE_EXPENSES as unknown as DemoExpense[];

const VAT_PRESETS = [
  { label: "Exempt", rate: -1 },
  { label: "0%",     rate: 0  },
  { label: "5%",     rate: 5  },
  { label: "20%",    rate: 20 },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtGBP(n: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", minimumFractionDigits: 2 }).format(n);
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
function fmtMonth(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}
function vatRateLabel(rate: number) {
  if (rate === -1) return "Exempt";
  if (rate === 0)  return "0%";
  return `${rate}%`;
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

type Tab = "all" | "review" | "missing" | "notallowable";

// ── Resolved expense type ─────────────────────────────────────────────────────

type Resolved = DemoExpense & {
  cat: ExpenseCategory; meta: CategoryMeta; pct: number;
  vatLines: VatLine[]; hasReceipt: boolean;
  net: number; vat: number; gross: number; allowNet: number;
  maxReclaimVat: number; confirmedVat: number; pendingVat: number;
  forced0: boolean; hasAnyVat: boolean; multiLine: boolean; mixedRates: boolean;
  needsReview: boolean;
};

// ── Main component ────────────────────────────────────────────────────────────

export default function DemoExpensesPage() {
  const [activeTab,         setActiveTab]         = useState<Tab>("all");
  const [categoryOverrides, setCategoryOverrides] = useState<Record<string, ExpenseCategory>>({});
  const [notClaimable,      setNotClaimable]      = useState<Set<string>>(new Set());
  const [catFilter,         setCatFilter]         = useState<ExpenseCategory | null>(null);
  const [receiptOverrides,  setReceiptOverrides]  = useState<Record<string, boolean>>({});
  const [vatOverrides,      setVatOverrides]      = useState<Record<string, VatLine[]>>({});
  const [editingVat,        setEditingVat]        = useState<{ id: string; lineIdx: number } | null>(null);
  const [vatDraft,          setVatDraft]          = useState("");
  const [selectedId,        setSelectedId]        = useState<string | null>(BASE_EXPENSES[0]?.id ?? null);
  const [collapsedMonths,   setCollapsedMonths]   = useState<Set<string>>(new Set());
  const [selectedIds,       setSelectedIds]       = useState<Set<string>>(new Set());
  const [mobileExpanded,    setMobileExpanded]    = useState<string | null>(null);

  // Resolve all expenses
  const expenses = useMemo<Resolved[]>(() => BASE_EXPENSES.map((e) => {
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
    const maxReclaimVat = (!meta.vatClaimable || forced0) ? 0 : r2(linesReclaimVat(vatLines) * (pct / 100));
    const confirmedVat  = hasReceipt ? maxReclaimVat : 0;
    const pendingVat    = hasReceipt ? 0 : maxReclaimVat;
    const hasAnyVat     = vatLines.length > 0;
    const multiLine     = vatLines.length > 1;
    const mixedRates    = isMultiRate(vatLines);
    const needsReview   = !hasReceipt && vat > 0 && maxReclaimVat > 0;
    return { ...e, cat, meta, pct, vatLines, hasReceipt, net, vat, gross, allowNet,
             maxReclaimVat, confirmedVat, pendingVat, forced0, hasAnyVat, multiLine, mixedRates, needsReview };
  }), [categoryOverrides, notClaimable, vatOverrides, receiptOverrides]);

  const reviewExpenses      = expenses.filter(e => e.needsReview);
  const missingExpenses     = expenses.filter(e => !e.hasReceipt);
  const notAllowableExpenses = expenses.filter(e => e.pct === 0);

  const totalGross        = r2(expenses.reduce((s, e) => s + e.gross,          0));
  const totalAllowNet     = r2(expenses.reduce((s, e) => s + e.allowNet,       0));
  const totalConfirmedVat = r2(expenses.reduce((s, e) => s + e.confirmedVat,   0));
  const totalPendingVat   = r2(expenses.reduce((s, e) => s + e.pendingVat,     0));
  const totalDisallowed   = r2(expenses.reduce((s, e) => s + (e.net - e.allowNet), 0));
  const taxSaving20       = r2(totalAllowNet * 0.20);

  const baseList = activeTab === "review"       ? reviewExpenses
                 : activeTab === "missing"      ? missingExpenses
                 : activeTab === "notallowable" ? notAllowableExpenses
                 : expenses;
  const filtered = catFilter ? baseList.filter(e => e.cat === catFilter) : baseList;

  // Month groups (newest first)
  const monthGroups = useMemo(() => {
    const map = new Map<string, Resolved[]>();
    filtered.forEach(e => {
      const ym = e.date.slice(0, 7);
      if (!map.has(ym)) map.set(ym, []);
      map.get(ym)!.push(e);
    });
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  // Category totals for filter pills
  const catTotals = useMemo(() => {
    const m: Record<string, number> = {};
    expenses.forEach(e => { m[e.cat] = (m[e.cat] ?? 0) + e.net; });
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [expenses]);

  const selectedExpense = selectedId ? expenses.find(e => e.id === selectedId) ?? null : null;

  // ── Handlers ────────────────────────────────────────────────────────────────

  function handleCategoryChange(id: string, cat: ExpenseCategory) {
    setCategoryOverrides(p => ({ ...p, [id]: cat }));
    setNotClaimable(p => { const s = new Set(p); s.delete(id); return s; });
  }
  function toggleClaimable(id: string) {
    setNotClaimable(p => { const s = new Set(p); s.has(id) ? s.delete(id) : s.add(id); return s; });
  }
  function toggleReceipt(id: string, current: boolean) {
    setReceiptOverrides(p => ({ ...p, [id]: !current }));
  }
  function startVatEdit(id: string, lineIdx: number, currentVat: number) {
    setEditingVat({ id, lineIdx });
    setVatDraft(String(currentVat));
  }
  function cancelVatEdit() { setEditingVat(null); setVatDraft(""); }

  function applyVatPreset(id: string, lineIdx: number, rate: number) {
    setVatOverrides(p => {
      const baseLines = p[id] ?? BASE_EXPENSES.find(e => e.id === id)!.vatLines;
      const newLines  = baseLines.map((l, i) => {
        if (i !== lineIdx) return l;
        const gross  = l.gross;
        const newVat = rate <= 0 ? 0 : r2(gross * rate / (100 + rate));
        const newNet = r2(gross - newVat);
        return { ...l, vatRate: rate, vat: newVat, net: newNet, gross };
      });
      return { ...p, [id]: newLines };
    });
    setEditingVat(null); setVatDraft("");
  }

  function resetVatLine(id: string, lineIdx: number) {
    const originalLine = BASE_EXPENSES.find(e => e.id === id)!.vatLines[lineIdx];
    setVatOverrides(p => {
      const baseLines = p[id] ?? BASE_EXPENSES.find(e => e.id === id)!.vatLines;
      const newLines  = baseLines.map((l, i) => i === lineIdx ? originalLine : l);
      const origLines = BASE_EXPENSES.find(e => e.id === id)!.vatLines;
      const allReset  = newLines.every((l, i) =>
        l.vat === origLines[i].vat && l.vatRate === origLines[i].vatRate
      );
      if (allReset) { const { [id]: _, ...rest } = p; return rest; }
      return { ...p, [id]: newLines };
    });
  }

  function saveVatEdit(id: string, lineIdx: number) {
    const raw = parseFloat(vatDraft);
    if (!isNaN(raw) && raw >= 0) {
      setVatOverrides(p => {
        const baseLines = p[id] ?? BASE_EXPENSES.find(e => e.id === id)!.vatLines;
        const newLines  = baseLines.map((l, i) => {
          if (i !== lineIdx) return l;
          const gross   = l.gross;
          const newVat  = r2(Math.min(raw, gross));
          const newNet  = r2(gross - newVat);
          const newRate = newNet > 0 ? r2((newVat / newNet) * 100) : l.vatRate;
          return { ...l, vat: newVat, net: newNet, gross, vatRate: newRate };
        });
        return { ...p, [id]: newLines };
      });
    }
    setEditingVat(null); setVatDraft("");
  }

  function toggleSelect(id: string) {
    setSelectedIds(p => { const s = new Set(p); s.has(id) ? s.delete(id) : s.add(id); return s; });
  }
  function clearSelection() { setSelectedIds(new Set()); }
  function markReceiptsAttached() {
    const updates: Record<string, boolean> = {};
    selectedIds.forEach(id => {
      const e = expenses.find(x => x.id === id);
      if (e && !e.hasReceipt) updates[id] = true;
    });
    setReceiptOverrides(p => ({ ...p, ...updates }));
    setSelectedIds(new Set());
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="zn-section-label">Demo · Books</p>
          <h1 className="text-[28px] font-semibold tracking-[-0.02em] leading-[1.1] mt-1"
            style={{ color: "var(--zn-ink)" }}>
            Expenses
          </h1>
          <p className="mt-1 text-[13.5px]" style={{ color: "var(--zn-ink-3)" }}>
            Track allowable business expenses. Edit VAT inline, attach invoices, and change categories — totals update instantly.
          </p>
        </div>
        <button
          type="button"
          className="shrink-0 hidden sm:flex items-center gap-2 px-4 py-2.5 rounded-full text-[12.5px] font-semibold transition-opacity hover:opacity-80"
          style={{ background: "var(--zn-ink)", color: "var(--zn-surface)" }}
        >
          + Add expense
        </button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard label="Total gross"      value={fmtGBP(totalGross)} />
        <StatCard label="Claimable net"    value={fmtGBP(totalAllowNet)}  accent="var(--zn-safe)" />
        <StatCard label="Est. tax saving"  value={fmtGBP(taxSaving20)}    accent="var(--zn-safe)" sub="@ 20% basic rate" />
        <StatCard
          label="VAT reclaimable"
          value={fmtGBP(totalConfirmedVat)}
          accent="var(--zn-accent)"
          sub={totalPendingVat > 0 ? `+${fmtGBP(totalPendingVat)} needs invoice` : "All invoiced"}
        />
        <StatCard label="Not allowable"    value={fmtGBP(totalDisallowed)} accent="var(--zn-risk)" sub="e.g. entertaining" />
      </div>

      {/* Category filter pills */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1" style={{ scrollbarWidth: "none" }}>
        <button
          type="button"
          onClick={() => setCatFilter(null)}
          className="shrink-0 px-3 py-1.5 rounded-full text-[12px] font-medium border transition-colors whitespace-nowrap"
          style={{
            background:  catFilter === null ? "var(--zn-ink)" : "transparent",
            color:       catFilter === null ? "var(--zn-surface)" : "var(--zn-ink-2)",
            borderColor: catFilter === null ? "var(--zn-ink)" : "var(--zn-line)",
          }}
        >
          All categories
        </button>
        {catTotals.map(([cat, amt]) => {
          const meta   = CATEGORY_META[cat as ExpenseCategory];
          const active = catFilter === cat;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setCatFilter(active ? null : cat as ExpenseCategory)}
              className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium border transition-colors whitespace-nowrap"
              style={{
                background:  active ? meta.bg : "transparent",
                color:       active ? meta.color : "var(--zn-ink-2)",
                borderColor: active ? meta.color : "var(--zn-line)",
              }}
            >
              <span className="size-1.5 rounded-full shrink-0" style={{ background: meta.dot }} />
              {cat}
              <span className="text-[10px] tabular-nums" style={{ color: active ? meta.color : "var(--zn-ink-3)" }}>
                {fmtGBP(amt)}
              </span>
            </button>
          );
        })}
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 p-1 rounded-[12px]" style={{ background: "var(--zn-surface-2)" }}>
        {([
          ["all",          "All",             expenses.length],
          ["review",       "Needs review",    reviewExpenses.length],
          ["missing",      "No receipt",      missingExpenses.length],
          ["notallowable", "Not allowable",   notAllowableExpenses.length],
        ] as [Tab, string, number][]).map(([id, label, count]) => (
          <button key={id} type="button" onClick={() => setActiveTab(id)}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-[9px] py-2 text-[12px] font-medium transition-all"
            style={{
              background: activeTab === id ? "var(--zn-surface)" : "transparent",
              color:      activeTab === id ? "var(--zn-ink)"     : "var(--zn-ink-3)",
              boxShadow:  activeTab === id ? "var(--zn-shadow-soft)" : "none",
            }}>
            <span className="hidden sm:inline">{label}</span>
            <span className="sm:hidden">{label.split(" ")[0]}</span>
            {count > 0 && (
              <span className="text-[10px] rounded-full px-1.5 py-0.5 font-semibold tabular-nums"
                style={{
                  background: activeTab === id ? "var(--zn-surface-2)" : "transparent",
                  color:
                    id === "review"       ? "var(--zn-warn)"
                    : id === "missing"    ? "var(--zn-warn)"
                    : id === "notallowable" ? "var(--zn-risk)"
                    : activeTab === id    ? "var(--zn-ink-2)"
                    : "var(--zn-ink-3)",
                }}>
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab context strip */}
      {activeTab === "review" && reviewExpenses.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 rounded-[12px] text-[12.5px]"
          style={{ background: "var(--zn-warn-soft)", color: "var(--zn-warn)" }}>
          <AlertTriangle className="size-3.5 shrink-0" />
          <span className="font-semibold">{fmtGBP(totalPendingVat)} VAT at risk</span>
          <span style={{ color: "var(--zn-ink-3)" }}>·</span>
          <span>Attach invoices to confirm reclaim on {reviewExpenses.length} expense{reviewExpenses.length !== 1 ? "s" : ""}</span>
        </div>
      )}
      {activeTab === "notallowable" && notAllowableExpenses.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 rounded-[12px] text-[12.5px]"
          style={{ background: "var(--zn-risk-soft)", color: "var(--zn-risk)" }}>
          <span className="font-semibold">{fmtGBP(totalDisallowed)} disallowed</span>
          <span style={{ color: "var(--zn-ink-3)" }}>·</span>
          <span>These cannot be claimed — HMRC rules block this category</span>
        </div>
      )}

      {/* Two-column layout */}
      <div className="lg:grid lg:grid-cols-[1fr_380px] lg:gap-5 lg:items-start">

        {/* Left: expense list by month */}
        <div className="space-y-3">
          {monthGroups.length === 0 ? (
            <div className="zn-card px-5 py-12 text-center text-[13.5px]" style={{ color: "var(--zn-ink-3)" }}>
              No expenses in this view.
              {catFilter && (
                <button type="button" onClick={() => setCatFilter(null)} className="ml-2 underline underline-offset-2">
                  Clear filter
                </button>
              )}
            </div>
          ) : monthGroups.map(([ym, rows]) => {
            const collapsed    = collapsedMonths.has(ym);
            const monthGross   = r2(rows.reduce((s, e) => s + e.gross,    0));
            const monthAllow   = r2(rows.reduce((s, e) => s + e.allowNet, 0));
            const allSelected  = rows.every(e => selectedIds.has(e.id));
            const someSelected = rows.some(e => selectedIds.has(e.id));
            return (
              <div key={ym} className="zn-card overflow-hidden">
                {/* Month header */}
                <div
                  className="flex items-center gap-3 px-4 py-3 border-b select-none"
                  style={{ borderColor: "var(--zn-line-soft)", background: "var(--zn-surface-2)" }}
                >
                  {/* Select-all checkbox */}
                  <button
                    type="button"
                    onClick={() => {
                      if (allSelected) {
                        setSelectedIds(p => { const s = new Set(p); rows.forEach(e => s.delete(e.id)); return s; });
                      } else {
                        setSelectedIds(p => { const s = new Set(p); rows.forEach(e => s.add(e.id)); return s; });
                      }
                    }}
                    className="shrink-0 hover:opacity-70 transition-opacity"
                    title={allSelected ? "Deselect all in month" : "Select all in month"}
                  >
                    {allSelected ? (
                      <CheckSquare className="size-4" style={{ color: "var(--zn-accent)" }} />
                    ) : someSelected ? (
                      <CheckSquare className="size-4" style={{ color: "var(--zn-ink-3)", opacity: 0.5 }} />
                    ) : (
                      <Square className="size-4" style={{ color: "var(--zn-ink-3)" }} />
                    )}
                  </button>

                  {/* Collapse toggle */}
                  <button
                    type="button"
                    className="flex-1 flex items-center gap-2 text-left"
                    onClick={() => setCollapsedMonths(p => {
                      const s = new Set(p); s.has(ym) ? s.delete(ym) : s.add(ym); return s;
                    })}
                  >
                    <span className="text-[13px] font-semibold" style={{ color: "var(--zn-ink)" }}>
                      {fmtMonth(ym)}
                    </span>
                    <span className="text-[11px]" style={{ color: "var(--zn-ink-3)" }}>
                      {rows.length} item{rows.length !== 1 ? "s" : ""}
                    </span>
                  </button>

                  {/* Month totals */}
                  <div className="text-right shrink-0">
                    <p className="text-[12.5px] font-semibold tabular-nums" style={{ color: "var(--zn-ink)" }}>
                      {fmtGBP(monthGross)}
                    </p>
                    {monthAllow < monthGross && (
                      <p className="text-[10px] tabular-nums" style={{ color: "var(--zn-safe)" }}>
                        {fmtGBP(monthAllow)} claimable
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => setCollapsedMonths(p => {
                      const s = new Set(p); s.has(ym) ? s.delete(ym) : s.add(ym); return s;
                    })}
                    className="shrink-0"
                  >
                    {collapsed
                      ? <ChevronRight className="size-4" style={{ color: "var(--zn-ink-3)" }} />
                      : <ChevronDown  className="size-4" style={{ color: "var(--zn-ink-3)" }} />
                    }
                  </button>
                </div>

                {/* Rows */}
                {!collapsed && (
                  <div className="divide-y" style={{ borderColor: "var(--zn-line-soft)" }}>
                    {rows.map(e => (
                      <ExpenseListRow
                        key={e.id}
                        expense={e}
                        isChecked={selectedIds.has(e.id)}
                        isActive={selectedId === e.id}
                        isMobileExpanded={mobileExpanded === e.id}
                        editingVat={editingVat}
                        vatDraft={vatDraft}
                        onRowClick={() => {
                          setSelectedId(e.id);
                          setMobileExpanded(p => p === e.id ? null : e.id);
                        }}
                        onToggleCheck={() => toggleSelect(e.id)}
                        onCategoryChange={c => handleCategoryChange(e.id, c)}
                        onToggleClaimable={() => toggleClaimable(e.id)}
                        onToggleReceipt={() => toggleReceipt(e.id, e.hasReceipt)}
                        onStartVatEdit={(li, v) => startVatEdit(e.id, li, v)}
                        onSaveVatEdit={li => saveVatEdit(e.id, li)}
                        onCancelVatEdit={cancelVatEdit}
                        onVatDraftChange={setVatDraft}
                        onApplyVatPreset={(li, rate) => applyVatPreset(e.id, li, rate)}
                        onResetVatLine={li => resetVatLine(e.id, li)}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          <p className="text-[11.5px] pb-2" style={{ color: "var(--zn-ink-3)" }}>
            Sample data only. Allowability follows HMRC guidelines for UK sole traders.
            VAT reclaim requires a valid VAT invoice. Always verify with your accountant.
          </p>
        </div>

        {/* Right: detail panel */}
        <div className="hidden lg:block lg:sticky lg:top-6">
          {selectedExpense ? (
            <ExpenseDetailPanel
              expense={selectedExpense}
              editingVat={editingVat}
              vatDraft={vatDraft}
              onCategoryChange={c => handleCategoryChange(selectedExpense.id, c)}
              onToggleClaimable={() => toggleClaimable(selectedExpense.id)}
              onToggleReceipt={() => toggleReceipt(selectedExpense.id, selectedExpense.hasReceipt)}
              onStartVatEdit={(li, v) => startVatEdit(selectedExpense.id, li, v)}
              onSaveVatEdit={li => saveVatEdit(selectedExpense.id, li)}
              onCancelVatEdit={cancelVatEdit}
              onVatDraftChange={setVatDraft}
              onApplyVatPreset={(li, rate) => applyVatPreset(selectedExpense.id, li, rate)}
              onResetVatLine={li => resetVatLine(selectedExpense.id, li)}
            />
          ) : (
            <div className="zn-card px-5 py-12 text-center" style={{ color: "var(--zn-ink-3)" }}>
              <p className="text-[13px]">Select an expense to see details, edit VAT, and adjust allowability.</p>
            </div>
          )}
        </div>
      </div>

      {/* Multi-select action bar */}
      {selectedIds.size > 0 && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-xl px-5 py-3 shadow-xl"
          style={{
            background: "var(--zn-ink)", color: "var(--zn-surface)",
            whiteSpace: "nowrap",
            animation: "bulkRise 0.18s ease-out both",
          }}
        >
          <style>{`@keyframes bulkRise{from{transform:translate(-50%,16px);opacity:0}to{transform:translate(-50%,0);opacity:1}}`}</style>
          <span className="text-[13px] font-semibold">
            {selectedIds.size} selected
            <span className="font-normal ml-1.5 text-white/50">·</span>
            <span className="font-normal ml-1.5">
              {fmtGBP(r2([...selectedIds].reduce((s, id) => s + (expenses.find(e => e.id === id)?.gross ?? 0), 0)))}
            </span>
          </span>
          <div className="w-px h-4 bg-white/20" />
          <button
            type="button"
            onClick={markReceiptsAttached}
            className="text-[12px] font-medium px-3 py-1.5 rounded-full border border-white/20 hover:bg-white/10 transition-colors"
          >
            Mark invoices attached
          </button>
          <button
            type="button"
            className="text-[12px] font-medium px-3 py-1.5 rounded-full border border-white/20 hover:bg-white/10 transition-colors flex items-center gap-1.5"
          >
            <Download className="size-3" />
            Export
          </button>
          <button
            type="button"
            onClick={clearSelection}
            className="size-7 rounded-full flex items-center justify-center border border-white/20 hover:bg-white/10 transition-colors"
            title="Clear selection"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

// ── Expense list row ──────────────────────────────────────────────────────────

function ExpenseListRow({
  expense, isChecked, isActive, isMobileExpanded,
  editingVat, vatDraft,
  onRowClick, onToggleCheck, onCategoryChange, onToggleClaimable,
  onToggleReceipt, onStartVatEdit, onSaveVatEdit, onCancelVatEdit,
  onVatDraftChange, onApplyVatPreset, onResetVatLine,
}: {
  expense:           Resolved;
  isChecked:         boolean;
  isActive:          boolean;
  isMobileExpanded:  boolean;
  editingVat:        { id: string; lineIdx: number } | null;
  vatDraft:          string;
  onRowClick:        () => void;
  onToggleCheck:     () => void;
  onCategoryChange:  (c: ExpenseCategory) => void;
  onToggleClaimable: () => void;
  onToggleReceipt:   () => void;
  onStartVatEdit:    (li: number, v: number) => void;
  onSaveVatEdit:     (li: number) => void;
  onCancelVatEdit:   () => void;
  onVatDraftChange:  (v: string) => void;
  onApplyVatPreset:  (li: number, rate: number) => void;
  onResetVatLine:    (li: number) => void;
}) {
  const { id, date, description, cat, meta, pct, vatLines, hasReceipt,
          net, vat, gross, allowNet, confirmedVat, pendingVat, forced0, hasAnyVat, mixedRates, needsReview } = expense;

  const isNotClaimable = pct === 0;
  // dominant VAT rate for the badge
  const dominantRate = vatLines.length > 0
    ? vatLines.reduce((best, l) => l.vat > best.vat ? l : best, vatLines[0]).vatRate
    : 0;

  return (
    <div
      style={{
        boxShadow: isActive ? "inset 3px 0 0 var(--zn-accent)" : "inset 3px 0 0 transparent",
        transition: "box-shadow 0.15s",
      }}
    >
      {/* ── Main row ── */}
      <div
        className="flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-black/[0.015] transition-colors"
        style={{ opacity: isNotClaimable ? 0.7 : 1 }}
        onClick={onRowClick}
      >
        {/* Checkbox */}
        <button
          type="button"
          onClick={ev => { ev.stopPropagation(); onToggleCheck(); }}
          className="shrink-0 mt-0.5 hover:opacity-70 transition-opacity"
        >
          {isChecked
            ? <CheckSquare className="size-4" style={{ color: "var(--zn-accent)" }} />
            : <Square      className="size-4" style={{ color: "var(--zn-ink-3)" }} />
          }
        </button>

        {/* Date */}
        <span className="shrink-0 w-[48px] text-[11px] tabular-nums mt-0.5" style={{ color: "var(--zn-ink-3)" }}>
          {fmtDate(date)}
        </span>

        {/* Description + category + HMRC hint */}
        <div className="flex-1 min-w-0">
          <p className={`text-[13px] font-medium truncate${isNotClaimable ? " line-through" : ""}`}
            style={{ color: isNotClaimable ? "var(--zn-ink-3)" : "var(--zn-ink)" }}>
            {description}
          </p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <CategorySelect cat={cat} onChange={c => { onCategoryChange(c); }} />
            {vat > 0 && (
              <VatBadge amount={vat} rate={dominantRate} mixed={mixedRates} muted={!hasReceipt && needsReview} />
            )}
          </div>
          {/* HMRC hint — always visible inline */}
          <p className="mt-1 text-[11px] italic truncate" style={{ color: "var(--zn-ink-3)" }}>
            {meta.hmrcShort}
          </p>
        </div>

        {/* Receipt indicator */}
        <button
          type="button"
          onClick={ev => { ev.stopPropagation(); onToggleReceipt(); }}
          className="shrink-0 flex items-center justify-center rounded-[7px] transition-colors hover:opacity-80"
          style={{
            width: 28, height: 28,
            background:  hasReceipt ? "var(--zn-safe-soft)"  : needsReview ? "var(--zn-warn-soft)" : "var(--zn-surface-2)",
            color:       hasReceipt ? "var(--zn-safe)"        : needsReview ? "var(--zn-warn)"      : "var(--zn-ink-3)",
          }}
          title={hasReceipt ? "Invoice attached — click to remove" : "No invoice — click to mark as attached"}
        >
          {hasReceipt
            ? <Paperclip     className="size-3.5" />
            : <AlertTriangle className="size-3.5" />
          }
        </button>

        {/* Amount */}
        <div className="text-right shrink-0 w-[80px]">
          <p className="text-[13px] font-semibold tabular-nums" style={{ color: isNotClaimable ? "var(--zn-risk)" : "var(--zn-ink)" }}>
            {fmtGBP(gross)}
          </p>
          {allowNet < gross && allowNet > 0 ? (
            <p className="text-[10px] tabular-nums" style={{ color: "var(--zn-safe)" }}>
              {fmtGBP(allowNet)} ok
            </p>
          ) : isNotClaimable ? (
            <p className="text-[10px] tabular-nums" style={{ color: "var(--zn-risk)" }}>not claim.</p>
          ) : (
            <p className="text-[10px] tabular-nums" style={{ color: "var(--zn-ink-3)" }}>
              {fmtGBP(net)} net
            </p>
          )}
        </div>
      </div>

      {/* Pending VAT warning strip */}
      {needsReview && !hasReceipt && (
        <div className="px-[59px] pb-2.5 -mt-1 flex items-center gap-1.5 text-[11px]" style={{ color: "var(--zn-warn)" }}>
          <AlertTriangle className="size-3 shrink-0" />
          Attach invoice to confirm {fmtGBP(pendingVat)} VAT reclaim
        </div>
      )}

      {/* ── Mobile inline detail (expanded) ── */}
      {isMobileExpanded && (
        <div className="lg:hidden border-t mx-0 px-4 py-4 space-y-4"
          style={{ borderColor: "var(--zn-line-soft)", background: "var(--zn-surface-2)" }}>
          <MobileDetail
            expense={expense}
            editingVat={editingVat}
            vatDraft={vatDraft}
            onCategoryChange={onCategoryChange}
            onToggleClaimable={onToggleClaimable}
            onToggleReceipt={onToggleReceipt}
            onStartVatEdit={onStartVatEdit}
            onSaveVatEdit={onSaveVatEdit}
            onCancelVatEdit={onCancelVatEdit}
            onVatDraftChange={onVatDraftChange}
            onApplyVatPreset={onApplyVatPreset}
            onResetVatLine={onResetVatLine}
          />
        </div>
      )}
    </div>
  );
}

// ── VAT badge ────────────────────────────────────────────────────────────────

function VatBadge({ amount, rate, mixed, muted }: { amount: number; rate: number; mixed: boolean; muted: boolean }) {
  const isZero = amount === 0;
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums shrink-0"
      style={{
        background: isZero ? "var(--zn-surface-2)" : muted ? "var(--zn-warn-soft)" : "var(--zn-accent-soft)",
        color:      isZero ? "var(--zn-ink-3)"      : muted ? "var(--zn-warn)"      : "var(--zn-accent)",
      }}>
      +{fmtGBP(amount)}
      <span className="rounded-full px-1 py-px text-[9px]"
        style={{
          background: isZero ? "var(--zn-line)" : muted ? "rgba(194,136,0,0.15)" : "rgba(37,99,235,0.12)",
        }}>
        {mixed ? "mixed" : vatRateLabel(rate)}
      </span>
    </span>
  );
}

// ── Mobile inline detail ──────────────────────────────────────────────────────

function MobileDetail({
  expense, editingVat, vatDraft,
  onCategoryChange, onToggleClaimable, onToggleReceipt,
  onStartVatEdit, onSaveVatEdit, onCancelVatEdit, onVatDraftChange,
  onApplyVatPreset, onResetVatLine,
}: DetailProps) {
  return (
    <DetailContent
      expense={expense}
      editingVat={editingVat}
      vatDraft={vatDraft}
      onCategoryChange={onCategoryChange}
      onToggleClaimable={onToggleClaimable}
      onToggleReceipt={onToggleReceipt}
      onStartVatEdit={onStartVatEdit}
      onSaveVatEdit={onSaveVatEdit}
      onCancelVatEdit={onCancelVatEdit}
      onVatDraftChange={onVatDraftChange}
      onApplyVatPreset={onApplyVatPreset}
      onResetVatLine={onResetVatLine}
    />
  );
}

// ── Expense detail panel (right side desktop) ─────────────────────────────────

interface DetailProps {
  expense:           Resolved;
  editingVat:        { id: string; lineIdx: number } | null;
  vatDraft:          string;
  onCategoryChange:  (c: ExpenseCategory) => void;
  onToggleClaimable: () => void;
  onToggleReceipt:   () => void;
  onStartVatEdit:    (li: number, v: number) => void;
  onSaveVatEdit:     (li: number) => void;
  onCancelVatEdit:   () => void;
  onVatDraftChange:  (v: string) => void;
  onApplyVatPreset:  (li: number, rate: number) => void;
  onResetVatLine:    (li: number) => void;
}

function ExpenseDetailPanel(props: DetailProps) {
  const { expense } = props;
  const meta = CATEGORY_META[expense.cat];
  return (
    <div className="zn-card overflow-hidden">
      {/* Panel header */}
      <div className="px-5 py-4 border-b" style={{ borderColor: "var(--zn-line-soft)" }}>
        <p className="text-[11px] font-semibold uppercase tracking-[0.07em]" style={{ color: "var(--zn-ink-3)" }}>
          Expense detail
        </p>
        <h2 className="mt-1 text-[15px] font-semibold leading-snug" style={{ color: "var(--zn-ink)" }}>
          {expense.description}
        </h2>
        <div className="mt-1.5 flex items-center gap-2">
          <span className="text-[12px]" style={{ color: "var(--zn-ink-3)" }}>
            {fmtDate(expense.date)} · {fmtGBP(expense.gross)} gross
          </span>
          <span className="size-1.5 rounded-full" style={{ background: meta.dot }} />
          <span className="text-[11px] font-medium italic" style={{ color: "var(--zn-ink-3)" }}>
            {meta.hmrcShort}
          </span>
        </div>
      </div>

      {/* 4-cell summary grid */}
      <div className="grid grid-cols-4 divide-x border-b"
        style={{ borderColor: "var(--zn-line-soft)" }}>
        {[
          { label: "Gross",     value: fmtGBP(expense.gross),    color: "var(--zn-ink)" },
          { label: "Net",       value: fmtGBP(expense.net),      color: "var(--zn-ink)" },
          { label: `VAT ${expense.vatLines[0]?.vatRate ?? 0}%`, value: fmtGBP(expense.vat), color: "var(--zn-accent)" },
          { label: "Allowable", value: fmtGBP(expense.allowNet), color: expense.allowNet > 0 ? "var(--zn-safe)" : "var(--zn-risk)" },
        ].map(({ label, value, color }) => (
          <div key={label} className="px-3 py-2.5 text-center"
            style={{ borderColor: "var(--zn-line-soft)" }}>
            <p className="text-[9.5px] font-semibold uppercase tracking-[0.06em]" style={{ color: "var(--zn-ink-3)" }}>{label}</p>
            <p className="mt-0.5 text-[12px] font-bold tabular-nums" style={{ color }}>{value}</p>
          </div>
        ))}
      </div>

      <div className="px-5 py-4 space-y-5 max-h-[calc(100vh-340px)] overflow-y-auto">
        <DetailContent {...props} />
      </div>
    </div>
  );
}

function DetailContent({
  expense, editingVat, vatDraft,
  onCategoryChange, onToggleClaimable, onToggleReceipt,
  onStartVatEdit, onSaveVatEdit, onCancelVatEdit, onVatDraftChange,
  onApplyVatPreset, onResetVatLine,
}: DetailProps) {
  const { id, cat, meta, pct, vatLines, hasReceipt,
          net, vat, gross, allowNet, confirmedVat, pendingVat, forced0, hasAnyVat, mixedRates } = expense;
  const isNotClaimable = pct === 0;
  const isPartial = pct > 0 && pct < 100;
  const STANDARD_RATES = new Set([-1, 0, 5, 20]);
  const originalVatLines = BASE_EXPENSES.find(e => e.id === id)!.vatLines;

  return (
    <>
      {/* Receipt */}
      <div>
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.07em] mb-2" style={{ color: "var(--zn-ink-3)" }}>
          Invoice / Receipt
        </p>
        <button
          type="button"
          onClick={onToggleReceipt}
          className="w-full flex items-center gap-3 px-4 py-3.5 rounded-[10px] border text-left transition-colors hover:opacity-80"
          style={{
            background:  hasReceipt ? "var(--zn-safe-soft)"  : "var(--zn-warn-soft)",
            borderColor: hasReceipt ? "var(--zn-safe)44"      : "var(--zn-warn)44",
          }}
        >
          {hasReceipt
            ? <Paperclip     className="size-5 shrink-0" style={{ color: "var(--zn-safe)" }} />
            : <AlertTriangle className="size-5 shrink-0" style={{ color: "var(--zn-warn)" }} />
          }
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold"
              style={{ color: hasReceipt ? "var(--zn-safe)" : "var(--zn-warn)" }}>
              {hasReceipt ? "Invoice attached" : "No invoice attached"}
            </p>
            <p className="text-[11px] mt-0.5" style={{ color: hasReceipt ? "var(--zn-safe)" : "var(--zn-warn)" }}>
              {hasReceipt
                ? "VAT reclaim confirmed · tap to toggle"
                : vat > 0
                  ? `Attach to confirm ${fmtGBP(vat)} VAT reclaim · tap to toggle`
                  : "Required for VAT reclaim · tap to toggle"
              }
            </p>
          </div>
          <span className="shrink-0 text-[11px] font-medium px-2.5 py-1 rounded-full"
            style={{
              background: hasReceipt ? "var(--zn-safe)" : "var(--zn-warn)",
              color: "#fff",
            }}>
            {hasReceipt ? "Remove" : "Upload"}
          </span>
        </button>
      </div>

      {/* HMRC rule */}
      <div>
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.07em] mb-2" style={{ color: "var(--zn-ink-3)" }}>
          HMRC rule · {cat}
        </p>
        <div className="px-3.5 py-3 rounded-[10px] text-[12px] leading-relaxed"
          style={{ background: isNotClaimable ? "var(--zn-risk-soft)" : isPartial ? "var(--zn-warn-soft)" : "var(--zn-safe-soft)",
                   color:      isNotClaimable ? "var(--zn-risk)"       : isPartial ? "var(--zn-warn)"       : "var(--zn-safe)" }}>
          {meta.hint}
        </div>
      </div>

      {/* Category */}
      <div>
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.07em] mb-2" style={{ color: "var(--zn-ink-3)" }}>
          Category
        </p>
        <CategorySelect cat={cat} onChange={onCategoryChange} fullWidth />
      </div>

      {/* Allowability override */}
      <div>
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.07em] mb-2" style={{ color: "var(--zn-ink-3)" }}>
          Allowability
        </p>
        <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-[10px] border"
          style={{ borderColor: "var(--zn-line-soft)" }}>
          <div>
            <p className="text-[12.5px] font-medium" style={{ color: "var(--zn-ink)" }}>
              {isNotClaimable ? "Not claimable" : isPartial ? `${pct}% allowable` : "Fully allowable"}
            </p>
            <p className="text-[11px] mt-0.5" style={{ color: "var(--zn-ink-3)" }}>
              {meta.allowablePct === 0 && !forced0
                ? "HMRC blocks this category — change category to override"
                : "Toggle to force exclude from your tax deductions"
              }
            </p>
          </div>
          <ClaimableToggle
            on={!forced0 && meta.allowablePct > 0}
            categoryIsZero={meta.allowablePct === 0 && !forced0}
            onToggle={onToggleClaimable}
          />
        </div>
        {allowNet > 0 && (
          <p className="mt-1.5 text-[12px] px-1" style={{ color: "var(--zn-safe)" }}>
            {fmtGBP(allowNet)} net claimable · est. {fmtGBP(r2(allowNet * 0.20))} tax saving at 20%
          </p>
        )}
      </div>

      {/* VAT breakdown */}
      {hasAnyVat && (
        <div>
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.07em] mb-2" style={{ color: "var(--zn-ink-3)" }}>
            VAT breakdown
          </p>
          {mixedRates && (
            <p className="mb-2 text-[11px] px-1" style={{ color: "var(--zn-warn)" }}>
              Mixed VAT rates — each line must be recorded separately on your VAT return.
            </p>
          )}
          <div className="rounded-[10px] overflow-hidden border" style={{ borderColor: "var(--zn-line-soft)" }}>
            {vatLines.map((line, i) => {
              const nonStandard  = !STANDARD_RATES.has(line.vatRate) && line.vat > 0;
              const lineModified = line.vat !== originalVatLines[i].vat || line.vatRate !== originalVatLines[i].vatRate;
              const isEditingThis = editingVat?.id === id && editingVat?.lineIdx === i;
              return (
                <div key={i} className="px-4 py-3 border-b last:border-0 space-y-2"
                  style={{ borderColor: "var(--zn-line-soft)" }}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[12px] font-medium" style={{ color: "var(--zn-ink)" }}>{line.label}</p>
                      <p className="text-[11px] mt-0.5" style={{ color: nonStandard ? "var(--zn-warn)" : "var(--zn-ink-3)" }}>
                        {vatRateLabel(line.vatRate)}{nonStandard ? " ⚠" : ""} · {fmtGBP(line.net)} net
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[12.5px] font-semibold tabular-nums" style={{ color: "var(--zn-ink)" }}>
                        {fmtGBP(line.gross)}
                      </p>
                      {line.reclaimable && line.vat > 0 && (
                        <p className="text-[10px] tabular-nums" style={{ color: "var(--zn-safe)" }}>
                          +{fmtGBP(line.vat)} reclaimable
                        </p>
                      )}
                    </div>
                  </div>

                  {/* VAT edit */}
                  <VatEditRow
                    lineIdx={i}
                    line={line}
                    isEditing={isEditingThis}
                    vatDraft={vatDraft}
                    pendingVat={expense.pendingVat}
                    onStartEdit={onStartVatEdit}
                    onSaveEdit={onSaveVatEdit}
                    onCancelEdit={onCancelVatEdit}
                    onDraftChange={onVatDraftChange}
                    onApplyPreset={(rate) => onApplyVatPreset(i, rate)}
                  />
                  {lineModified && !isEditingThis && (
                    <button type="button" onClick={() => onResetVatLine(i)}
                      className="text-[11px] underline underline-offset-2 hover:no-underline"
                      style={{ color: "var(--zn-ink-3)" }}>
                      ↩ reset to original
                    </button>
                  )}
                </div>
              );
            })}

            {/* Total row */}
            <div className="px-4 py-2.5 flex items-center justify-between"
              style={{ background: "var(--zn-surface-2)" }}>
              <span className="text-[12px] font-semibold" style={{ color: "var(--zn-ink-3)" }}>Total</span>
              <div className="text-right">
                <span className="text-[13px] font-bold tabular-nums" style={{ color: "var(--zn-ink)" }}>
                  {fmtGBP(gross)}
                </span>
                {vat > 0 && (
                  <p className="text-[10px] tabular-nums" style={{ color: "var(--zn-accent)" }}>
                    incl. +{fmtGBP(vat)} VAT
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Confirmed vs pending VAT summary */}
          {confirmedVat > 0 && (
            <p className="mt-1.5 text-[12px] px-1" style={{ color: "var(--zn-accent)" }}>
              {fmtGBP(confirmedVat)} VAT reclaimable ✓
            </p>
          )}
          {pendingVat > 0 && (
            <p className="mt-1.5 text-[12px] px-1" style={{ color: "var(--zn-warn)" }}>
              {fmtGBP(pendingVat)} VAT pending — attach invoice to confirm
            </p>
          )}
        </div>
      )}
    </>
  );
}

// ── VAT edit row (used inside the detail panel) ───────────────────────────────

function VatEditRow({
  lineIdx, line, isEditing, vatDraft, pendingVat,
  onStartEdit, onSaveEdit, onCancelEdit, onDraftChange, onApplyPreset,
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
  onApplyPreset: (rate: number) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (isEditing) inputRef.current?.focus(); }, [isEditing]);

  const draftNum = parseFloat(vatDraft);
  const liveRate = isEditing && !isNaN(draftNum) && line.net > 0
    ? r2((draftNum / line.net) * 100) : null;

  if (!isEditing) {
    return (
      <button
        type="button"
        onClick={() => onStartEdit(lineIdx, line.vat)}
        className="flex items-center gap-1.5 text-[11.5px] hover:opacity-70 transition-opacity"
        style={{ color: line.vat > 0 ? (pendingVat > 0 ? "var(--zn-warn)" : "var(--zn-accent)") : "var(--zn-ink-3)" }}
      >
        <Pencil className="size-3" />
        {line.vat > 0 ? `${fmtGBP(line.vat)} VAT · click to edit` : "No VAT — click to set"}
      </button>
    );
  }

  return (
    <div className="space-y-2">
      {/* Rate preset buttons */}
      <div className="grid grid-cols-4 gap-1.5">
        {VAT_PRESETS.map(p => {
          const active = line.vatRate === p.rate;
          return (
            <button key={p.rate} type="button" onClick={() => onApplyPreset(p.rate)}
              className="py-2 rounded-[8px] border text-[11.5px] font-semibold text-center transition-colors"
              style={{
                borderColor: active ? "var(--zn-accent)" : "var(--zn-line-soft)",
                background:  active ? "var(--zn-accent-soft)" : "var(--zn-surface)",
                color:       active ? "var(--zn-accent)" : "var(--zn-ink-2)",
              }}>
              {p.label}
            </button>
          );
        })}
      </div>
      {/* Custom amount input */}
      <div className="flex items-center gap-2">
        <div className="flex-1 flex items-center gap-1.5 rounded-[8px] border px-3 py-2"
          style={{ borderColor: "var(--zn-accent)", background: "var(--zn-accent-soft)" }}>
          <span className="text-[12px] font-medium" style={{ color: "var(--zn-accent)" }}>£</span>
          <input
            ref={inputRef}
            type="number" min="0" step="0.01"
            value={vatDraft}
            onChange={e => onDraftChange(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter")  onSaveEdit(lineIdx);
              if (e.key === "Escape") onCancelEdit();
            }}
            className="flex-1 text-[13px] tabular-nums min-w-0"
            style={{ color: "var(--zn-accent)", background: "transparent", outline: "none", border: "none" }}
          />
          {liveRate !== null && (
            <span className="text-[10px] tabular-nums shrink-0" style={{ color: "var(--zn-ink-3)" }}>
              → {vatRateLabel(liveRate)}
            </span>
          )}
        </div>
        <button type="button" onClick={() => onSaveEdit(lineIdx)} title="Save"
          className="size-8 rounded-full inline-flex items-center justify-center border"
          style={{ borderColor: "var(--zn-safe)", background: "var(--zn-safe-soft)" }}>
          <Check className="size-3.5" style={{ color: "var(--zn-safe)" }} />
        </button>
        <button type="button" onClick={onCancelEdit} title="Cancel"
          className="size-8 rounded-full inline-flex items-center justify-center border"
          style={{ borderColor: "var(--zn-line-soft)", background: "var(--zn-surface-2)" }}>
          <X className="size-3.5" style={{ color: "var(--zn-ink-3)" }} />
        </button>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function CategorySelect({ cat, onChange, fullWidth }: { cat: ExpenseCategory; onChange: (c: ExpenseCategory) => void; fullWidth?: boolean }) {
  const meta = CATEGORY_META[cat];
  return (
    <div className={`relative inline-flex items-center shrink-0 ${fullWidth ? "w-full" : ""}`}>
      <span className={`text-[10.5px] font-semibold pl-2.5 pr-6 py-0.5 rounded-full pointer-events-none whitespace-nowrap ${fullWidth ? "w-full py-2 pl-3" : ""}`}
        style={{ background: meta.bg, color: meta.color }}>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-1.5 rounded-full" style={{ background: meta.dot }} />
          {cat}
        </span>
      </span>
      <ChevronDown className="absolute right-1.5 size-2.5 pointer-events-none" style={{ color: meta.color }} />
      <select value={cat} onChange={e => onChange(e.target.value as ExpenseCategory)}
        className="absolute inset-0 opacity-0 cursor-pointer w-full"
        aria-label="Change expense category" title="Change category"
        onClick={e => e.stopPropagation()}>
        {CATEGORY_LIST.map(c => <option key={c} value={c}>{c}</option>)}
      </select>
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
      className="relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors duration-150"
      style={{
        background: on ? "var(--zn-safe)" : "var(--zn-line)",
        opacity:    categoryIsZero ? 0.3 : 1,
        cursor:     categoryIsZero ? "not-allowed" : "pointer",
      }}>
      <span className="inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-150 mt-0.5"
        style={{ transform: on ? "translateX(21px)" : "translateX(2px)" }} />
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
