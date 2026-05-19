"use client";

import { useState, useMemo } from "react";
import { ChevronDown, Info } from "lucide-react";

// ── Category definitions with HMRC allowability rules ────────────────────────

type ExpenseCategory =
  | "Software"
  | "Office"
  | "Travel"
  | "Communications"
  | "Insurance"
  | "Entertaining"
  | "Professional Services"
  | "Marketing"
  | "Equipment";

interface CategoryMeta {
  color:        string;
  bg:           string;
  allowablePct: number;   // 0 | 50 | 100
  vatClaimable: boolean;
  hint:         string;
}

const CATEGORY_META: Record<ExpenseCategory, CategoryMeta> = {
  "Software":              { color: "var(--zn-info)",   bg: "var(--zn-info-soft)",   allowablePct: 100, vatClaimable: true,  hint: "Business software and subscriptions — fully allowable for Self Assessment." },
  "Office":                { color: "var(--zn-ink-2)",  bg: "var(--zn-surface-2)",   allowablePct: 100, vatClaimable: true,  hint: "Office supplies and stationery — fully allowable for Self Assessment." },
  "Travel":                { color: "var(--zn-safe)",   bg: "var(--zn-safe-soft)",   allowablePct: 100, vatClaimable: false, hint: "Business travel is fully allowable. Most public transport is zero-rated so no VAT to reclaim." },
  "Communications":        { color: "var(--zn-accent)", bg: "var(--zn-accent-soft)", allowablePct: 50,  vatClaimable: true,  hint: "HMRC typically allows 50% for phone and broadband with mixed personal/business use. 50% of VAT is reclaimable." },
  "Insurance":             { color: "var(--zn-warn)",   bg: "var(--zn-warn-soft)",   allowablePct: 100, vatClaimable: false, hint: "Business insurance premiums are fully allowable. They are exempt from VAT so there is nothing to reclaim." },
  "Entertaining":          { color: "var(--zn-risk)",   bg: "var(--zn-risk-soft)",   allowablePct: 0,   vatClaimable: false, hint: "HMRC does not allow client entertainment as a business deduction. This expense does not reduce your tax bill." },
  "Professional Services": { color: "var(--zn-info)",   bg: "var(--zn-info-soft)",   allowablePct: 100, vatClaimable: true,  hint: "Accountant, legal and professional fees are fully allowable for Self Assessment." },
  "Marketing":             { color: "var(--zn-ink-2)",  bg: "var(--zn-surface-2)",   allowablePct: 100, vatClaimable: true,  hint: "Advertising and marketing spend is fully allowable for Self Assessment." },
  "Equipment":             { color: "var(--zn-safe)",   bg: "var(--zn-safe-soft)",   allowablePct: 100, vatClaimable: true,  hint: "Business equipment is fully allowable via the Annual Investment Allowance (AIA)." },
};

const CATEGORY_LIST = Object.keys(CATEGORY_META) as ExpenseCategory[];

// ── Demo expense data ────────────────────────────────────────────────────────

interface DemoExpense {
  id:          string;
  date:        string;
  description: string;
  category:    ExpenseCategory;
  net:         number;
  vat:         number;
  gross:       number;
}

const BASE_EXPENSES: DemoExpense[] = [
  { id: "e-1",  date: "2026-05-12", description: "Adobe Creative Cloud",         category: "Software",              net:  49.99, vat: 10.00, gross:  59.99 },
  { id: "e-2",  date: "2026-05-10", description: "Client lunch — BluePeak",      category: "Entertaining",          net:  68.00, vat:  0.00, gross:  68.00 },
  { id: "e-3",  date: "2026-05-07", description: "Office supplies — Ryman",      category: "Office",                net:  24.50, vat:  4.90, gross:  29.40 },
  { id: "e-4",  date: "2026-04-28", description: "Broadband — BT Business",      category: "Communications",        net:  42.00, vat:  8.40, gross:  50.40 },
  { id: "e-5",  date: "2026-04-22", description: "Train — London client visit",  category: "Travel",                net:  87.40, vat:  0.00, gross:  87.40 },
  { id: "e-6",  date: "2026-04-18", description: "GitHub Pro",                   category: "Software",              net:   3.99, vat:  0.80, gross:   4.79 },
  { id: "e-7",  date: "2026-04-15", description: "Printer ink cartridges",       category: "Office",                net:  31.20, vat:  6.24, gross:  37.44 },
  { id: "e-8",  date: "2026-04-09", description: "Mobile phone bill",            category: "Communications",        net:  35.00, vat:  7.00, gross:  42.00 },
  { id: "e-9",  date: "2026-04-05", description: "Professional indemnity ins.",  category: "Insurance",             net: 220.00, vat:  0.00, gross: 220.00 },
  { id: "e-10", date: "2026-04-02", description: "Canva Pro subscription",       category: "Software",              net:   9.99, vat:  2.00, gross:  11.99 },
  { id: "e-11", date: "2026-03-28", description: "Google Ads — March",           category: "Marketing",             net: 180.00, vat: 36.00, gross: 216.00 },
  { id: "e-12", date: "2026-03-20", description: "Accountant — Q4 filing",       category: "Professional Services", net: 350.00, vat: 70.00, gross: 420.00 },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtGBP(n: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency", currency: "GBP", minimumFractionDigits: 2,
  }).format(n);
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
function r2(n: number) { return Math.round(n * 100) / 100; }

// ── Main page component ───────────────────────────────────────────────────────

type Tab = "all" | "claimable" | "vat";

export default function DemoExpensesPage() {
  const [activeTab,          setActiveTab]          = useState<Tab>("all");
  const [categoryOverrides,  setCategoryOverrides]  = useState<Record<string, ExpenseCategory>>({});
  const [notClaimable,       setNotClaimable]       = useState<Set<string>>(new Set());
  const [openHints,          setOpenHints]          = useState<Set<string>>(new Set());
  const [catFilter,          setCatFilter]          = useState<ExpenseCategory | null>(null);

  // Resolve per-expense effective values
  const expenses = useMemo(() => BASE_EXPENSES.map((e) => {
    const cat      = categoryOverrides[e.id] ?? e.category;
    const meta     = CATEGORY_META[cat];
    const forced0  = notClaimable.has(e.id);
    const pct      = forced0 ? 0 : meta.allowablePct;
    const allowNet = r2(e.net * (pct / 100));
    const allowVat = r2(meta.vatClaimable && !forced0 ? e.vat * (pct / 100) : 0);
    return { ...e, cat, meta, pct, allowNet, allowVat, forced0 };
  }), [categoryOverrides, notClaimable]);

  const claimableExpenses = expenses.filter((e) => e.pct > 0);
  const vatExpenses       = expenses.filter((e) => e.allowVat > 0);

  // Summary totals
  const totalGross      = r2(expenses.reduce((s, e) => s + e.gross, 0));
  const totalAllowNet   = r2(expenses.reduce((s, e) => s + e.allowNet, 0));
  const totalVatClaim   = r2(expenses.reduce((s, e) => s + e.allowVat, 0));
  const totalDisallowed = r2(expenses.reduce((s, e) => s + (e.net - e.allowNet), 0));
  const taxSaving20     = r2(totalAllowNet * 0.20);

  function handleCategoryChange(id: string, cat: ExpenseCategory) {
    setCategoryOverrides((prev) => ({ ...prev, [id]: cat }));
    // Clear any manual not-claimable override when category changes
    setNotClaimable((prev) => { const s = new Set(prev); s.delete(id); return s; });
  }

  function toggleClaimable(id: string) {
    setNotClaimable((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id); else s.add(id);
      return s;
    });
  }

  function toggleHint(id: string) {
    setOpenHints((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id); else s.add(id);
      return s;
    });
  }

  // Category bar chart data
  const catTotals = useMemo(() => {
    const m: Record<string, number> = {};
    expenses.forEach((e) => { m[e.cat] = (m[e.cat] ?? 0) + e.net; });
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [expenses]);
  const maxCatTotal = catTotals[0]?.[1] ?? 1;

  // Active tab list + filter
  const baseList =
    activeTab === "claimable" ? claimableExpenses :
    activeTab === "vat"       ? vatExpenses :
    expenses;

  const filtered = catFilter ? baseList.filter((e) => e.cat === catFilter) : baseList;

  // Group by category preserving spend-order
  const grouped = useMemo(() => {
    const g: Record<string, typeof filtered> = {};
    filtered.forEach((e) => { if (!g[e.cat]) g[e.cat] = []; g[e.cat].push(e); });
    return g;
  }, [filtered]);

  return (
    <div className="space-y-6">

      {/* ── Header ────────────────────────────────────────────────────── */}
      <div>
        <p className="zn-section-label">Demo · Books</p>
        <h1
          className="text-[28px] font-semibold tracking-[-0.02em] leading-[1.1] mt-1"
          style={{ color: "var(--zn-ink)" }}
        >
          Expenses
        </h1>
        <p className="mt-1 text-[13.5px]" style={{ color: "var(--zn-ink-3)" }}>
          Track allowable business expenses to reduce your Self Assessment bill.
          Change any category or claimability below — totals update instantly.
        </p>
      </div>

      {/* ── Summary stat cards ────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard label="Total gross"     value={fmtGBP(totalGross)} />
        <StatCard label="Claimable net"   value={fmtGBP(totalAllowNet)} accent="var(--zn-safe)" />
        <StatCard label="Est. tax saving" value={fmtGBP(taxSaving20)}  accent="var(--zn-safe)" sub="@ 20% basic rate" />
        <StatCard label="VAT reclaimable" value={fmtGBP(totalVatClaim)} accent="var(--zn-accent)" />
        <StatCard label="Not allowable"   value={fmtGBP(totalDisallowed)} accent="var(--zn-risk)" sub="e.g. entertaining" />
      </div>

      {/* ── Category breakdown bar chart ──────────────────────────────── */}
      <div className="zn-card px-5 py-4">
        <p
          className="text-[11px] font-semibold uppercase tracking-[0.07em] mb-3"
          style={{ color: "var(--zn-ink-3)" }}
        >
          Spend by category — click to filter
        </p>
        <div className="space-y-2.5">
          {catTotals.map(([cat, amt]) => {
            const meta   = CATEGORY_META[cat as ExpenseCategory];
            const active = catFilter === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setCatFilter(active ? null : cat as ExpenseCategory)}
                className="w-full flex items-center gap-3 group rounded-lg py-0.5 transition-opacity"
              >
                <span
                  className="w-[130px] text-left text-[11.5px] font-medium shrink-0 truncate"
                  style={{ color: active ? meta.color : "var(--zn-ink-3)" }}
                >
                  {cat}
                </span>
                <div
                  className="flex-1 h-2 rounded-full overflow-hidden"
                  style={{ background: "var(--zn-surface-2)" }}
                >
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width:      `${Math.round((amt / maxCatTotal) * 100)}%`,
                      background: active ? meta.color : meta.bg,
                      outline:    `1.5px solid ${meta.color}`,
                    }}
                  />
                </div>
                <span
                  className="w-20 text-right text-[12px] font-semibold tabular-nums shrink-0"
                  style={{ color: active ? meta.color : "var(--zn-ink-2)" }}
                >
                  {fmtGBP(amt)}
                </span>
              </button>
            );
          })}
        </div>
        {catFilter && (
          <button
            type="button"
            onClick={() => setCatFilter(null)}
            className="mt-3 text-[11px] underline underline-offset-2 hover:no-underline transition-all"
            style={{ color: "var(--zn-ink-3)" }}
          >
            Clear filter ×
          </button>
        )}
      </div>

      {/* ── Tab bar ────────────────────────────────────────────────────── */}
      <div
        className="flex gap-1 p-1 rounded-[12px]"
        style={{ background: "var(--zn-surface-2)" }}
      >
        {([
          ["all",       "All expenses",    expenses.length],
          ["claimable", "Claimable",       claimableExpenses.length],
          ["vat",       "VAT reclaimable", vatExpenses.length],
        ] as [Tab, string, number][]).map(([id, label, count]) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-[9px] py-2 text-[12.5px] font-medium transition-all duration-150"
            style={{
              background: activeTab === id ? "var(--zn-surface)" : "transparent",
              color:      activeTab === id ? "var(--zn-ink)"     : "var(--zn-ink-3)",
              boxShadow:  activeTab === id ? "var(--zn-shadow-soft)" : "none",
            }}
          >
            {label}
            <span
              className="text-[10px] rounded-full px-1.5 py-0.5 font-semibold tabular-nums"
              style={{
                background: activeTab === id ? "var(--zn-surface-2)" : "transparent",
                color:      activeTab === id ? "var(--zn-ink-2)"     : "var(--zn-ink-3)",
              }}
            >
              {count}
            </span>
          </button>
        ))}
      </div>

      {/* ── Tab-level summary strip ─────────────────────────────────────── */}
      {activeTab === "claimable" && (
        <div
          className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 rounded-[12px] text-[12.5px]"
          style={{ background: "var(--zn-safe-soft)", color: "var(--zn-safe)" }}
        >
          <span className="font-semibold">{fmtGBP(totalAllowNet)} claimable net</span>
          <span style={{ color: "var(--zn-ink-3)" }}>·</span>
          <span>Est. <strong>{fmtGBP(taxSaving20)}</strong> off your tax bill at 20%</span>
          <span style={{ color: "var(--zn-ink-3)" }} className="hidden sm:inline">·</span>
          <span className="hidden sm:inline" style={{ color: "var(--zn-ink-3)" }}>
            Higher-rate taxpayer? Est. {fmtGBP(r2(totalAllowNet * 0.4))} saving at 40%
          </span>
        </div>
      )}
      {activeTab === "vat" && (
        <div
          className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 rounded-[12px] text-[12.5px]"
          style={{ background: "var(--zn-accent-soft)", color: "var(--zn-accent)" }}
        >
          <span className="font-semibold">{fmtGBP(totalVatClaim)} reclaimable VAT</span>
          <span style={{ color: "var(--zn-ink-3)" }}>·</span>
          <span style={{ color: "var(--zn-ink-3)" }}>
            Only applicable if your business is VAT-registered. Offsets your VAT bill.
          </span>
        </div>
      )}

      {/* ── Expense list grouped by category ─────────────────────────── */}
      {Object.keys(grouped).length === 0 ? (
        <div
          className="zn-card px-5 py-12 text-center text-[13.5px]"
          style={{ color: "var(--zn-ink-3)" }}
        >
          No expenses in this view.
          {catFilter && (
            <button
              type="button"
              onClick={() => setCatFilter(null)}
              className="ml-2 underline underline-offset-2"
            >
              Clear filter
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([cat, rows]) => {
            const meta       = CATEGORY_META[cat as ExpenseCategory];
            const groupNet   = r2(rows.reduce((s, e) => s + e.net, 0));
            const groupAllow = r2(rows.reduce((s, e) => s + e.allowNet, 0));
            const groupVat   = r2(rows.reduce((s, e) => s + e.allowVat, 0));

            return (
              <div key={cat} className="zn-card overflow-hidden">

                {/* Category group header */}
                <div
                  className="flex items-center justify-between gap-3 px-5 py-2.5 border-b"
                  style={{ borderColor: "var(--zn-line-soft)", background: "var(--zn-surface-2)" }}
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className="text-[11.5px] font-semibold px-2.5 py-0.5 rounded-full"
                      style={{ background: meta.bg, color: meta.color }}
                    >
                      {cat}
                    </span>
                    {meta.allowablePct < 100 && (
                      <span
                        className="text-[10.5px] font-medium px-2 py-0.5 rounded-full"
                        style={{
                          background: meta.allowablePct === 0 ? "var(--zn-risk-soft)" : "var(--zn-warn-soft)",
                          color:      meta.allowablePct === 0 ? "var(--zn-risk)"      : "var(--zn-warn)",
                        }}
                      >
                        {meta.allowablePct === 0 ? "Not allowable" : `${meta.allowablePct}% allowable`}
                      </span>
                    )}
                    <span className="text-[10.5px]" style={{ color: "var(--zn-ink-3)" }}>
                      {rows.length} item{rows.length !== 1 ? "s" : ""}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    {activeTab === "vat" ? (
                      <span className="text-[12.5px] font-semibold tabular-nums" style={{ color: "var(--zn-accent)" }}>
                        {fmtGBP(groupVat)} VAT
                      </span>
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

                {/* Column headers — desktop only */}
                <div
                  className="hidden sm:grid px-5 py-2 border-b text-[10.5px] font-semibold uppercase tracking-[0.06em]"
                  style={{
                    gridTemplateColumns: "72px 1fr 160px 130px 140px auto",
                    borderColor: "var(--zn-line-soft)",
                    color: "var(--zn-ink-3)",
                  }}
                >
                  <span>Date</span>
                  <span>Description</span>
                  <span>Category</span>
                  <span>Allowability</span>
                  <span className="text-right">Amount</span>
                  <span className="text-right">Claimable</span>
                </div>

                {/* Expense rows */}
                <div className="divide-y" style={{ borderColor: "var(--zn-line-soft)" }}>
                  {rows.map((e) => (
                    <ExpenseRow
                      key={e.id}
                      expense={e}
                      activeTab={activeTab}
                      hintOpen={openHints.has(e.id)}
                      onToggleHint={() => toggleHint(e.id)}
                      onCategoryChange={(cat) => handleCategoryChange(e.id, cat)}
                      onToggleClaimable={() => toggleClaimable(e.id)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Footer disclaimer ─────────────────────────────────────────── */}
      <p className="text-[11.5px] pb-2" style={{ color: "var(--zn-ink-3)" }}>
        Sample data only. Allowability rules follow HMRC guidelines for UK sole traders.
        Always confirm with your accountant.{" "}
        <strong>Tax saving uses basic rate (20%)</strong> — higher-rate taxpayers use 40%.
      </p>
    </div>
  );
}

// ── Expense row ───────────────────────────────────────────────────────────────

interface RowExpense extends DemoExpense {
  cat:      ExpenseCategory;
  meta:     CategoryMeta;
  pct:      number;
  allowNet: number;
  allowVat: number;
  forced0:  boolean;
}

function ExpenseRow({
  expense, activeTab, hintOpen,
  onToggleHint, onCategoryChange, onToggleClaimable,
}: {
  expense:           RowExpense;
  activeTab:         Tab;
  hintOpen:          boolean;
  onToggleHint:      () => void;
  onCategoryChange:  (c: ExpenseCategory) => void;
  onToggleClaimable: () => void;
}) {
  const { date, description, cat, meta, pct, allowNet, allowVat, forced0, net, vat, gross } = expense;

  const isNotClaimable = pct === 0;
  const isPartial      = pct > 0 && pct < 100;

  const badgeColor = isNotClaimable ? "var(--zn-risk)" : isPartial ? "var(--zn-warn)" : "var(--zn-safe)";
  const badgeBg    = isNotClaimable ? "var(--zn-risk-soft)" : isPartial ? "var(--zn-warn-soft)" : "var(--zn-safe-soft)";
  const badgeLabel = isNotClaimable ? "Not allowable" : isPartial ? `${pct}% allowable` : "Allowable";

  return (
    <div>
      {/* ── Desktop row ── */}
      <div
        className="hidden sm:grid items-center gap-3 px-5 py-3 transition-opacity"
        style={{
          gridTemplateColumns: "72px 1fr 160px 130px 140px auto",
          opacity: isNotClaimable && activeTab === "claimable" ? 0.45 : 1,
        }}
      >
        <span className="text-[11.5px] tabular-nums" style={{ color: "var(--zn-ink-3)" }}>
          {fmtDate(date)}
        </span>

        <p
          className="text-[13px] font-medium truncate"
          className={`text-[13px] font-medium truncate${isNotClaimable ? " line-through" : ""}`}
          style={{ color: isNotClaimable ? "var(--zn-ink-3)" : "var(--zn-ink)" }}
        >
          {description}
        </p>

        <CategorySelect cat={cat} onChange={onCategoryChange} />

        <AllowBadge
          label={badgeLabel} color={badgeColor} bg={badgeBg}
          hintOpen={hintOpen} onToggleHint={onToggleHint}
        />

        <div className="text-right">
          {activeTab === "vat" ? (
            <>
              <p className="text-[13px] font-semibold tabular-nums" style={{ color: "var(--zn-accent)" }}>
                {allowVat > 0 ? fmtGBP(allowVat) : "—"}
              </p>
              {vat > 0 && <p className="text-[10.5px] tabular-nums" style={{ color: "var(--zn-ink-3)" }}>of {fmtGBP(vat)} total</p>}
            </>
          ) : activeTab === "claimable" ? (
            <>
              <p className="text-[13px] font-semibold tabular-nums" style={{ color: isNotClaimable ? "var(--zn-risk)" : "var(--zn-safe)" }}>
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
              {vat > 0 && (
                <p className="text-[10.5px] tabular-nums" style={{ color: meta.vatClaimable && !forced0 ? "var(--zn-accent)" : "var(--zn-ink-3)" }}>
                  +{fmtGBP(vat)} VAT{!meta.vatClaimable ? " (n/a)" : ""}
                </p>
              )}
            </>
          )}
        </div>

        <div className="flex justify-end">
          <ClaimableToggle
            on={!forced0 && meta.allowablePct > 0}
            categoryIsZero={meta.allowablePct === 0 && !forced0}
            onToggle={onToggleClaimable}
          />
        </div>
      </div>

      {/* ── Mobile card ── */}
      <div
        className="sm:hidden px-4 py-3.5 space-y-2 transition-opacity"
        style={{ opacity: isNotClaimable && activeTab === "claimable" ? 0.45 : 1 }}
      >
        {/* Top row: description + gross */}
        <div className="flex items-start justify-between gap-3">
          <p
            className="text-[13px] font-medium leading-snug flex-1"
            className={`text-[13px] font-medium leading-snug flex-1${isNotClaimable ? " line-through" : ""}`}
            style={{ color: isNotClaimable ? "var(--zn-ink-3)" : "var(--zn-ink)" }}
          >
            {description}
          </p>
          <div className="text-right shrink-0">
            <p className="text-[13px] font-semibold tabular-nums" style={{ color: "var(--zn-ink)" }}>
              {fmtGBP(gross)}
            </p>
            {vat > 0 && (
              <p className="text-[10px] tabular-nums" style={{ color: "var(--zn-ink-3)" }}>
                +{fmtGBP(vat)} VAT
              </p>
            )}
          </div>
        </div>

        {/* Second row: date, category, allowability */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10.5px]" style={{ color: "var(--zn-ink-3)" }}>{fmtDate(date)}</span>
          <span style={{ color: "var(--zn-ink-3)" }}>·</span>
          <CategorySelect cat={cat} onChange={onCategoryChange} />
          <AllowBadge
            label={badgeLabel} color={badgeColor} bg={badgeBg}
            hintOpen={hintOpen} onToggleHint={onToggleHint}
          />
        </div>

        {/* Third row: claimable toggle */}
        <div className="flex items-center gap-2">
          <ClaimableToggle
            on={!forced0 && meta.allowablePct > 0}
            categoryIsZero={meta.allowablePct === 0 && !forced0}
            onToggle={onToggleClaimable}
          />
          <span className="text-[11px]" style={{ color: "var(--zn-ink-3)" }}>
            {forced0 ? "Marked not claimable" : meta.allowablePct === 0 ? "Not allowable (HMRC)" : "Claimable"}
          </span>
          {activeTab !== "vat" && allowNet > 0 && (
            <>
              <span style={{ color: "var(--zn-ink-3)" }}>·</span>
              <span className="text-[11px] font-medium" style={{ color: "var(--zn-safe)" }}>
                {fmtGBP(allowNet)} claimable
              </span>
            </>
          )}
        </div>
      </div>

      {/* HMRC hint inline panel */}
      {hintOpen && (
        <div
          className="mx-4 sm:mx-5 mb-3 px-3.5 py-2.5 rounded-[10px] text-[11.5px] leading-relaxed"
          style={{ background: "var(--zn-warn-soft)", color: "var(--zn-warn)" }}
        >
          <strong>HMRC note · {cat}:</strong> {meta.hint}
        </div>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function CategorySelect({
  cat, onChange,
}: {
  cat:      ExpenseCategory;
  onChange: (c: ExpenseCategory) => void;
}) {
  const meta = CATEGORY_META[cat];
  return (
    <div className="relative inline-flex items-center shrink-0">
      {/* Visual chip */}
      <span
        className="text-[11px] font-semibold pl-2.5 pr-5 py-0.5 rounded-full pointer-events-none whitespace-nowrap"
        style={{ background: meta.bg, color: meta.color }}
      >
        {cat}
      </span>
      {/* Dropdown arrow */}
      <ChevronDown
        className="absolute right-1.5 size-2.5 pointer-events-none"
        style={{ color: meta.color }}
      />
      {/* Invisible native select overlaid on the chip */}
      <select
        value={cat}
        onChange={(e) => onChange(e.target.value as ExpenseCategory)}
        className="absolute inset-0 opacity-0 cursor-pointer w-full"
        aria-label="Change expense category"
        title="Change category"
      >
        {CATEGORY_LIST.map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>
    </div>
  );
}

function AllowBadge({
  label, color, bg, hintOpen, onToggleHint,
}: {
  label:        string;
  color:        string;
  bg:           string;
  hintOpen:     boolean;
  onToggleHint: () => void;
}) {
  return (
    <div className="inline-flex items-center gap-1 shrink-0">
      <span
        className="text-[10.5px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap"
        style={{ background: bg, color }}
      >
        {label}
      </span>
      <button
        type="button"
        onClick={onToggleHint}
        title="HMRC guidance for this category"
        className="rounded-full p-0.5 hover:opacity-70 transition-opacity"
        style={{ color: hintOpen ? color : "var(--zn-ink-3)" }}
      >
        <Info className="size-2.5" />
      </button>
    </div>
  );
}

function ClaimableToggle({
  on, categoryIsZero, onToggle,
}: {
  on:            boolean;
  categoryIsZero:boolean;
  onToggle:      () => void;
}) {
  return (
    <button
      type="button"
      onClick={categoryIsZero ? undefined : onToggle}
      title={
        categoryIsZero
          ? "HMRC rules prevent claiming this category — change the category to override"
          : on ? "Click to mark as not claimable" : "Click to mark as claimable"
      }
      className="relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors duration-150"
      style={{
        background: on ? "var(--zn-safe)" : "var(--zn-line)",
        opacity:    categoryIsZero ? 0.3 : 1,
        cursor:     categoryIsZero ? "not-allowed" : "pointer",
      }}
    >
      <span
        className="inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-150 mt-0.5"
        style={{ transform: on ? "translateX(17px)" : "translateX(2px)" }}
      />
    </button>
  );
}

function StatCard({
  label, value, accent, sub,
}: {
  label:   string;
  value:   string;
  accent?: string;
  sub?:    string;
}) {
  return (
    <div className="zn-card p-4">
      <p
        className="text-[10.5px] font-semibold uppercase tracking-[0.07em]"
        style={{ color: "var(--zn-ink-3)" }}
      >
        {label}
      </p>
      <p
        className="mt-2 text-[20px] font-bold tabular-nums leading-none"
        style={{ color: accent ?? "var(--zn-ink)" }}
      >
        {value}
      </p>
      {sub && (
        <p className="mt-1 text-[10px]" style={{ color: "var(--zn-ink-3)" }}>{sub}</p>
      )}
    </div>
  );
}
