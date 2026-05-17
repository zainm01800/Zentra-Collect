"use client";

/**
 * src/components/expense-page-client.tsx
 *
 * Full expense tracking UI — client component.
 *
 * Because many users are in demo / offline mode (no Supabase), expenses are
 * persisted to localStorage under "zentra.expenses.v1".  When Supabase IS
 * configured the server actions are called, but the local state always reflects
 * the optimistic result immediately.
 *
 * Features:
 *   - Add expense with category pill-picker, amount, date, description
 *   - Monthly grouped list with per-month subtotals
 *   - Category breakdown bar (top 5 by spend)
 *   - Delete individual entries
 *   - Running 12-month total shown in hero
 */

import { useState, useEffect, useCallback } from "react";
import {
  ChevronDown,
  ChevronUp,
  PlusCircle,
  Trash2,
  X,
} from "lucide-react";
import { addExpense, deleteExpense }  from "@/actions/expenses";
import type { ExpenseEntry }          from "@/actions/expenses";
import { EXPENSE_CATEGORIES }         from "@/lib/expense-categories";

// ── Constants ─────────────────────────────────────────────────────────────────

const STORAGE_KEY = "zentra.expenses.v1";

// Colour palette for categories (cycles if more than defined)
const CAT_COLOURS = [
  "#c88a1e", // amber
  "#3b82f6", // blue
  "#10b981", // green
  "#f43f5e", // rose
  "#8b5cf6", // violet
  "#f97316", // orange
  "#06b6d4", // cyan
  "#84cc16", // lime
  "#ec4899", // pink
  "#6b7280", // grey
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtGBP(n: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency", currency: "GBP",
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(n);
}

function fmtDate(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  });
}

function monthLabel(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-GB", {
    month: "long", year: "numeric",
  });
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function loadFromStorage(): ExpenseEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ExpenseEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveToStorage(entries: ExpenseEntry[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

/** Group expenses descending by year-month */
function groupByMonth(entries: ExpenseEntry[]): { ym: string; entries: ExpenseEntry[] }[] {
  const map = new Map<string, ExpenseEntry[]>();
  for (const e of entries) {
    const ym = e.date.slice(0, 7);
    if (!map.has(ym)) map.set(ym, []);
    map.get(ym)!.push(e);
  }
  return Array.from(map.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([ym, entries]) => ({ ym, entries }));
}

/** Category totals sorted by spend descending */
function categoryTotals(entries: ExpenseEntry[]): { category: string; total: number }[] {
  const map: Record<string, number> = {};
  for (const e of entries) {
    map[e.category] = (map[e.category] ?? 0) + e.amount;
  }
  return Object.entries(map)
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total);
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function CategoryPill({
  cat,
  selected,
  onClick,
}: {
  cat: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center px-3 py-1.5 rounded-full text-[12px] font-medium border transition-colors"
      style={{
        background:   selected ? "var(--zn-ink)" : "transparent",
        color:        selected ? "var(--zn-surface)" : "var(--zn-ink-2)",
        borderColor:  selected ? "var(--zn-ink)" : "var(--zn-line)",
      }}
    >
      {cat}
    </button>
  );
}

function AddExpensePanel({ onAdd }: { onAdd: (e: ExpenseEntry) => void }) {
  const [open, setOpen]           = useState(false);
  const [category, setCategory]   = useState<string>(EXPENSE_CATEGORIES[0]);
  const [amount, setAmount]       = useState("");
  const [date, setDate]           = useState(todayISO());
  const [description, setDesc]    = useState("");
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) { setError("Enter a valid amount."); return; }
    if (!category) { setError("Select a category."); return; }

    setSaving(true);
    setError(null);

    const newEntry: ExpenseEntry = {
      id:          crypto.randomUUID(),
      date,
      amount:      amt,
      category,
      description: description.trim(),
    };

    // Call server action (no-ops gracefully without Supabase)
    await addExpense({ date, amount: amt, category, description: description.trim() });

    onAdd(newEntry);
    setAmount("");
    setDesc("");
    setDate(todayISO());
    setSaving(false);
    setOpen(false);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-semibold transition-colors"
        style={{ background: "var(--zn-ink)", color: "var(--zn-surface)" }}
      >
        <PlusCircle className="size-4" />
        Add expense
      </button>
    );
  }

  return (
    <div
      className="rounded-[14px] border"
      style={{ borderColor: "var(--zn-line)", background: "var(--zn-bg-2)" }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b"
        style={{ borderColor: "var(--zn-line-soft)" }}
      >
        <span className="text-[13.5px] font-semibold" style={{ color: "var(--zn-ink)" }}>
          New expense
        </span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded p-1 transition-colors hover:bg-[#ece3cc] dark:hover:bg-[#28231c]"
          aria-label="Close"
        >
          <X className="size-3.5" style={{ color: "var(--zn-ink-3)" }} />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="p-4 space-y-4">
        {/* Category */}
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wide mb-2"
            style={{ color: "var(--zn-ink-3)" }}>
            Category
          </label>
          <div className="flex flex-wrap gap-2">
            {EXPENSE_CATEGORIES.map((cat) => (
              <CategoryPill
                key={cat}
                cat={cat}
                selected={category === cat}
                onClick={() => setCategory(cat)}
              />
            ))}
          </div>
        </div>

        {/* Amount + Date */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="exp-amount" className="block text-[11px] font-semibold uppercase tracking-wide mb-1"
              style={{ color: "var(--zn-ink-3)" }}>
              Amount (£)
            </label>
            <input
              id="exp-amount"
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              required
              className="w-full rounded-[8px] border px-3 py-2 text-[13px]"
              style={{
                borderColor: "var(--zn-line)",
                background:  "var(--zn-surface)",
                color:       "var(--zn-ink)",
              }}
            />
          </div>
          <div>
            <label htmlFor="exp-date" className="block text-[11px] font-semibold uppercase tracking-wide mb-1"
              style={{ color: "var(--zn-ink-3)" }}>
              Date
            </label>
            <input
              id="exp-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className="w-full rounded-[8px] border px-3 py-2 text-[13px]"
              style={{
                borderColor: "var(--zn-line)",
                background:  "var(--zn-surface)",
                color:       "var(--zn-ink)",
              }}
            />
          </div>
        </div>

        {/* Description */}
        <div>
          <label htmlFor="exp-desc" className="block text-[11px] font-semibold uppercase tracking-wide mb-1"
            style={{ color: "var(--zn-ink-3)" }}>
            Description <span className="normal-case font-normal">(optional)</span>
          </label>
          <input
            id="exp-desc"
            type="text"
            value={description}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="e.g. AWS bill, train to client meeting…"
            className="w-full rounded-[8px] border px-3 py-2 text-[13px]"
            style={{
              borderColor: "var(--zn-line)",
              background:  "var(--zn-surface)",
              color:       "var(--zn-ink)",
            }}
          />
        </div>

        {error && (
          <p className="text-[12px]" style={{ color: "var(--zn-risk)" }}>{error}</p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="px-4 py-2 rounded-full text-[13px] font-medium border transition-colors"
            style={{ borderColor: "var(--zn-line)", color: "var(--zn-ink-2)" }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded-full text-[13px] font-semibold transition-opacity disabled:opacity-50"
            style={{ background: "var(--zn-ink)", color: "var(--zn-surface)" }}
          >
            {saving ? "Saving…" : "Save expense"}
          </button>
        </div>
      </form>
    </div>
  );
}

/** Horizontal stacked bar of top categories */
function CategoryBreakdown({ entries }: { entries: ExpenseEntry[] }) {
  const totals = categoryTotals(entries).slice(0, 5);
  const grandTotal = totals.reduce((s, t) => s + t.total, 0);
  if (grandTotal <= 0) return null;

  return (
    <div
      className="rounded-[14px] border px-5 py-4"
      style={{ borderColor: "var(--zn-line)", background: "var(--zn-bg-2)" }}
    >
      <span
        className="text-[10.5px] font-semibold uppercase tracking-[0.08em]"
        style={{ color: "var(--zn-ink-3)" }}
      >
        By category
      </span>

      {/* Stacked bar */}
      <div className="mt-3 flex h-[8px] w-full overflow-hidden rounded-full gap-[2px]">
        {totals.map((t, i) => (
          <div
            key={t.category}
            title={`${t.category}: ${fmtGBP(t.total)}`}
            style={{
              width:      `${(t.total / grandTotal) * 100}%`,
              background: CAT_COLOURS[i % CAT_COLOURS.length],
              borderRadius: "9999px",
            }}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="mt-3 space-y-1.5">
        {totals.map((t, i) => (
          <div key={t.category} className="flex items-center gap-2">
            <span
              className="size-2.5 rounded-full flex-shrink-0"
              style={{ background: CAT_COLOURS[i % CAT_COLOURS.length] }}
            />
            <span className="flex-1 text-[12px]" style={{ color: "var(--zn-ink-2)" }}>
              {t.category}
            </span>
            <span className="text-[12px] font-medium tabular-nums" style={{ color: "var(--zn-ink)" }}>
              {fmtGBP(t.total)}
            </span>
            <span className="text-[10.5px] w-[32px] text-right" style={{ color: "var(--zn-ink-3)" }}>
              {Math.round((t.total / grandTotal) * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Collapsible month group */
function MonthGroup({
  ym,
  entries,
  onDelete,
}: {
  ym:       string;
  entries:  ExpenseEntry[];
  onDelete: (id: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const total = entries.reduce((s, e) => s + e.amount, 0);

  return (
    <div
      className="rounded-[14px] border overflow-hidden"
      style={{ borderColor: "var(--zn-line)", background: "var(--zn-bg-2)" }}
    >
      {/* Month header */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 transition-colors hover:bg-[#f3ecd8] dark:hover:bg-[#2d2820]"
      >
        <span className="text-[13px] font-semibold" style={{ color: "var(--zn-ink)" }}>
          {monthLabel(ym)}
        </span>
        <div className="flex items-center gap-3">
          <span
            className="text-[13px] font-bold tabular-nums"
            style={{ color: "var(--zn-ink)" }}
          >
            {fmtGBP(total)}
          </span>
          {open
            ? <ChevronUp  className="size-3.5" style={{ color: "var(--zn-ink-3)" }} />
            : <ChevronDown className="size-3.5" style={{ color: "var(--zn-ink-3)" }} />}
        </div>
      </button>

      {/* Expense rows */}
      {open && (
        <div
          className="border-t divide-y"
          style={{ borderColor: "var(--zn-line-soft)" }}
        >
          {entries
            .slice()
            .sort((a, b) => b.date.localeCompare(a.date))
            .map((e) => (
              <div
                key={e.id}
                className="flex items-center gap-3 px-4 py-3 group"
              >
                {/* Category dot */}
                <span
                  className="size-2 rounded-full flex-shrink-0"
                  style={{
                    background: CAT_COLOURS[
                      EXPENSE_CATEGORIES.indexOf(e.category as typeof EXPENSE_CATEGORIES[number]) % CAT_COLOURS.length
                    ] ?? "var(--zn-ink-3)",
                  }}
                />

                <div className="flex-1 min-w-0">
                  <p className="text-[12.5px] font-medium truncate" style={{ color: "var(--zn-ink)" }}>
                    {e.description || e.category}
                  </p>
                  <p className="text-[11px]" style={{ color: "var(--zn-ink-3)" }}>
                    {e.category} · {fmtDate(e.date)}
                  </p>
                </div>

                <span
                  className="text-[13px] font-semibold tabular-nums flex-shrink-0"
                  style={{ color: "var(--zn-ink)" }}
                >
                  {fmtGBP(e.amount)}
                </span>

                <button
                  type="button"
                  onClick={() => onDelete(e.id)}
                  className="rounded p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label="Delete expense"
                >
                  <Trash2 className="size-3.5" style={{ color: "var(--zn-risk)" }} />
                </button>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function ExpensePageClient() {
  const [entries, setEntries] = useState<ExpenseEntry[]>([]);
  const [hydrated, setHydrated] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    setEntries(loadFromStorage());
    setHydrated(true);
  }, []);

  // Persist to localStorage whenever entries change
  useEffect(() => {
    if (hydrated) saveToStorage(entries);
  }, [entries, hydrated]);

  const handleAdd = useCallback((entry: ExpenseEntry) => {
    setEntries((prev) => [entry, ...prev]);
  }, []);

  const handleDelete = useCallback((id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
    deleteExpense(id).catch(() => {/* graceful */});
  }, []);

  const total12m = entries.reduce((s, e) => s + e.amount, 0);
  const grouped  = groupByMonth(entries);

  return (
    <div className="space-y-5">
      {/* ── Page heading ─────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1
            className="text-[24px] font-semibold tracking-[-0.02em]"
            style={{ color: "var(--zn-ink)" }}
          >
            Expenses
          </h1>
          <p className="mt-0.5 text-[13.5px]" style={{ color: "var(--zn-ink-3)" }}>
            Track allowable business expenses to reduce your Self Assessment bill
          </p>
        </div>
        <AddExpensePanel onAdd={handleAdd} />
      </div>

      {/* ── Hero total ────────────────────────────────────────────────────── */}
      {entries.length > 0 && (
        <div
          className="rounded-[14px] border px-5 py-4 flex items-center justify-between"
          style={{ borderColor: "var(--zn-line)", background: "var(--zn-bg-2)" }}
        >
          <div>
            <p
              className="text-[10.5px] font-semibold uppercase tracking-[0.08em]"
              style={{ color: "var(--zn-ink-3)" }}
            >
              Total recorded
            </p>
            <p
              className="mt-1 text-[36px] font-bold leading-none tabular-nums"
              style={{ color: "var(--zn-safe)" }}
            >
              {fmtGBP(total12m)}
            </p>
            <p className="mt-1.5 text-[12px]" style={{ color: "var(--zn-ink-3)" }}>
              Deducted from taxable income in tax reserve & MTD calculations
            </p>
          </div>
          <div
            className="hidden sm:flex items-center justify-center size-14 rounded-full text-[22px]"
            style={{ background: "var(--zn-safe-soft)" }}
            aria-hidden
          >
            📉
          </div>
        </div>
      )}

      {/* ── Category breakdown ────────────────────────────────────────────── */}
      {entries.length > 0 && <CategoryBreakdown entries={entries} />}

      {/* ── Add panel (shown inline when no entries yet) ──────────────────── */}
      {entries.length === 0 && hydrated && (
        <div
          className="rounded-[14px] border px-5 py-8 text-center"
          style={{ borderColor: "var(--zn-line)", background: "var(--zn-bg-2)" }}
        >
          <div
            className="mx-auto mb-3 flex items-center justify-center size-12 rounded-full"
            style={{ background: "var(--zn-safe-soft)" }}
          >
            <span className="text-[20px]">🧾</span>
          </div>
          <p className="text-[14px] font-semibold" style={{ color: "var(--zn-ink)" }}>
            No expenses recorded yet
          </p>
          <p className="mt-1 text-[12.5px]" style={{ color: "var(--zn-ink-3)" }}>
            Add your allowable business expenses — they reduce your taxable income and your Self Assessment bill.
          </p>
        </div>
      )}

      {/* ── Monthly groups ────────────────────────────────────────────────── */}
      {grouped.map(({ ym, entries: monthEntries }) => (
        <MonthGroup
          key={ym}
          ym={ym}
          entries={monthEntries}
          onDelete={handleDelete}
        />
      ))}

      {/* Fine print */}
      {entries.length > 0 && (
        <p className="text-[11.5px] text-center pb-2" style={{ color: "var(--zn-ink-3)" }}>
          Figures are for planning purposes only. Always consult an accountant for your
          actual Self Assessment return. HMRC rules on allowable expenses apply.
        </p>
      )}
    </div>
  );
}
