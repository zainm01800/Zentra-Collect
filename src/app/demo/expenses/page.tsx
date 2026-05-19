"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import {
  ChevronDown, ChevronRight, Check, X,
  Paperclip, AlertTriangle, Square, CheckSquare,
  Download, Plus,
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
  "Software":              { color: "#2563EB", bg: "#EFF6FF", dot: "#2563EB", allowablePct: 100, vatClaimable: true,  hint: "Software subscriptions used wholly and exclusively for the trade are fully deductible. VAT is reclaimable in full.", hmrcShort: "Fully allowable" },
  "Office":                { color: "#4B5563", bg: "#F9FAFB", dot: "#4B5563", allowablePct: 100, vatClaimable: true,  hint: "Office supplies used for business are fully deductible. VAT is reclaimable where a valid VAT invoice is held.", hmrcShort: "Fully allowable" },
  "Travel":                { color: "#0D9488", bg: "#F0FDFA", dot: "#0D9488", allowablePct: 100, vatClaimable: false, hint: "Business travel is fully allowable. Public transport is typically zero-rated — no VAT to reclaim.", hmrcShort: "Fully allowable — business travel" },
  "Communications":        { color: "#7C3AED", bg: "#F5F3FF", dot: "#7C3AED", allowablePct: 50,  vatClaimable: true,  hint: "HMRC allows 50% for phone and broadband on mixed personal/business use. 50% of VAT is reclaimable.", hmrcShort: "50% mixed-use rule" },
  "Insurance":             { color: "#C28800", bg: "#FFFBEB", dot: "#C28800", allowablePct: 100, vatClaimable: false, hint: "Business insurance is fully allowable. Premiums are VAT-exempt — no VAT to reclaim.", hmrcShort: "Fully allowable · VAT exempt" },
  "Entertaining":          { color: "#DC2626", bg: "#FEF2F2", dot: "#DC2626", allowablePct: 0,   vatClaimable: false, hint: "HMRC does not allow client entertainment as a business deduction. VAT on entertaining is blocked input tax and cannot be reclaimed.", hmrcShort: "Not allowable · client entertaining" },
  "Professional Services": { color: "#0369A1", bg: "#EFF6FF", dot: "#0369A1", allowablePct: 100, vatClaimable: true,  hint: "Accountancy, legal, and professional fees are fully allowable for Self Assessment. VAT is reclaimable in full.", hmrcShort: "Fully allowable" },
  "Marketing":             { color: "#BE185D", bg: "#FDF2F8", dot: "#BE185D", allowablePct: 100, vatClaimable: true,  hint: "Advertising and marketing spend is fully allowable. VAT is reclaimable where a valid invoice is held.", hmrcShort: "Fully allowable" },
  "Equipment":             { color: "#0369A1", bg: "#EFF6FF", dot: "#0369A1", allowablePct: 100, vatClaimable: true,  hint: "Business equipment is allowable via the Annual Investment Allowance (AIA). VAT is reclaimable in full where a valid VAT invoice is held.", hmrcShort: "Capital allowance · AIA" },
};

const CATEGORY_LIST = Object.keys(CATEGORY_META) as ExpenseCategory[];

// ── Data model ────────────────────────────────────────────────────────────────

interface VatLine {
  label: string; net: number; vatRate: number; vat: number; gross: number; reclaimable: boolean;
}

interface DemoExpense {
  id: string; date: string; description: string; vendor: string;
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
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
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
  const [receiptOverrides,  setReceiptOverrides]  = useState<Record<string, boolean>>({});
  const [vatOverrides,      setVatOverrides]      = useState<Record<string, VatLine[]>>({});
  const [editingVat,        setEditingVat]        = useState<{ id: string; lineIdx: number } | null>(null);
  const [vatDraft,          setVatDraft]          = useState("");
  const [selectedId,        setSelectedId]        = useState<string | null>(BASE_EXPENSES[0]?.id ?? null);
  const [collapsedMonths,   setCollapsedMonths]   = useState<Set<string>>(new Set());
  const [selectedIds,       setSelectedIds]       = useState<Set<string>>(new Set());
  const [mobileExpanded,    setMobileExpanded]    = useState<string | null>(null);

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

  const reviewExpenses       = expenses.filter(e => e.needsReview);
  const missingExpenses      = expenses.filter(e => !e.hasReceipt);
  const notAllowableExpenses = expenses.filter(e => e.pct === 0);

  const totalGross        = r2(expenses.reduce((s, e) => s + e.gross,        0));
  const totalAllowNet     = r2(expenses.reduce((s, e) => s + e.allowNet,     0));
  const totalConfirmedVat = r2(expenses.reduce((s, e) => s + e.confirmedVat, 0));
  const totalPendingVat   = r2(expenses.reduce((s, e) => s + e.pendingVat,   0));
  const totalDisallowed   = r2(expenses.reduce((s, e) => s + (e.net - e.allowNet), 0));
  const taxSaving20       = r2(totalAllowNet * 0.20);
  const pctClaimable      = totalGross > 0 ? Math.round((totalAllowNet / (totalGross / 1.2)) * 100) : 0;

  const baseList = activeTab === "review"       ? reviewExpenses
                 : activeTab === "missing"      ? missingExpenses
                 : activeTab === "notallowable" ? notAllowableExpenses
                 : expenses;

  const monthGroups = useMemo(() => {
    const map = new Map<string, Resolved[]>();
    baseList.forEach(e => {
      const ym = e.date.slice(0, 7);
      if (!map.has(ym)) map.set(ym, []);
      map.get(ym)!.push(e);
    });
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [baseList]);

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
      <div>
        <p className="zn-section-label">Demo · Books</p>
        <h1 className="text-[28px] font-semibold tracking-[-0.02em] leading-[1.1] mt-1"
          style={{ color: "var(--zn-ink)" }}>
          Expenses
        </h1>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard label="Total gross"     value={fmtGBP(totalGross)} />
        <StatCard label="Claimable net"   value={fmtGBP(totalAllowNet)}  accent="#16A34A" sub={`${pctClaimable}% of net`} />
        <StatCard label="Est. tax saving" value={fmtGBP(taxSaving20)}    accent="#16A34A" sub="@ 20% basic rate" />
        <StatCard
          label="VAT reclaimable"
          value={fmtGBP(totalConfirmedVat)}
          accent="#2563EB"
          sub="From HMRC"
        />
        <StatCard
          label="Not allowable"
          value={fmtGBP(totalDisallowed)}
          accent="#DC2626"
          sub={`${notAllowableExpenses.length} item${notAllowableExpenses.length !== 1 ? "s" : ""}`}
        />
      </div>

      {/* Tab bar + Sort */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1">
          {([
            ["all",          "All"],
            ["review",       "Needs review"],
            ["missing",      "Receipts missing"],
            ["notallowable", "Not allowable"],
          ] as [Tab, string][]).map(([id, label]) => {
            const count = id === "review" ? reviewExpenses.length
                        : id === "missing" ? missingExpenses.length
                        : id === "notallowable" ? notAllowableExpenses.length
                        : expenses.length;
            const isWarn = (id === "review" || id === "missing") && count > 0;
            const isRisk = id === "notallowable" && count > 0;
            return (
              <button key={id} type="button" onClick={() => setActiveTab(id)}
                className="px-3 py-1.5 rounded-full text-[12px] font-medium transition-all whitespace-nowrap"
                style={{
                  background:  activeTab === id ? "var(--zn-ink)" : "transparent",
                  color:       activeTab === id ? "#fff"
                               : isWarn ? "#C28800"
                               : isRisk ? "#DC2626"
                               : "var(--zn-ink-3)",
                  fontWeight:  activeTab === id ? "600" : "500",
                }}>
                {label}
                {activeTab !== id && count > 0 && id !== "all" && (
                  <span className="ml-1 tabular-nums text-[10px]">({count})</span>
                )}
              </button>
            );
          })}
        </div>
        <div className="ml-auto">
          <select
            className="text-[12px] rounded-lg border px-2.5 py-1.5 cursor-pointer"
            style={{ borderColor: "var(--zn-line)", color: "var(--zn-ink-2)", background: "var(--zn-surface)" }}
          >
            <option>Sort: Newest first</option>
            <option>Sort: Oldest first</option>
            <option>Sort: Highest amount</option>
          </select>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="lg:grid lg:grid-cols-[1fr_420px] lg:gap-5 lg:items-start">

        {/* Left: expense list */}
        <div className="space-y-3">
          {monthGroups.length === 0 ? (
            <div className="zn-card px-5 py-12 text-center text-[13.5px]" style={{ color: "var(--zn-ink-3)" }}>
              No expenses in this view.
            </div>
          ) : monthGroups.map(([ym, rows]) => {
            const collapsed    = collapsedMonths.has(ym);
            const monthAllowNet = r2(rows.reduce((s, e) => s + e.allowNet, 0));
            const monthNet      = r2(rows.reduce((s, e) => s + e.net,      0));
            const allSelected   = rows.every(e => selectedIds.has(e.id));
            const someSelected  = rows.some(e => selectedIds.has(e.id));
            return (
              <div key={ym} className="zn-card overflow-hidden">
                {/* Month header */}
                <div
                  className="flex items-center gap-3 px-4 py-3 border-b cursor-pointer select-none"
                  style={{ borderColor: "var(--zn-line-soft)", background: "var(--zn-surface-2)" }}
                  onClick={() => setCollapsedMonths(p => {
                    const s = new Set(p); s.has(ym) ? s.delete(ym) : s.add(ym); return s;
                  })}
                >
                  <button
                    type="button"
                    onClick={ev => {
                      ev.stopPropagation();
                      if (allSelected) {
                        setSelectedIds(p => { const s = new Set(p); rows.forEach(e => s.delete(e.id)); return s; });
                      } else {
                        setSelectedIds(p => { const s = new Set(p); rows.forEach(e => s.add(e.id)); return s; });
                      }
                    }}
                    className="shrink-0 hover:opacity-70"
                  >
                    {allSelected
                      ? <CheckSquare className="size-4" style={{ color: "#2563EB" }} />
                      : someSelected
                        ? <CheckSquare className="size-4" style={{ color: "var(--zn-ink-3)", opacity: 0.5 }} />
                        : <Square className="size-4" style={{ color: "var(--zn-ink-3)" }} />
                    }
                  </button>

                  {collapsed
                    ? <ChevronRight className="size-4 shrink-0" style={{ color: "var(--zn-ink-3)" }} />
                    : <ChevronDown  className="size-4 shrink-0" style={{ color: "var(--zn-ink-3)" }} />
                  }

                  <span className="text-[13px] font-semibold" style={{ color: "var(--zn-ink)" }}>
                    {fmtMonth(ym)}
                  </span>
                  <span className="text-[11px]" style={{ color: "var(--zn-ink-3)" }}>
                    {rows.length} expense{rows.length !== 1 ? "s" : ""}
                  </span>

                  <div className="ml-auto text-right">
                    <span className="text-[12px] font-semibold tabular-nums" style={{ color: "var(--zn-ink)" }}>
                      ALLOWABLE {fmtGBP(monthAllowNet)}
                    </span>
                    <span className="mx-2 text-[11px]" style={{ color: "var(--zn-ink-3)" }}>·</span>
                    <span className="text-[12px] font-semibold tabular-nums" style={{ color: "var(--zn-ink-2)" }}>
                      NET {fmtGBP(monthNet)}
                    </span>
                  </div>
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
                        onApplyVatPreset={(li, rate) => applyVatPreset(e.id, li, rate)}
                        onStartVatEdit={(li, v) => { setEditingVat({ id: e.id, lineIdx: li }); setVatDraft(String(v)); }}
                        onSaveVatEdit={li => saveVatEdit(e.id, li)}
                        onCancelVatEdit={() => { setEditingVat(null); setVatDraft(""); }}
                        onVatDraftChange={setVatDraft}
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
            <DetailPanel
              expense={selectedExpense}
              editingVat={editingVat}
              vatDraft={vatDraft}
              onCategoryChange={c => handleCategoryChange(selectedExpense.id, c)}
              onToggleClaimable={() => toggleClaimable(selectedExpense.id)}
              onToggleReceipt={() => toggleReceipt(selectedExpense.id, selectedExpense.hasReceipt)}
              onApplyVatPreset={(li, rate) => applyVatPreset(selectedExpense.id, li, rate)}
              onStartVatEdit={(li, v) => { setEditingVat({ id: selectedExpense.id, lineIdx: li }); setVatDraft(String(v)); }}
              onSaveVatEdit={li => saveVatEdit(selectedExpense.id, li)}
              onCancelVatEdit={() => { setEditingVat(null); setVatDraft(""); }}
              onVatDraftChange={setVatDraft}
            />
          ) : (
            <div className="zn-card px-5 py-12 text-center text-[13px]" style={{ color: "var(--zn-ink-3)" }}>
              Select an expense to see details, edit VAT, and adjust allowability.
            </div>
          )}
        </div>
      </div>

      {/* Multi-select action bar */}
      {selectedIds.size > 0 && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-xl px-5 py-3 shadow-xl"
          style={{
            background: "var(--zn-ink)", color: "#fff",
            whiteSpace: "nowrap",
            animation: "bulkRise 0.18s ease-out both",
          }}
        >
          <span className="text-[13px] font-semibold">
            {selectedIds.size} selected
            <span className="font-normal ml-1.5 opacity-50">·</span>
            <span className="font-normal ml-1.5">
              {fmtGBP(r2([...selectedIds].reduce((s, id) => s + (expenses.find(e => e.id === id)?.gross ?? 0), 0)))}
            </span>
          </span>
          <div className="w-px h-4 bg-white/20" />
          <button type="button" onClick={markReceiptsAttached}
            className="text-[12px] font-medium px-3 py-1.5 rounded-full border border-white/20 hover:bg-white/10 transition-colors">
            Mark invoices attached
          </button>
          <button type="button"
            className="text-[12px] font-medium px-3 py-1.5 rounded-full border border-white/20 hover:bg-white/10 transition-colors flex items-center gap-1.5">
            <Download className="size-3" />Export
          </button>
          <button type="button" onClick={clearSelection}
            className="size-7 rounded-full flex items-center justify-center border border-white/20 hover:bg-white/10 transition-colors">
            <X className="size-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

// ── Expense list row ──────────────────────────────────────────────────────────

function ExpenseListRow({
  expense, isChecked, isActive, isMobileExpanded, editingVat, vatDraft,
  onRowClick, onToggleCheck, onCategoryChange, onToggleClaimable,
  onToggleReceipt, onApplyVatPreset, onStartVatEdit, onSaveVatEdit,
  onCancelVatEdit, onVatDraftChange,
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
  onApplyVatPreset:  (li: number, rate: number) => void;
  onStartVatEdit:    (li: number, v: number) => void;
  onSaveVatEdit:     (li: number) => void;
  onCancelVatEdit:   () => void;
  onVatDraftChange:  (v: string) => void;
}) {
  const { id, date, description, vendor, cat, meta, pct, vatLines, hasReceipt,
          net, vat, gross, allowNet, pendingVat, forced0, needsReview } = expense;
  const isNotClaimable = pct === 0;
  const dominantRate   = vatLines.length > 0
    ? vatLines.reduce((b, l) => l.vat > b.vat ? l : b, vatLines[0]).vatRate : 0;

  return (
    <div style={{ boxShadow: isActive ? "inset 3px 0 0 #1A1916" : "inset 3px 0 0 transparent", transition: "box-shadow 0.12s" }}>
      <div
        className="flex items-start gap-3 px-4 py-3.5 cursor-pointer hover:bg-black/[0.015] transition-colors"
        onClick={onRowClick}
      >
        {/* Checkbox */}
        <button type="button" onClick={ev => { ev.stopPropagation(); onToggleCheck(); }}
          className="shrink-0 mt-0.5 hover:opacity-70">
          {isChecked
            ? <CheckSquare className="size-4" style={{ color: "#2563EB" }} />
            : <Square      className="size-4" style={{ color: "var(--zn-ink-3)" }} />}
        </button>

        {/* Dot + description + vendor + category + HMRC */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2">
            <span className="size-2 rounded-full mt-[5px] shrink-0" style={{ background: meta.dot }} />
            <div className="min-w-0 flex-1">
              <p className={`text-[13px] font-semibold truncate${isNotClaimable ? " line-through opacity-50" : ""}`}
                style={{ color: "var(--zn-ink)" }}>
                {description}
              </p>
              <p className="text-[11px] mt-0.5" style={{ color: "var(--zn-ink-3)" }}>
                {fmtDate(date)} · {vendor}
              </p>
            </div>
          </div>

          {/* Category + VAT badge */}
          <div className="flex items-center gap-2 mt-2 ml-4">
            <CategorySelect cat={cat} onChange={c => { onCategoryChange(c); }} />
            {vat > 0 && (
              <span className="text-[10.5px] font-semibold tabular-nums px-2 py-0.5 rounded-full"
                style={{
                  background: needsReview && !hasReceipt ? "#FFFBEB" : "#EFF6FF",
                  color:      needsReview && !hasReceipt ? "#C28800" : "#2563EB",
                }}>
                +{fmtGBP(vat)} VAT {dominantRate > 0 ? `${dominantRate}%` : vatRateLabel(dominantRate)}
              </span>
            )}
          </div>

          {/* HMRC hint */}
          <p className="text-[11px] mt-1 ml-4 italic truncate" style={{ color: "var(--zn-ink-3)" }}>
            HMRC: {meta.hmrcShort}
          </p>
        </div>

        {/* Amount column */}
        <div className="text-right shrink-0 ml-2">
          <p className="text-[13.5px] font-semibold tabular-nums" style={{ color: "var(--zn-ink)" }}>
            {fmtGBP(gross)}
          </p>
          {allowNet > 0 && allowNet < gross ? (
            <p className="text-[11px] tabular-nums" style={{ color: "#16A34A" }}>
              {fmtGBP(allowNet)} allowable
            </p>
          ) : isNotClaimable ? (
            <p className="text-[11px] tabular-nums" style={{ color: "#DC2626" }}>not claimable</p>
          ) : (
            <p className="text-[11px] tabular-nums" style={{ color: "#16A34A" }}>
              {fmtGBP(allowNet)} allowable
            </p>
          )}
        </div>

        {/* Receipt icon */}
        <button
          type="button"
          onClick={ev => { ev.stopPropagation(); onToggleReceipt(); }}
          className="shrink-0 mt-0.5 hover:opacity-70 transition-opacity"
          title={hasReceipt ? "Invoice attached" : "No invoice"}
        >
          {hasReceipt
            ? <Paperclip     className="size-4" style={{ color: "#16A34A" }} />
            : <AlertTriangle className="size-4" style={{ color: needsReview ? "#C28800" : "var(--zn-ink-3)" }} />}
        </button>
      </div>

      {/* Attach invoice warning strip */}
      {needsReview && !hasReceipt && (
        <div className="mx-4 mb-3 -mt-1 flex items-center justify-between gap-3 px-3 py-2 rounded-[8px] text-[11.5px]"
          style={{ background: "#FFFBEB", color: "#C28800" }}>
          <span className="flex items-center gap-1.5">
            <AlertTriangle className="size-3.5 shrink-0" />
            Attach invoice to confirm {fmtGBP(pendingVat)} VAT reclaim
          </span>
          <button
            type="button"
            onClick={ev => { ev.stopPropagation(); onToggleReceipt(); }}
            className="shrink-0 px-3 py-1 rounded-full text-[11px] font-semibold text-white"
            style={{ background: "var(--zn-ink)" }}
          >
            Attach
          </button>
        </div>
      )}

      {/* Mobile expand */}
      {isMobileExpanded && (
        <div className="lg:hidden border-t px-4 py-4 space-y-4"
          style={{ borderColor: "var(--zn-line-soft)", background: "var(--zn-surface-2)" }}>
          <DetailContent
            expense={expense}
            editingVat={editingVat}
            vatDraft={vatDraft}
            onCategoryChange={onCategoryChange}
            onToggleClaimable={onToggleClaimable}
            onToggleReceipt={onToggleReceipt}
            onApplyVatPreset={onApplyVatPreset}
            onStartVatEdit={onStartVatEdit}
            onSaveVatEdit={onSaveVatEdit}
            onCancelVatEdit={onCancelVatEdit}
            onVatDraftChange={onVatDraftChange}
          />
        </div>
      )}
    </div>
  );
}

// ── Detail panel (right side) ─────────────────────────────────────────────────

interface DetailPanelProps {
  expense:           Resolved;
  editingVat:        { id: string; lineIdx: number } | null;
  vatDraft:          string;
  onCategoryChange:  (c: ExpenseCategory) => void;
  onToggleClaimable: () => void;
  onToggleReceipt:   () => void;
  onApplyVatPreset:  (li: number, rate: number) => void;
  onStartVatEdit:    (li: number, v: number) => void;
  onSaveVatEdit:     (li: number) => void;
  onCancelVatEdit:   () => void;
  onVatDraftChange:  (v: string) => void;
}

function DetailPanel(props: DetailPanelProps) {
  const { expense } = props;
  const meta = CATEGORY_META[expense.cat];
  return (
    <div className="zn-card overflow-hidden">
      {/* Panel header */}
      <div className="px-5 pt-4 pb-3 border-b" style={{ borderColor: "var(--zn-line-soft)" }}>
        <p className="text-[11px] font-semibold uppercase tracking-[0.07em] flex items-center gap-2"
          style={{ color: "var(--zn-ink-3)" }}>
          <span className="size-1.5 rounded-full inline-block" style={{ background: meta.dot }} />
          {expense.cat} · {fmtDate(expense.date)}
        </p>
        <h2 className="mt-1 text-[18px] font-bold leading-snug" style={{ color: "var(--zn-ink)" }}>
          {expense.description}
        </h2>
        <p className="mt-0.5 text-[12px]" style={{ color: "var(--zn-ink-3)" }}>{expense.vendor}</p>
      </div>

      {/* 4-cell summary */}
      <div className="grid grid-cols-4 border-b" style={{ borderColor: "var(--zn-line-soft)" }}>
        {[
          { label: "GROSS",     value: fmtGBP(expense.gross),    color: "var(--zn-ink)" },
          { label: "NET",       value: fmtGBP(expense.net),      color: "var(--zn-ink)" },
          { label: "VAT",       value: fmtGBP(expense.vat),      color: "#2563EB" },
          { label: "ALLOWABLE", value: fmtGBP(expense.allowNet), color: expense.allowNet > 0 ? "#16A34A" : "#DC2626" },
        ].map(({ label, value, color }, i) => (
          <div key={label}
            className="px-3 py-3 text-center border-r last:border-0"
            style={{ borderColor: "var(--zn-line-soft)" }}>
            <p className="text-[9px] font-bold uppercase tracking-[0.08em]" style={{ color: "var(--zn-ink-3)" }}>{label}</p>
            <p className="mt-1 text-[13px] font-bold tabular-nums" style={{ color }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Scrollable detail */}
      <div className="max-h-[calc(100vh-340px)] overflow-y-auto">
        <DetailContent {...props} />
      </div>
    </div>
  );
}

function DetailContent({
  expense, editingVat, vatDraft,
  onCategoryChange, onToggleClaimable, onToggleReceipt,
  onApplyVatPreset, onStartVatEdit, onSaveVatEdit, onCancelVatEdit, onVatDraftChange,
}: DetailPanelProps) {
  const { id, cat, meta, pct, vatLines, hasReceipt,
          net, vat, gross, allowNet, confirmedVat, pendingVat, forced0, hasAnyVat } = expense;
  const isNotClaimable = pct === 0;
  const isPartial      = pct > 0 && pct < 100;
  const inputRef       = useRef<HTMLInputElement>(null);
  const editingThisId  = editingVat?.id === id;
  useEffect(() => { if (editingThisId) inputRef.current?.focus(); }, [editingThisId, editingVat?.lineIdx]);

  return (
    <div className="divide-y" style={{ borderColor: "var(--zn-line-soft)" }}>

      {/* VAT breakdown section */}
      {hasAnyVat && (
        <div className="px-5 py-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10.5px] font-bold uppercase tracking-[0.07em]" style={{ color: "var(--zn-ink-3)" }}>
              VAT Breakdown
            </p>
            <button type="button" className="flex items-center gap-1 text-[11px] font-medium hover:opacity-70"
              style={{ color: "var(--zn-ink-3)" }}>
              <Plus className="size-3" />Add line
            </button>
          </div>

          {/* Table header */}
          <div className="grid text-[9.5px] font-bold uppercase tracking-[0.07em] mb-1 px-0"
            style={{ gridTemplateColumns: "1fr 56px 80px 44px", color: "var(--zn-ink-3)" }}>
            <span>Description</span>
            <span className="text-center">Rate</span>
            <span className="text-right">VAT</span>
            <span className="text-right">Reclaim</span>
          </div>

          {/* VAT lines */}
          <div className="space-y-1">
            {vatLines.map((line, i) => {
              const isEditingThis = editingVat?.id === id && editingVat?.lineIdx === i;
              return (
                <div key={i}>
                  <div className="grid items-center py-1.5"
                    style={{ gridTemplateColumns: "1fr 56px 80px 44px" }}>
                    <span className="text-[12px] truncate pr-2" style={{ color: "var(--zn-ink)" }}>
                      {line.label}
                    </span>
                    <span className="text-center">
                      <span className="inline-block rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
                        style={{ background: "#EFF6FF", color: "#2563EB" }}>
                        {vatRateLabel(line.vatRate)}
                      </span>
                    </span>
                    <span className="text-right">
                      <button
                        type="button"
                        onClick={() => isEditingThis ? undefined : onStartVatEdit(i, line.vat)}
                        className="inline-flex items-center gap-1 text-[12px] font-semibold tabular-nums hover:opacity-70"
                        style={{ color: "var(--zn-ink)" }}
                      >
                        {fmtGBP(line.vat)}
                        {!isEditingThis && (
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ color: "var(--zn-ink-3)" }}>
                            <path d="M7 1L9 3L3.5 8.5L1 9L1.5 6.5L7 1Z" stroke="currentColor" strokeWidth="1.2" fill="none"/>
                          </svg>
                        )}
                      </button>
                    </span>
                    <span className="flex justify-end">
                      {line.reclaimable && line.vat > 0 && hasReceipt ? (
                        <Check className="size-4" style={{ color: "#16A34A" }} />
                      ) : line.reclaimable && line.vat > 0 ? (
                        <AlertTriangle className="size-4" style={{ color: "#C28800" }} />
                      ) : (
                        <X className="size-4" style={{ color: "var(--zn-ink-3)", opacity: 0.4 }} />
                      )}
                    </span>
                  </div>

                  {/* Inline edit — rate presets + custom amount */}
                  {isEditingThis && (
                    <div className="mt-1 mb-2 p-3 rounded-[10px] space-y-3"
                      style={{ background: "var(--zn-surface-2)", border: "1px solid var(--zn-line-soft)" }}>
                      {/* Rate presets */}
                      <div className="grid grid-cols-4 gap-1.5">
                        {VAT_PRESETS.map(p => {
                          const active = line.vatRate === p.rate;
                          return (
                            <button key={p.rate} type="button"
                              onClick={() => onApplyVatPreset(i, p.rate)}
                              className="py-2 rounded-[8px] text-[12px] font-semibold text-center transition-all"
                              style={{
                                background:  active ? "var(--zn-ink)" : "var(--zn-surface)",
                                color:       active ? "#fff" : "var(--zn-ink-2)",
                                border:      active ? "none" : "1px solid var(--zn-line-soft)",
                              }}>
                              {p.label}
                            </button>
                          );
                        })}
                      </div>
                      {/* Custom amount */}
                      <div>
                        <p className="text-[9.5px] font-bold uppercase tracking-[0.07em] mb-1.5"
                          style={{ color: "var(--zn-ink-3)" }}>Custom amount</p>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 flex items-center gap-1.5 rounded-[8px] border px-3 py-2"
                            style={{ borderColor: "var(--zn-line)", background: "var(--zn-surface)" }}>
                            <span className="text-[12px] font-semibold" style={{ color: "var(--zn-ink-3)" }}>£</span>
                            <input
                              ref={inputRef}
                              type="number" min="0" step="0.01"
                              value={vatDraft}
                              onChange={e => onVatDraftChange(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === "Enter")  onSaveVatEdit(i);
                                if (e.key === "Escape") onCancelVatEdit();
                              }}
                              className="flex-1 text-[13px] tabular-nums font-semibold min-w-0"
                              style={{ color: "var(--zn-ink)", background: "transparent", outline: "none", border: "none" }}
                            />
                          </div>
                          <button type="button" onClick={() => onSaveVatEdit(i)}
                            className="size-8 rounded-full flex items-center justify-center"
                            style={{ background: "var(--zn-ink)" }}>
                            <Check className="size-3.5 text-white" />
                          </button>
                          <button type="button" onClick={onCancelVatEdit}
                            className="size-8 rounded-full flex items-center justify-center border"
                            style={{ borderColor: "var(--zn-line-soft)" }}>
                            <X className="size-3.5" style={{ color: "var(--zn-ink-3)" }} />
                          </button>
                        </div>
                      </div>
                      {/* Total VAT reclaim */}
                      <div className="flex items-center justify-between text-[12px]">
                        <span style={{ color: "var(--zn-ink-3)" }}>Total VAT reclaim</span>
                        <span className="font-bold tabular-nums" style={{ color: "#2563EB" }}>
                          {fmtGBP(hasReceipt ? confirmedVat : 0)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Allowability */}
      <div className="px-5 py-4 space-y-2">
        <p className="text-[10.5px] font-bold uppercase tracking-[0.07em]" style={{ color: "var(--zn-ink-3)" }}>
          Allowability
        </p>
        {/* HMRC rule */}
        <div>
          <p className="text-[9.5px] font-bold uppercase tracking-[0.06em] mb-1" style={{ color: "var(--zn-ink-3)" }}>
            HMRC Rule
          </p>
          <p className="text-[12.5px] leading-relaxed"
            style={{
              color: isNotClaimable ? "#DC2626" : isPartial ? "#C28800" : "var(--zn-ink-2)",
            }}>
            {meta.hint}
          </p>
        </div>
        {/* Force not claimable toggle */}
        <div className="flex items-center justify-between gap-3 pt-1">
          <span className="text-[12.5px] font-medium" style={{ color: "var(--zn-ink)" }}>Force not claimable</span>
          <ClaimableToggle
            on={!forced0 && meta.allowablePct > 0}
            categoryIsZero={meta.allowablePct === 0 && !forced0}
            onToggle={() => onToggleClaimable()}
          />
        </div>
        {allowNet > 0 && (
          <p className="text-[11.5px]" style={{ color: "#16A34A" }}>
            {fmtGBP(allowNet)} claimable · est. {fmtGBP(r2(allowNet * 0.20))} tax saving at 20%
          </p>
        )}
      </div>

      {/* Receipt */}
      <div className="px-5 py-4 space-y-2">
        <p className="text-[10.5px] font-bold uppercase tracking-[0.07em]" style={{ color: "var(--zn-ink-3)" }}>
          Receipt
        </p>
        <button
          type="button"
          onClick={onToggleReceipt}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-[10px] border text-left transition-colors hover:opacity-80"
          style={{
            background:  hasReceipt ? "#F0FDF4" : "#FFFBEB",
            borderColor: hasReceipt ? "#16A34A44" : "#C2880044",
          }}>
          {hasReceipt
            ? <Paperclip     className="size-4 shrink-0" style={{ color: "#16A34A" }} />
            : <AlertTriangle className="size-4 shrink-0" style={{ color: "#C28800" }} />}
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold" style={{ color: hasReceipt ? "#16A34A" : "#C28800" }}>
              {hasReceipt ? "Invoice attached" : "No invoice"}
            </p>
            <p className="text-[11px] mt-0.5" style={{ color: hasReceipt ? "#16A34A" : "#C28800" }}>
              {hasReceipt ? "VAT reclaim confirmed" : vat > 0 ? `Attach to confirm ${fmtGBP(vat)} VAT reclaim` : "Required for VAT records"}
            </p>
          </div>
          <span className="shrink-0 px-3 py-1 rounded-full text-[11px] font-semibold text-white"
            style={{ background: hasReceipt ? "#16A34A" : "#C28800" }}>
            {hasReceipt ? "Remove" : "Upload"}
          </span>
        </button>
      </div>

    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function CategorySelect({ cat, onChange }: { cat: ExpenseCategory; onChange: (c: ExpenseCategory) => void }) {
  const meta = CATEGORY_META[cat];
  return (
    <div className="relative inline-flex items-center shrink-0">
      <span className="text-[11px] font-semibold pl-2 pr-5 py-0.5 rounded-full pointer-events-none whitespace-nowrap flex items-center gap-1.5"
        style={{ background: meta.bg, color: meta.color }}>
        <span className="size-1.5 rounded-full shrink-0" style={{ background: meta.dot }} />
        {cat}
      </span>
      <ChevronDown className="absolute right-1 size-3 pointer-events-none" style={{ color: meta.color }} />
      <select value={cat} onChange={e => onChange(e.target.value as ExpenseCategory)}
        className="absolute inset-0 opacity-0 cursor-pointer w-full"
        aria-label="Change category"
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
      className="relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors duration-150"
      style={{
        background: on ? "#16A34A" : "var(--zn-line)",
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
      <p className="text-[10px] font-bold uppercase tracking-[0.08em]" style={{ color: "var(--zn-ink-3)" }}>
        {label}
      </p>
      <p className="mt-2 text-[20px] font-bold tabular-nums leading-none" style={{ color: accent ?? "var(--zn-ink)" }}>
        {value}
      </p>
      {sub && <p className="mt-1 text-[10px]" style={{ color: "var(--zn-ink-3)" }}>{sub}</p>}
    </div>
  );
}
