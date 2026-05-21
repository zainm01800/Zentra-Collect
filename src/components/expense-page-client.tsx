"use client";

/**
 * src/components/expense-page-client.tsx
 *
 * Smart expense tracking UI — client component.
 *
 * Features:
 *   - Import debit transactions from a saved bank statement automatically
 *   - HMRC auto-classification: each imported transaction is labelled
 *     Allowable / Not allowable / Review (uncertain)
 *   - Three-tab view: All · Allowable · Not allowable
 *   - Per-expense allowability toggle (one tap to reclassify)
 *   - Manually add expenses (defaults to Allowable)
 *   - Monthly grouped list with per-month subtotals
 *   - Category breakdown bar (allowable expenses only)
 *   - Delete individual entries
 *   - Running total hero (allowable only — the tax-relevant figure)
 *
 * Storage:
 *   Expenses → localStorage "zentra.expenses.v1"  (ExtendedEntry[])
 *   Bank statement → localStorage "zentra.bankStatement.v1" (ParsedTransaction[])
 */

import { useState, useEffect, useCallback, useRef } from "react";
import {
  ChevronDown,
  ChevronUp,
  PlusCircle,
  Trash2,
  X,
  ArrowDownToLine,
  CheckCircle2,
  HelpCircle,
  RotateCcw,
  Pencil,
  Check,
  AlertTriangle,
} from "lucide-react";
import { addExpense, deleteExpense } from "@/actions/expenses";
import type { ExpenseEntry } from "@/actions/expenses";
import { EXPENSE_CATEGORIES } from "@/lib/expense-categories";
import { ReceiptScanButton } from "@/components/receipt-scan-button";
import {
  classifyExpense,
  allowabilityColors,
  allowabilityLabel,
} from "@/lib/expense-allowability";
import type { Allowability } from "@/lib/expense-allowability";
import { BANK_STATEMENT_KEY } from "@/components/bank-statement-import";
import type { ParsedTransaction } from "@/components/bank-statement-import";
import { BulkReceiptImport } from "@/components/bulk-receipt-import";
import type { BulkReceiptResult } from "@/components/bulk-receipt-import";

// ── Extended type ──────────────────────────────────────────────────────────────

type RichEntry = ExpenseEntry & {
  allowability?: Allowability;
  /** "manual" = user-added via form; "bank-import" = pulled from bank statement */
  source?: "manual" | "bank-import";
  /** -1=exempt, 0=zero-rated, 5=reduced, 20=standard; undefined=not tracking */
  vatRate?: number;
  /** VAT portion of the gross amount */
  vatAmount?: number;
};

type ActiveTab = "all" | "review" | "not-allowable";

interface PendingDeletion {
  entry:   RichEntry;
  timerId: ReturnType<typeof setTimeout>;
}

type DeletedEntry = RichEntry & { deletedAt: string }; // ISO date string

// ── Constants ──────────────────────────────────────────────────────────────────

const STORAGE_KEY         = "zentra.expenses.v1";
const DELETED_STORAGE_KEY = "zentra.expenses.deleted.v1";
const DELETED_RETENTION_DAYS = 30;

const CAT_COLOURS = [
  "#c88a1e", "#3b82f6", "#10b981", "#f43f5e",
  "#8b5cf6", "#f97316", "#06b6d4", "#84cc16", "#ec4899", "#6b7280",
];

const CATEGORY_HMRC: Record<string, { short: string; hint: string; allowablePct: number }> = {
  "Office & stationery":    { short: "Fully allowable",                    allowablePct: 100, hint: "Office supplies used wholly for business are fully deductible. VAT is reclaimable with a valid VAT receipt." },
  "Travel & mileage":       { short: "Fully allowable — business travel",  allowablePct: 100, hint: "Business travel is fully allowable. Use HMRC approved mileage rates for your own vehicle. VAT on fuel can be reclaimed with a fuel receipt." },
  "Professional fees":      { short: "Fully allowable",                    allowablePct: 100, hint: "Accountancy, legal and professional fees are fully allowable. VAT is reclaimable where a valid VAT invoice is held." },
  "Equipment & software":   { short: "Fully allowable",                    allowablePct: 100, hint: "Software and equipment used wholly for business are fully deductible. VAT is reclaimable with a valid invoice." },
  "Phone & internet":       { short: "50% mixed-use rule",                 allowablePct: 50,  hint: "HMRC allows 50% for mixed personal/business use of phone and broadband. 50% of the VAT is reclaimable." },
  "Marketing & advertising":{ short: "Fully allowable",                    allowablePct: 100, hint: "Advertising and marketing spend is fully allowable. VAT is reclaimable where a valid invoice is held." },
  "Training & development": { short: "Fully allowable if existing trade",  allowablePct: 100, hint: "Training that improves skills for your current trade is fully allowable. Training for a completely new career is not." },
  "Bank charges":           { short: "Fully allowable",                    allowablePct: 100, hint: "Business bank charges and interest are fully allowable as a business expense. UK banks do not charge VAT." },
  "Premises & utilities":   { short: "Fully allowable",                    allowablePct: 100, hint: "Business premises rent, rates and utilities are fully allowable. For home office use, HMRC's simplified flat rate may apply." },
  "Other":                  { short: "Review required",                    allowablePct: 100, hint: "Review this expense to confirm it qualifies as wholly and exclusively for your trade under HMRC rules (s34 ITTOIA 2005)." },
};

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

function fmtGBP2(n: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency", currency: "GBP",
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(n);
}

function r2(n: number) { return Math.round(n * 100) / 100; }

function vatRateLabel(rate: number | undefined): string {
  if (rate === undefined) return "";
  if (rate === -1) return "Exempt";
  return `${rate}%`;
}

function defaultVatForRate(rate: number, gross: number): number {
  if (rate <= 0) return 0;
  return r2(gross * rate / (100 + rate));
}

const VAT_PRESETS = [
  { label: "Exempt", rate: -1 },
  { label: "0%",     rate:  0 },
  { label: "5%",     rate:  5 },
  { label: "20%",    rate: 20 },
] as const;

function loadFromStorage(): RichEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RichEntry[];
    if (!Array.isArray(parsed)) return [];
    // Backfill: manual entries without allowability → default to "allowable"
    return parsed.map((e) => ({
      ...e,
      allowability: e.allowability ?? (e.source === "bank-import" ? "review" : "allowable"),
    }));
  } catch {
    return [];
  }
}

function saveToStorage(entries: RichEntry[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

function loadDeletedFromStorage(): DeletedEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(DELETED_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as DeletedEntry[];
    if (!Array.isArray(parsed)) return [];
    const cutoff = Date.now() - DELETED_RETENTION_DAYS * 86_400_000;
    return parsed.filter((e) => new Date(e.deletedAt).getTime() > cutoff);
  } catch {
    return [];
  }
}

function saveDeletedToStorage(deleted: DeletedEntry[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(DELETED_STORAGE_KEY, JSON.stringify(deleted));
}

function permanentlyDelete(entry: RichEntry) {
  const deleted = loadDeletedFromStorage();
  const already = deleted.some((d) => d.id === entry.id);
  if (!already) {
    deleted.unshift({ ...entry, deletedAt: new Date().toISOString() });
    saveDeletedToStorage(deleted);
  }
  deleteExpense(entry.id).catch(() => {});
}

function groupByMonth(entries: RichEntry[]): { ym: string; entries: RichEntry[] }[] {
  const map = new Map<string, RichEntry[]>();
  for (const e of entries) {
    const ym = e.date.slice(0, 7);
    if (!map.has(ym)) map.set(ym, []);
    map.get(ym)!.push(e);
  }
  return Array.from(map.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([ym, entries]) => ({ ym, entries }));
}

function categoryTotals(entries: RichEntry[]): { category: string; total: number }[] {
  const map: Record<string, number> = {};
  for (const e of entries) {
    map[e.category] = (map[e.category] ?? 0) + e.amount;
  }
  return Object.entries(map)
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total);
}

/** Load saved bank statement and return debit transactions only. */
function loadBankDebits(): ParsedTransaction[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(BANK_STATEMENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ParsedTransaction[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((t) => t.amount < 0);
  } catch {
    return [];
  }
}

/** Count bank debits that aren't already in the expense list. */
function countImportable(debits: ParsedTransaction[], existing: RichEntry[]): number {
  return debits.filter((tx) =>
    !existing.some(
      (e) =>
        e.date === tx.date &&
        Math.abs(e.amount - Math.abs(tx.amount)) < 0.01 &&
        e.description.toLowerCase() === tx.description.toLowerCase(),
    ),
  ).length;
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatCard({ label, value, accent, sub }: { label: string; value: string; accent?: string; sub?: string }) {
  return (
    <div className="zn-card px-4 py-3.5">
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.07em]" style={{ color: "var(--zn-ink-3)" }}>{label}</p>
      <p className="mt-1.5 text-[22px] font-bold tabular-nums leading-none" style={{ color: accent ?? "var(--zn-ink)" }}>{value}</p>
      {sub && <p className="mt-1 text-[11px]" style={{ color: "var(--zn-ink-3)" }}>{sub}</p>}
    </div>
  );
}

/** Clickable pill that cycles an expense between Allowable / Not allowable. */
function AllowabilityBadge({
  value,
  onChange,
}: {
  value: Allowability;
  onChange: (v: Allowability) => void;
}) {
  const colors = allowabilityColors(value);
  const label  = allowabilityLabel(value);
  const next: Allowability =
    value === "allowable" ? "not-allowable" :
    value === "not-allowable" ? "allowable" :
    "allowable"; // review → allowable on first tap

  return (
    <button
      type="button"
      title={`Currently: ${label}. Click to toggle.`}
      onClick={() => onChange(next)}
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold transition-all flex-shrink-0"
      style={{
        background:  colors.bg,
        color:       colors.text,
        border:      `1px solid ${colors.border}`,
      }}
    >
      {value === "review" && <HelpCircle className="size-2.5" />}
      {label}
    </button>
  );
}

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
        background:  selected ? "var(--zn-ink)" : "transparent",
        color:       selected ? "var(--zn-surface)" : "var(--zn-ink-2)",
        borderColor: selected ? "var(--zn-ink)" : "var(--zn-line)",
      }}
    >
      {cat}
    </button>
  );
}

/** Inline VAT editor embedded in each expense row. Self-contained editing state. */
function VatInlineEdit({
  entryId,
  gross,
  vatRate,
  vatAmount,
  onSave,
  initialEditing = false,
}: {
  entryId:        string;
  gross:          number;
  vatRate?:       number;
  vatAmount?:     number;
  onSave:         (id: string, vatRate: number, vatAmount: number) => void;
  initialEditing?: boolean;
}) {
  const [editing,     setEditing]     = useState(initialEditing);
  const [draftRate,   setDraftRate]   = useState<number | undefined>(vatRate);
  const [draftAmount, setDraftAmount] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);

  function startEdit() {
    setDraftRate(vatRate);
    setDraftAmount(vatAmount !== undefined ? String(r2(vatAmount)) : "");
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function selectPreset(rate: number) {
    setDraftRate(rate);
    setDraftAmount(String(defaultVatForRate(rate, gross)));
  }

  function save() {
    const rate = draftRate ?? 0;
    const amt  = parseFloat(draftAmount);
    if (isNaN(amt) || amt < 0) return;
    // Cap VAT at the gross so net never goes negative
    onSave(entryId, rate, r2(Math.min(amt, gross)));
    setEditing(false);
  }

  if (!editing) {
    return (
      <div className="flex items-center gap-1.5 mt-0.5">
        {vatAmount !== undefined ? (
          <>
            <span className="text-[11px] tabular-nums" style={{ color: "var(--zn-ink-3)" }}>
              +{fmtGBP2(vatAmount)} VAT{vatRate !== undefined ? ` @ ${vatRateLabel(vatRate)}` : ""}
            </span>
            <button
              type="button"
              onClick={startEdit}
              className="rounded p-0.5 hover:bg-[var(--zn-surface-2)] transition-colors"
              aria-label="Edit VAT"
            >
              <Pencil className="size-2.5" style={{ color: "var(--zn-ink-3)" }} />
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={startEdit}
            className="flex items-center gap-0.5 text-[11px] hover:underline"
            style={{ color: "var(--zn-ink-3)" }}
          >
            <PlusCircle className="size-2.5" />
            Add VAT
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="mt-2 rounded-xl border overflow-hidden" style={{ borderColor: "var(--zn-line)" }}>
      <div className="px-3 pt-2.5 pb-2" style={{ background: "var(--zn-surface)" }}>
        <p className="text-[10px] font-semibold uppercase tracking-[0.07em] mb-2" style={{ color: "var(--zn-ink-3)" }}>
          VAT rate
        </p>
        <div className="grid grid-cols-4 gap-1.5">
          {VAT_PRESETS.map((p) => (
            <button
              key={p.rate}
              type="button"
              onClick={() => selectPreset(p.rate)}
              className="py-2 rounded-lg border text-[12px] font-semibold transition-all"
              style={{
                background:  draftRate === p.rate ? "var(--zn-ink)"      : "transparent",
                color:       draftRate === p.rate ? "var(--zn-surface)"  : "var(--zn-ink)",
                borderColor: draftRate === p.rate ? "var(--zn-ink)"      : "var(--zn-line)",
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
      <div className="px-3 pt-2 pb-2.5 border-t"
           style={{ borderColor: "var(--zn-line-soft)", background: "var(--zn-bg-2)" }}>
        <p className="text-[10px] font-semibold uppercase tracking-[0.07em] mb-1.5" style={{ color: "var(--zn-ink-3)" }}>
          VAT amount
        </p>
        <div className="flex items-center gap-2">
          <div className="flex-1 flex items-center rounded-lg border px-2.5 py-1.5"
               style={{ borderColor: "var(--zn-line)", background: "var(--zn-surface)" }}>
            <span className="text-[12px] mr-1" style={{ color: "var(--zn-ink-3)" }}>£</span>
            <input
              ref={inputRef}
              type="number"
              min="0"
              step="0.01"
              value={draftAmount}
              onChange={(e) => setDraftAmount(e.target.value)}
              className="flex-1 text-[12.5px] bg-transparent outline-none"
              style={{ color: "var(--zn-ink)" }}
              placeholder="0.00"
            />
          </div>
          <button
            type="button"
            onClick={save}
            className="size-8 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: "var(--zn-ink)", color: "var(--zn-surface)" }}
            aria-label="Save VAT"
          >
            <Check className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="size-8 rounded-full flex items-center justify-center flex-shrink-0 border"
            style={{ borderColor: "var(--zn-line)", color: "var(--zn-ink-2)" }}
            aria-label="Cancel"
          >
            <X className="size-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function AddExpensePanel({ onAdd }: { onAdd: (e: RichEntry) => void }) {
  const [open, setOpen]         = useState(false);
  const [category, setCategory] = useState<string>(EXPENSE_CATEGORIES[0]);
  const [amount, setAmount]     = useState("");
  const [date, setDate]         = useState(todayISO());
  const [description, setDesc]  = useState("");
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [vatRate, setVatRate]   = useState<number | undefined>(undefined);

  const computedVat = vatRate !== undefined && amount
    ? defaultVatForRate(vatRate, parseFloat(amount) || 0)
    : undefined;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) { setError("Enter a valid amount."); return; }

    setSaving(true);
    setError(null);

    const newEntry: RichEntry = {
      id:           crypto.randomUUID(),
      date,
      amount:       amt,
      category,
      description:  description.trim(),
      allowability: "allowable",
      source:       "manual",
      ...(vatRate !== undefined && computedVat !== undefined
        ? { vatRate, vatAmount: computedVat }
        : {}),
    };

    await addExpense({ date, amount: amt, category, description: description.trim() });

    onAdd(newEntry);
    setAmount("");
    setDesc("");
    setDate(todayISO());
    setVatRate(undefined);
    setSaving(false);
    setOpen(false);
  }

  // Receipt OCR: snap a photo, AI extracts vendor/date/amount, then we
  // pre-fill the manual form so the user can confirm/edit before saving.
  function handleReceiptConfirmed(data: { vendor: string; date: string; amount: number; category?: string }) {
    setOpen(true);
    setAmount(String(data.amount));
    setDate(data.date);
    setDesc(data.vendor);
    if (data.category && EXPENSE_CATEGORIES.includes(data.category as typeof EXPENSE_CATEGORIES[number])) {
      setCategory(data.category);
    }
  }

  if (!open) {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-semibold"
          style={{ background: "var(--zn-ink)", color: "var(--zn-surface)" }}
        >
          <PlusCircle className="size-4" />
          Add expense
        </button>
        <ReceiptScanButton onConfirm={handleReceiptConfirmed} />
      </div>
    );
  }

  return (
    <div
      className="rounded-[14px] border"
      style={{ borderColor: "var(--zn-line)", background: "var(--zn-bg-2)" }}
    >
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
          className="rounded p-1 hover:bg-[#ece3cc] dark:hover:bg-[#28231c] transition-colors"
          aria-label="Close"
        >
          <X className="size-3.5" style={{ color: "var(--zn-ink-3)" }} />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="p-4 space-y-4">
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

        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wide mb-2"
            style={{ color: "var(--zn-ink-3)" }}>
            VAT <span className="normal-case font-normal">(optional)</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {VAT_PRESETS.map((p) => (
              <button
                key={p.rate}
                type="button"
                onClick={() => setVatRate(vatRate === p.rate ? undefined : p.rate)}
                className="inline-flex items-center px-3 py-1.5 rounded-full text-[12px] font-medium border transition-colors"
                style={{
                  background:  vatRate === p.rate ? "var(--zn-ink)" : "transparent",
                  color:       vatRate === p.rate ? "var(--zn-surface)" : "var(--zn-ink-2)",
                  borderColor: vatRate === p.rate ? "var(--zn-ink)" : "var(--zn-line)",
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
          {computedVat !== undefined && computedVat > 0 && (
            <p className="mt-1.5 text-[12px]" style={{ color: "var(--zn-ink-3)" }}>
              VAT: <span className="font-medium" style={{ color: "var(--zn-ink-2)" }}>{fmtGBP2(computedVat)}</span>
              {" "}· Net: <span className="font-medium" style={{ color: "var(--zn-ink-2)" }}>
                {fmtGBP2((parseFloat(amount) || 0) - computedVat)}
              </span>
            </p>
          )}
        </div>

        {error && (
          <p className="text-[12px]" style={{ color: "var(--zn-risk)" }}>{error}</p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="px-4 py-2 rounded-full text-[13px] font-medium border"
            style={{ borderColor: "var(--zn-line)", color: "var(--zn-ink-2)" }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded-full text-[13px] font-semibold disabled:opacity-50"
            style={{ background: "var(--zn-ink)", color: "var(--zn-surface)" }}
          >
            {saving ? "Saving…" : "Save expense"}
          </button>
        </div>
      </form>
    </div>
  );
}

/** Stacked category bar — only shown for allowable entries. */
function CategoryBreakdown({ entries }: { entries: RichEntry[] }) {
  const totals    = categoryTotals(entries).slice(0, 5);
  const grandTotal = totals.reduce((s, t) => s + t.total, 0);
  if (grandTotal <= 0) return null;

  return (
    <div
      className="rounded-[14px] border px-5 py-4"
      style={{ borderColor: "var(--zn-line)", background: "var(--zn-bg-2)" }}
    >
      <span className="text-[10.5px] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--zn-ink-3)" }}>
        Allowable — by category
      </span>
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
      <div className="mt-3 space-y-1.5">
        {totals.map((t, i) => (
          <div key={t.category} className="flex items-center gap-2">
            <span className="size-2.5 rounded-full flex-shrink-0" style={{ background: CAT_COLOURS[i % CAT_COLOURS.length] }} />
            <span className="flex-1 text-[12px]" style={{ color: "var(--zn-ink-2)" }}>{t.category}</span>
            <span className="text-[12px] font-medium tabular-nums" style={{ color: "var(--zn-ink)" }}>{fmtGBP(t.total)}</span>
            <span className="text-[10.5px] w-[32px] text-right" style={{ color: "var(--zn-ink-3)" }}>
              {Math.round((t.total / grandTotal) * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Single expense row — category pill + inline VAT badge + secondary amount line. */
function ExpenseRow({
  entry,
  isActive,
  onDelete,
  onAllowabilityChange,
  onVatChange,
  onRowClick,
}: {
  entry:                  RichEntry;
  isActive?:              boolean;
  onDelete:               (id: string) => void;
  onAllowabilityChange:   (id: string, v: Allowability) => void;
  onVatChange:            (id: string, vatRate: number, vatAmount: number) => void;
  onRowClick?:            () => void;
}) {
  const [vatEditing, setVatEditing] = useState(false);

  const catIdx      = EXPENSE_CATEGORIES.indexOf(entry.category as typeof EXPENSE_CATEGORIES[number]);
  const catColor    = CAT_COLOURS[catIdx >= 0 ? catIdx % CAT_COLOURS.length : 0] ?? "var(--zn-ink-3)";
  const isAllowable    = (entry.allowability ?? "allowable") === "allowable";
  const isNotAllowable = entry.allowability === "not-allowable";
  const hasVat         = entry.vatAmount !== undefined && entry.vatAmount > 0;

  return (
    <div
      className="px-4 py-3 group cursor-pointer transition-colors"
      style={{ background: isActive ? "var(--zn-surface-2)" : undefined }}
      onClick={onRowClick}
    >
      <div className="flex items-start gap-3">
        {/* Category colour dot */}
        <span
          className="size-2 rounded-full flex-shrink-0 mt-[5px]"
          style={{ background: catColor }}
        />

        {/* Left: title + tags + meta */}
        <div className="flex-1 min-w-0">
          {/* Title + category pill + VAT badge */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <p
              className="text-[12.5px] font-semibold"
              style={{
                color:          "var(--zn-ink)",
                textDecoration: isNotAllowable ? "line-through" : "none",
                opacity:        isNotAllowable ? 0.6 : 1,
              }}
            >
              {entry.description || entry.category}
            </p>
            {/* Category pill */}
            <span
              className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold flex-shrink-0"
              style={{
                background: catColor + "22",
                color:      catColor,
                border:     `1px solid ${catColor}44`,
              }}
            >
              {entry.category}
            </span>
            {/* VAT badge — click to edit */}
            {hasVat && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setVatEditing((v) => !v); }}
                className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold flex-shrink-0 transition-opacity hover:opacity-75"
                style={{
                  background: "color-mix(in srgb, var(--zn-info) 12%, transparent)",
                  color:      "var(--zn-info)",
                  border:     "1px solid color-mix(in srgb, var(--zn-info) 30%, transparent)",
                }}
              >
                +{fmtGBP2(entry.vatAmount!)} VAT{entry.vatRate !== undefined ? ` ${vatRateLabel(entry.vatRate)}` : ""}
              </button>
            )}
          </div>
          {/* Date + source */}
          <p className="text-[11px] mt-0.5" style={{ color: "var(--zn-ink-3)" }}>
            {fmtDate(entry.date)}
            {entry.source === "bank-import" && (
              <span className="ml-1 opacity-60">· from bank</span>
            )}
          </p>
          {/* HMRC hint */}
          <p className="text-[10.5px] mt-0.5" style={{ color: "var(--zn-ink-3)" }}>
            {isNotAllowable
              ? "Not allowable"
              : (CATEGORY_HMRC[entry.category]?.short ?? "Fully allowable")}
          </p>
        </div>

        {/* Right: amount + secondary line + receipt icon + delete */}
        <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
          <div className="flex items-center gap-1">
            <span className="text-[13px] font-semibold tabular-nums" style={{ color: "var(--zn-ink)" }}>
              {fmtGBP(entry.amount)}
            </span>
            {/* Receipt status icon: warning triangle if VAT with no receipt, else hidden */}
            {hasVat && (
              <span title="Attach invoice to confirm VAT reclaim">
                <AlertTriangle className="size-3.5 flex-shrink-0" style={{ color: "var(--zn-warn)" }} />
              </span>
            )}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onDelete(entry.id); }}
              className="rounded p-1 opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label="Delete expense"
            >
              <Trash2 className="size-3.5" style={{ color: "var(--zn-risk)" }} />
            </button>
          </div>
          {/* Secondary amount: green ok / red not claimable */}
          {isAllowable && (
            <span className="text-[10.5px] tabular-nums font-medium" style={{ color: "var(--zn-safe)" }}>
              {fmtGBP(entry.amount)} ok
            </span>
          )}
          {isNotAllowable && (
            <span className="text-[10.5px] font-medium" style={{ color: "var(--zn-risk)" }}>
              not claimable
            </span>
          )}
          {/* Add VAT link (when no VAT set) */}
          {!hasVat && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setVatEditing((v) => !v); }}
              className="flex items-center gap-0.5 text-[10.5px] hover:underline mt-0.5"
              style={{ color: "var(--zn-ink-3)" }}
            >
              <PlusCircle className="size-2.5" />
              Add VAT
            </button>
          )}
        </div>
      </div>

      {/* VAT editor panel — expands on demand */}
      {vatEditing && (
        <div className="ml-5 mt-2" onClick={(e) => e.stopPropagation()}>
          <VatInlineEdit
            entryId={entry.id}
            gross={entry.amount}
            vatRate={entry.vatRate}
            vatAmount={entry.vatAmount}
            initialEditing={true}
            onSave={(id, rate, amt) => {
              onVatChange(id, rate, amt);
              setVatEditing(false);
            }}
          />
        </div>
      )}

      {/* Warning strip — VAT logged, attach invoice to confirm reclaim */}
      {hasVat && !vatEditing && (
        <div
          className="ml-5 mt-1.5 flex items-center gap-2 rounded-[7px] px-2.5 py-1.5"
          style={{ background: "var(--zn-warn-soft)", border: "1px solid color-mix(in srgb, var(--zn-warn) 30%, transparent)" }}
          onClick={(e) => e.stopPropagation()}
        >
          <AlertTriangle className="size-3 flex-shrink-0" style={{ color: "var(--zn-warn)" }} />
          <span className="text-[10.5px] flex-1" style={{ color: "var(--zn-warn)" }}>
            Attach invoice to confirm {fmtGBP2(entry.vatAmount!)} VAT reclaim
          </span>
          <button
            type="button"
            className="text-[10px] font-semibold rounded-full px-2 py-0.5 flex-shrink-0 transition-opacity hover:opacity-80"
            style={{ background: "var(--zn-warn)", color: "var(--zn-surface)" }}
          >
            Attach
          </button>
        </div>
      )}
    </div>
  );
}

/** Collapsible month group. */
function MonthGroup({
  ym,
  entries,
  onDelete,
  onAllowabilityChange,
  onVatChange,
  onRowClick,
  selectedId,
}: {
  ym:                   string;
  entries:              RichEntry[];
  onDelete:             (id: string) => void;
  onAllowabilityChange: (id: string, v: Allowability) => void;
  onVatChange:          (id: string, vatRate: number, vatAmount: number) => void;
  onRowClick?:          (id: string) => void;
  selectedId?:          string | null;
}) {
  const [open, setOpen] = useState(true);
  const total = entries.reduce((s, e) => s + e.amount, 0);
  const allowableMonthTotal = entries.filter(e => e.allowability === "allowable").reduce((s, e) => s + e.amount, 0);

  return (
    <div
      className="rounded-[14px] border overflow-hidden"
      style={{ borderColor: "var(--zn-line)", background: "var(--zn-bg-2)" }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 transition-colors hover:bg-[#f3ecd8] dark:hover:bg-[#2d2820]"
      >
        <div className="flex items-center gap-2">
          {open
            ? <ChevronUp   className="size-3.5" style={{ color: "var(--zn-ink-3)" }} />
            : <ChevronDown className="size-3.5" style={{ color: "var(--zn-ink-3)" }} />}
          <span className="text-[13px] font-semibold" style={{ color: "var(--zn-ink)" }}>
            {monthLabel(ym)}
          </span>
          <span className="text-[11px]" style={{ color: "var(--zn-ink-3)" }}>
            {entries.length} item{entries.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="shrink-0 text-right text-[11px] tabular-nums" style={{ color: "var(--zn-ink-3)" }}>
          <span style={{ color: "var(--zn-safe)", fontWeight: 600 }}>{fmtGBP(allowableMonthTotal)}</span>
          {" allowable · "}
          <span style={{ color: "var(--zn-ink-2)" }}>{fmtGBP(total)} net</span>
        </div>
      </button>

      {open && (
        <div className="border-t divide-y" style={{ borderColor: "var(--zn-line-soft)" }}>
          {entries.map((e) => (
            <ExpenseRow
              key={e.id}
              entry={e}
              isActive={selectedId === e.id}
              onDelete={onDelete}
              onAllowabilityChange={onAllowabilityChange}
              onVatChange={onVatChange}
              onRowClick={() => onRowClick?.(e.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * "Needs review" section — shown at the top of the All tab when the bank
 * import left entries with uncertain allowability.
 */
function ReviewSection({
  entries,
  onAllowabilityChange,
}: {
  entries:              RichEntry[];
  onAllowabilityChange: (id: string, v: Allowability) => void;
}) {
  if (entries.length === 0) return null;

  return (
    <div
      className="rounded-[14px] border overflow-hidden"
      style={{ borderColor: "var(--zn-warn)", background: "var(--zn-warn-soft)" }}
    >
      <div className="flex items-center gap-2 px-4 py-3">
        <HelpCircle className="size-3.5 flex-shrink-0" style={{ color: "var(--zn-warn)" }} />
        <span className="text-[12.5px] font-semibold" style={{ color: "var(--zn-warn)" }}>
          {entries.length} transaction{entries.length > 1 ? "s" : ""} need classifying
        </span>
        <span className="text-[11.5px]" style={{ color: "var(--zn-warn)" }}>
          — tap a badge to mark as Allowable or Not allowable
        </span>
      </div>
      <div
        className="border-t divide-y"
        style={{ borderColor: "var(--zn-warn)", background: "var(--zn-bg-2)" }}
      >
        {entries
          .slice()
          .sort((a, b) => b.date.localeCompare(a.date))
          .map((e) => (
            <div key={e.id} className="flex items-center gap-3 px-4 py-3">
              <div className="flex-1 min-w-0">
                <p className="text-[12.5px] font-medium truncate" style={{ color: "var(--zn-ink)" }}>
                  {e.description || e.category}
                </p>
                <p className="text-[11px]" style={{ color: "var(--zn-ink-3)" }}>
                  {fmtDate(e.date)} · from bank
                </p>
              </div>
              <span className="text-[13px] font-semibold tabular-nums flex-shrink-0" style={{ color: "var(--zn-ink)" }}>
                {fmtGBP(e.amount)}
              </span>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => onAllowabilityChange(e.id, "allowable")}
                  className="rounded-full px-2.5 py-1 text-[11px] font-semibold border"
                  style={{
                    background:  "var(--zn-safe-soft)",
                    color:       "var(--zn-safe)",
                    borderColor: "var(--zn-safe)",
                  }}
                >
                  ✓ Business
                </button>
                <button
                  type="button"
                  onClick={() => onAllowabilityChange(e.id, "not-allowable")}
                  className="rounded-full px-2.5 py-1 text-[11px] font-semibold border"
                  style={{
                    background:  "var(--zn-risk-soft)",
                    color:       "var(--zn-risk)",
                    borderColor: "var(--zn-risk)",
                  }}
                >
                  ✗ Personal
                </button>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}

/** Banner shown when a bank statement is saved but has unimported debits. */
function BankImportBanner({
  count,
  onImport,
  importing,
}: {
  count:     number;
  onImport:  () => void;
  importing: boolean;
}) {
  if (count === 0) return null;

  return (
    <div
      className="rounded-[14px] border flex items-center justify-between gap-4 px-5 py-4 flex-wrap"
      style={{ borderColor: "var(--zn-line)", background: "var(--zn-surface)" }}
    >
      <div className="flex items-start gap-3">
        <div
          className="size-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: "var(--zn-bg-2)", border: "1px solid var(--zn-line)" }}
        >
          <ArrowDownToLine className="size-4" style={{ color: "var(--zn-ink-2)" }} />
        </div>
        <div>
          <p className="text-[13.5px] font-semibold" style={{ color: "var(--zn-ink)" }}>
            {count} debit transaction{count > 1 ? "s" : ""} found in your bank statement
          </p>
          <p className="mt-0.5 text-[12px]" style={{ color: "var(--zn-ink-3)" }}>
            Zentra will auto-classify each one as allowable or personal — you can correct any with one tap.
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onImport}
        disabled={importing}
        className="flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-semibold disabled:opacity-50 flex-shrink-0"
        style={{ background: "var(--zn-ink)", color: "var(--zn-surface)" }}
      >
        <ArrowDownToLine className="size-3.5" />
        {importing ? "Importing…" : `Import ${count} transaction${count > 1 ? "s" : ""}`}
      </button>
    </div>
  );
}

/** Detail panel shown on the right column when an expense row is selected. */
function DetailPanel({
  expense,
  onCategoryChange,
  onAllowabilityChange,
  onVatChange,
}: {
  expense: RichEntry;
  onCategoryChange: (id: string, cat: string) => void;
  onAllowabilityChange: (id: string, v: Allowability) => void;
  onVatChange: (id: string, vatRate: number, vatAmount: number) => void;
}) {
  const hmrc      = CATEGORY_HMRC[expense.category];
  const allowable = (expense.allowability ?? "allowable") === "allowable";
  const hasVat    = expense.vatAmount !== undefined && expense.vatAmount > 0;
  const net       = hasVat ? expense.amount - expense.vatAmount! : expense.amount;

  return (
    <div className="zn-card px-5 py-5 space-y-4 lg:sticky lg:top-6">
      {/* Header */}
      <div>
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.07em]" style={{ color: "var(--zn-ink-3)" }}>
          {expense.category} · {fmtDate(expense.date)}
        </p>
        <p className="mt-1 text-[16px] font-semibold" style={{ color: "var(--zn-ink)" }}>
          {expense.description || expense.category}
        </p>
        {expense.source === "bank-import" && (
          <span className="text-[11px]" style={{ color: "var(--zn-ink-3)" }}>from bank statement</span>
        )}
      </div>

      {/* 4-cell grid: GROSS / NET / VAT / ALLOWABLE */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-[8px] px-3 py-2.5" style={{ background: "var(--zn-surface-2)" }}>
          <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--zn-ink-3)" }}>Gross</p>
          <p className="text-[15px] font-semibold tabular-nums mt-0.5" style={{ color: "var(--zn-ink)" }}>{fmtGBP2(expense.amount)}</p>
        </div>
        <div className="rounded-[8px] px-3 py-2.5" style={{ background: "var(--zn-surface-2)" }}>
          <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--zn-ink-3)" }}>Net</p>
          <p className="text-[15px] font-semibold tabular-nums mt-0.5" style={{ color: "var(--zn-ink)" }}>{fmtGBP2(net)}</p>
        </div>
        <div className="rounded-[8px] px-3 py-2.5" style={{ background: hasVat ? "color-mix(in srgb, var(--zn-info) 10%, transparent)" : "var(--zn-surface-2)" }}>
          <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: hasVat ? "var(--zn-info)" : "var(--zn-ink-3)" }}>VAT</p>
          <p className="text-[15px] font-semibold tabular-nums mt-0.5" style={{ color: hasVat ? "var(--zn-info)" : "var(--zn-ink-3)" }}>
            {hasVat ? fmtGBP2(expense.vatAmount!) : "—"}
          </p>
        </div>
        <div className="rounded-[8px] px-3 py-2.5" style={{ background: allowable ? "var(--zn-safe-soft)" : "var(--zn-risk-soft)" }}>
          <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: allowable ? "var(--zn-safe)" : "var(--zn-risk)" }}>Allowable</p>
          <p className="text-[15px] font-semibold tabular-nums mt-0.5" style={{ color: allowable ? "var(--zn-safe)" : "var(--zn-risk)" }}>
            {allowable ? fmtGBP2(expense.amount) : "£0.00"}
          </p>
        </div>
      </div>

      {/* VAT Breakdown table */}
      {hasVat && (
        <div className="rounded-[8px] overflow-hidden" style={{ border: "1px solid var(--zn-line-soft)" }}>
          <div className="px-3 py-2" style={{ background: "var(--zn-surface-2)" }}>
            <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--zn-ink-3)" }}>VAT Breakdown</p>
          </div>
          <table className="w-full text-left border-collapse">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--zn-line-soft)", background: "var(--zn-bg-2)" }}>
                <th className="px-3 py-1.5 text-[10px] font-semibold" style={{ color: "var(--zn-ink-3)" }}>Description</th>
                <th className="px-3 py-1.5 text-[10px] font-semibold" style={{ color: "var(--zn-ink-3)" }}>Rate</th>
                <th className="px-3 py-1.5 text-[10px] font-semibold" style={{ color: "var(--zn-ink-3)" }}>VAT</th>
                <th className="px-3 py-1.5 text-[10px] font-semibold" style={{ color: "var(--zn-ink-3)" }}>✓</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ background: "var(--zn-surface)" }}>
                <td className="px-3 py-2 text-[11.5px]" style={{ color: "var(--zn-ink-2)" }}>
                  {expense.description || expense.category}
                </td>
                <td className="px-3 py-2 text-[11.5px] tabular-nums" style={{ color: "var(--zn-ink-2)" }}>
                  {expense.vatRate !== undefined ? vatRateLabel(expense.vatRate) : "—"}
                </td>
                <td className="px-3 py-2 text-[11.5px] tabular-nums font-medium" style={{ color: "var(--zn-info)" }}>
                  {fmtGBP2(expense.vatAmount!)}
                </td>
                <td className="px-3 py-2 text-[11.5px]">
                  <button
                    type="button"
                    onClick={() => onVatChange(expense.id, expense.vatRate ?? 20, expense.vatAmount!)}
                    className="size-5 rounded flex items-center justify-center transition-colors hover:opacity-80"
                    style={{ background: "var(--zn-safe-soft)", color: "var(--zn-safe)" }}
                    title="Confirm VAT"
                  >
                    <Check className="size-3" />
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
          <div className="px-3 py-2" style={{ borderTop: "1px solid var(--zn-line-soft)", background: "var(--zn-bg-2)" }}>
            <button
              type="button"
              className="flex items-center gap-1 text-[11px] font-medium hover:underline"
              style={{ color: "var(--zn-ink-3)" }}
            >
              <PlusCircle className="size-3" />
              Add line
            </button>
          </div>
        </div>
      )}

      {/* HMRC Rule */}
      {hmrc && (
        <div className="rounded-[8px] px-3 py-2.5" style={{ background: "var(--zn-surface-2)", border: "1px solid var(--zn-line-soft)" }}>
          <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--zn-ink-3)" }}>HMRC Rule</p>
          <p className="mt-1 text-[12px] leading-[1.6]" style={{ color: "var(--zn-ink-2)" }}>{hmrc.hint}</p>
        </div>
      )}

      {/* Force not claimable toggle */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[12.5px] font-medium" style={{ color: "var(--zn-ink)" }}>Force not claimable</p>
          <p className="text-[11px]" style={{ color: "var(--zn-ink-3)" }}>Exclude from your tax calculation</p>
        </div>
        <button
          type="button"
          onClick={() => onAllowabilityChange(expense.id, allowable ? "not-allowable" : "allowable")}
          className="relative inline-flex h-6 w-10 items-center rounded-full transition-colors"
          style={{ background: !allowable ? "var(--zn-risk)" : "var(--zn-line)" }}
        >
          <span
            className="inline-block size-4 rounded-full bg-white shadow-sm transition-transform"
            style={{ transform: !allowable ? "translateX(20px)" : "translateX(4px)" }}
          />
        </button>
      </div>

      {/* Category dropdown */}
      <div>
        <p className="text-[10.5px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: "var(--zn-ink-3)" }}>Category</p>
        <select
          value={expense.category}
          onChange={e => onCategoryChange(expense.id, e.target.value)}
          className="w-full rounded-[8px] border px-3 py-2 text-[13px]"
          style={{ borderColor: "var(--zn-line)", background: "var(--zn-surface)", color: "var(--zn-ink)" }}
        >
          {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Receipt / Invoice section */}
      <div className="rounded-[8px] px-3 py-3" style={{ background: "var(--zn-surface-2)", border: "1px solid var(--zn-line-soft)" }}>
        <p className="text-[10px] font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--zn-ink-3)" }}>Receipt / Invoice</p>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[12px]" style={{ color: "var(--zn-ink-3)" }}>
            {hasVat ? "Attach invoice to confirm VAT reclaim" : "No receipt attached"}
          </span>
          <button
            type="button"
            className="text-[11px] font-semibold rounded-full px-3 py-1 flex-shrink-0 transition-opacity hover:opacity-80"
            style={{ background: "var(--zn-ink)", color: "var(--zn-surface)" }}
          >
            Attach
          </button>
        </div>
      </div>
    </div>
  );
}

/** Collapsible recently-deleted bin — 30-day recovery window. */
function RecentlyDeleted({
  entries,
  onRestore,
}: {
  entries:   DeletedEntry[];
  onRestore: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  if (entries.length === 0) return null;

  return (
    <div
      className="rounded-[14px] border overflow-hidden"
      style={{ borderColor: "var(--zn-line-soft)", background: "var(--zn-bg-2)" }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 transition-colors hover:bg-[#f3ecd8] dark:hover:bg-[#2d2820]"
      >
        <div className="flex items-center gap-2">
          <Trash2 className="size-3.5" style={{ color: "var(--zn-ink-3)" }} />
          <span className="text-[12.5px] font-medium" style={{ color: "var(--zn-ink-2)" }}>
            Recently deleted ({entries.length})
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px]" style={{ color: "var(--zn-ink-3)" }}>
            Kept for 30 days
          </span>
          {open
            ? <ChevronUp   className="size-3.5" style={{ color: "var(--zn-ink-3)" }} />
            : <ChevronDown className="size-3.5" style={{ color: "var(--zn-ink-3)" }} />}
        </div>
      </button>

      {open && (
        <div className="border-t divide-y" style={{ borderColor: "var(--zn-line-soft)" }}>
          {entries.map((e) => {
            const daysLeft = Math.ceil(
              (new Date(e.deletedAt).getTime() + DELETED_RETENTION_DAYS * 86_400_000 - Date.now()) / 86_400_000,
            );
            return (
              <div key={e.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-[12.5px] font-medium truncate" style={{ color: "var(--zn-ink-2)" }}>
                    {e.description || e.category}
                  </p>
                  <p className="text-[11px]" style={{ color: "var(--zn-ink-3)" }}>
                    {e.category} · {fmtDate(e.date)} · expires in {daysLeft}d
                  </p>
                </div>
                <span className="text-[12.5px] tabular-nums flex-shrink-0" style={{ color: "var(--zn-ink-2)" }}>
                  {fmtGBP(e.amount)}
                </span>
                <button
                  type="button"
                  onClick={() => onRestore(e.id)}
                  className="flex items-center gap-1 rounded-full px-3 py-1.5 text-[11.5px] font-semibold flex-shrink-0"
                  style={{
                    background:  "var(--zn-surface)",
                    border:      "1px solid var(--zn-line)",
                    color:       "var(--zn-ink-2)",
                  }}
                >
                  <RotateCcw className="size-3" />
                  Restore
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function ExpensePageClient() {
  const [entries,   setEntries]   = useState<RichEntry[]>([]);
  const [hydrated,  setHydrated]  = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>("all");
  const [importableCount, setImportableCount] = useState(0);
  const [importing, setImporting] = useState(false);
  const [importedCount, setImportedCount] = useState<number | null>(null);
  const [pendingDeletion, setPendingDeletion] = useState<PendingDeletion | null>(null);
  const [deletedEntries, setDeletedEntries]   = useState<DeletedEntry[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sort, setSort] = useState<"newest" | "oldest" | "highest">("newest");

  useEffect(() => {
    const loaded = loadFromStorage();
    setEntries(loaded);
    setDeletedEntries(loadDeletedFromStorage());
    const debits = loadBankDebits();
    setImportableCount(countImportable(debits, loaded));
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) saveToStorage(entries);
  }, [entries, hydrated]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleAdd = useCallback((entry: RichEntry) => {
    setEntries((prev) => [entry, ...prev]);
  }, []);

  const handleDelete = useCallback((id: string) => {
    // Commit any previously pending deletion before starting a new one
    setPendingDeletion((prev) => {
      if (prev) {
        clearTimeout(prev.timerId);
        permanentlyDelete(prev.entry);
        setDeletedEntries(loadDeletedFromStorage());
      }
      return null;
    });

    setEntries((current) => {
      const entry = current.find((e) => e.id === id);
      if (!entry) return current;

      const timerId = setTimeout(() => {
        permanentlyDelete(entry);
        setDeletedEntries(loadDeletedFromStorage());
        setPendingDeletion(null);
      }, 5000);

      setPendingDeletion({ entry, timerId });
      return current.filter((e) => e.id !== id);
    });
  }, []);

  const handleUndo = useCallback(() => {
    setPendingDeletion((prev) => {
      if (!prev) return null;
      clearTimeout(prev.timerId);
      setEntries((current) => {
        // Re-insert at original position by date
        const updated = [prev.entry, ...current];
        updated.sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
        return updated;
      });
      return null;
    });
  }, []);

  const handleAllowabilityChange = useCallback((id: string, value: Allowability) => {
    setEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, allowability: value } : e)),
    );
  }, []);

  const handleVatChange = useCallback((id: string, vatRate: number, vatAmount: number) => {
    setEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, vatRate, vatAmount } : e)),
    );
  }, []);

  const handleCategoryChange = useCallback((id: string, cat: string) => {
    setEntries(prev => prev.map(e => e.id === id ? { ...e, category: cat } : e));
  }, []);

  function handleRestore(id: string) {
    const entry = deletedEntries.find((d) => d.id === id);
    if (!entry) return;
    const { deletedAt: _deletedAt, ...restored } = entry;
    setEntries((prev) => [restored, ...prev]);
    const updated = deletedEntries.filter((d) => d.id !== id);
    setDeletedEntries(updated);
    saveDeletedToStorage(updated);
  }

  function handleBankImport() {
    if (importing) return;
    setImporting(true);

    const debits = loadBankDebits();
    const current = entries;
    const newEntries: RichEntry[] = [];

    for (const tx of debits) {
      const alreadyExists = current.some(
        (e) =>
          e.date === tx.date &&
          Math.abs(e.amount - Math.abs(tx.amount)) < 0.01 &&
          e.description.toLowerCase() === tx.description.toLowerCase(),
      );
      if (alreadyExists) continue;

      const { category, allowability } = classifyExpense(tx.description);
      newEntries.push({
        id:           crypto.randomUUID(),
        date:         tx.date,
        amount:       Math.abs(tx.amount),
        category,
        description:  tx.description,
        allowability,
        source:       "bank-import",
      });
    }

    setEntries((prev) => [...newEntries, ...prev]);
    setImportableCount(0);
    setImportedCount(newEntries.length);
    setImporting(false);

    // Jump to All tab so the user sees review items
    setActiveTab("all");
  }

  function handleBulkReceiptImport(results: BulkReceiptResult[]) {
    const newEntries: RichEntry[] = results
      .filter((r) => r.amount > 0)
      .map((r) => {
        const rawCat = (r.category ?? "").trim();
        const category = (EXPENSE_CATEGORIES as readonly string[]).includes(rawCat)
          ? rawCat
          : "Other";
        return {
          id:           crypto.randomUUID(),
          date:         r.date,
          amount:       r.amount,
          category,
          description:  r.vendor,
          allowability: "allowable" as Allowability, // AI-confirmed so default allowable
          source:       "bank-import" as const,
          ...(r.vatAmount != null && r.vatRate != null
            ? { vatRate: r.vatRate, vatAmount: r.vatAmount }
            : {}),
        };
      });
    if (newEntries.length === 0) return;
    setEntries((prev) => [...newEntries, ...prev]);
    setImportedCount(newEntries.length);
    setActiveTab("all");
  }

  // ── Derived values ────────────────────────────────────────────────────────

  const allowableEntries    = entries.filter((e) => e.allowability === "allowable");
  const notAllowableEntries = entries.filter((e) => e.allowability === "not-allowable");
  const reviewEntries       = entries.filter((e) => e.allowability === "review");
  const allowableTotal      = allowableEntries.reduce((s, e) => s + e.amount, 0);

  const totalGross      = entries.reduce((s, e) => s + e.amount, 0);
  const totalVatReclaim = allowableEntries.reduce((s, e) => s + (e.vatAmount ?? 0), 0);
  const totalNotAllow   = notAllowableEntries.reduce((s, e) => s + e.amount, 0);
  const taxSaving       = allowableTotal * 0.20;
  const pctClaimable    = totalGross > 0 ? Math.round((allowableTotal / totalGross) * 100) : 0;

  const selectedExpense = selectedId ? entries.find(e => e.id === selectedId) ?? null : null;

  // What to render in the list area based on active tab
  const displayEntries: RichEntry[] =
    activeTab === "review"        ? reviewEntries :
    activeTab === "not-allowable" ? notAllowableEntries :
    entries; // "all"

  const sortedEntries = [...displayEntries].sort((a, b) => {
    if (sort === "oldest")  return a.date.localeCompare(b.date);
    if (sort === "highest") return b.amount - a.amount;
    return b.date.localeCompare(a.date); // newest
  });

  const grouped = groupByMonth(sortedEntries.filter((e) => e.allowability !== "review" || activeTab !== "all"));

  return (
    <div className="space-y-5">

      {/* ── Page heading ──────────────────────────────────────────────────── */}
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
        <div className="flex items-center gap-2 flex-wrap">
          <BulkReceiptImport onImport={handleBulkReceiptImport} />
          <AddExpensePanel onAdd={handleAdd} />
        </div>
      </div>

      {/* ── Bank import banner ────────────────────────────────────────────── */}
      {hydrated && (
        <>
          <BankImportBanner
            count={importableCount}
            onImport={handleBankImport}
            importing={importing}
          />
          {importedCount !== null && importedCount > 0 && (
            <div
              className="flex items-center gap-2 rounded-[10px] px-4 py-3"
              style={{ background: "var(--zn-safe-soft)", border: "1px solid var(--zn-safe)" }}
            >
              <CheckCircle2 className="size-3.5" style={{ color: "var(--zn-safe)" }} />
              <span className="text-[12.5px] font-medium" style={{ color: "var(--zn-safe)" }}>
                {importedCount} transaction{importedCount > 1 ? "s" : ""} imported — review and classify below.
              </span>
            </div>
          )}
        </>
      )}

      {/* ── KPI stat cards ────────────────────────────────────────────────── */}
      {entries.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <StatCard label="Total gross"      value={fmtGBP(totalGross)} />
          <StatCard label="Claimable net"    value={fmtGBP(allowableTotal)}  accent="var(--zn-safe)" sub={`${pctClaimable}% of expenditure`} />
          <StatCard label="Est. tax saving"  value={fmtGBP(taxSaving)}       accent="var(--zn-safe)" sub="@ 20% basic rate" />
          <StatCard label="VAT reclaimable"  value={fmtGBP(totalVatReclaim)} accent="var(--zn-info)" sub={totalVatReclaim > 0 ? "confirmed reclaimable" : "No VAT logged yet"} />
          <StatCard label="Not allowable"    value={fmtGBP(totalNotAllow)}   accent={totalNotAllow > 0 ? "var(--zn-risk)" : "var(--zn-ink-3)"} sub={`${notAllowableEntries.length} item${notAllowableEntries.length !== 1 ? "s" : ""}`} />
        </div>
      )}

      {/* ── Category breakdown (allowable entries only) ───────────────────── */}
      {allowableEntries.length > 0 && <CategoryBreakdown entries={allowableEntries} />}

      {/* ── Empty state ───────────────────────────────────────────────────── */}
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
          <p className="mt-1 text-[12.5px] max-w-sm mx-auto" style={{ color: "var(--zn-ink-3)" }}>
            Upload a bank statement in the{" "}
            <a href="/banking" className="underline" style={{ color: "var(--zn-ink-2)" }}>Bank feed</a>{" "}
            to import your transactions automatically, or add expenses manually above.
          </p>
        </div>
      )}

      {/* ── Tabs ─────────────────────────────────────────────────────────── */}
      {entries.length > 0 && (
        <div className="flex items-center gap-0 border-b" style={{ borderColor: "var(--zn-line-soft)" }}>
          {([
            ["all",          "All",           entries.length,           undefined],
            ["review",       "Needs review",  reviewEntries.length,     "var(--zn-warn)"],
            ["not-allowable","Not allowable", notAllowableEntries.length,"var(--zn-risk)"],
          ] as [ActiveTab, string, number, string | undefined][]).map(([id, label, count, warningColor]) => (
            <button key={id} type="button" onClick={() => setActiveTab(id)}
              className="relative px-3 py-2.5 text-[12.5px] font-medium transition-colors whitespace-nowrap"
              style={{
                color: activeTab === id ? "var(--zn-ink)"
                     : warningColor && count > 0 ? warningColor
                     : "var(--zn-ink-3)",
              }}>
              {label}
              {count > 0 && id !== "all" && (
                <span className="ml-1 text-[10.5px] tabular-nums opacity-70">({count})</span>
              )}
              {activeTab === id && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] rounded-t-full" style={{ background: "var(--zn-ink)" }} />
              )}
            </button>
          ))}
          <div className="ml-auto pb-1">
            <select
              value={sort}
              onChange={e => setSort(e.target.value as typeof sort)}
              className="text-[12px] rounded-lg border px-2.5 py-1.5 cursor-pointer"
              style={{ borderColor: "var(--zn-line)", color: "var(--zn-ink-2)", background: "var(--zn-surface)" }}>
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="highest">Highest amount</option>
            </select>
          </div>
        </div>
      )}

      {/* ── Two-column layout: list + detail panel ───────────────────────── */}
      <div className="lg:grid lg:grid-cols-[1fr_380px] lg:gap-5 lg:items-start">
        {/* Left: list */}
        <div className="space-y-3">
          {/* ── Review section (All tab only) */}
          {activeTab === "all" && (
            <ReviewSection
              entries={reviewEntries}
              onAllowabilityChange={handleAllowabilityChange}
            />
          )}

          {/* ── Empty tab state */}
          {entries.length > 0 && displayEntries.length === 0 && activeTab !== "all" && (
            <div
              className="rounded-[14px] border px-5 py-6 text-center"
              style={{ borderColor: "var(--zn-line-soft)", background: "var(--zn-bg-2)" }}
            >
              <p className="text-[13px]" style={{ color: "var(--zn-ink-3)" }}>
                {activeTab === "review"
                  ? "No expenses need review."
                  : "No personal/non-allowable expenses."}
              </p>
            </div>
          )}

          {/* ── Monthly groups */}
          {grouped.map(({ ym, entries: monthEntries }) => (
            <MonthGroup
              key={ym}
              ym={ym}
              entries={monthEntries}
              onDelete={handleDelete}
              onAllowabilityChange={handleAllowabilityChange}
              onVatChange={handleVatChange}
              onRowClick={id => setSelectedId(id)}
              selectedId={selectedId}
            />
          ))}
        </div>

        {/* Right: detail panel */}
        <div className="hidden lg:block">
          {selectedExpense ? (
            <DetailPanel
              expense={selectedExpense}
              onCategoryChange={handleCategoryChange}
              onAllowabilityChange={handleAllowabilityChange}
              onVatChange={handleVatChange}
            />
          ) : (
            <div className="zn-card px-5 py-12 text-center text-[13px]" style={{ color: "var(--zn-ink-3)" }}>
              Select an expense to see details, HMRC rule, and adjust allowability.
            </div>
          )}
        </div>
      </div>

      {/* ── Recently deleted ──────────────────────────────────────────────── */}
      {hydrated && (
        <RecentlyDeleted entries={deletedEntries} onRestore={handleRestore} />
      )}

      {/* Fine print */}
      {entries.length > 0 && (
        <p className="text-[11.5px] text-center pb-2" style={{ color: "var(--zn-ink-3)" }}>
          Figures are for planning purposes only. Always consult an accountant for your
          actual Self Assessment return. HMRC rules on allowable expenses apply.
        </p>
      )}

      {/* ── Undo toast ───────────────────────────────────────────────────── */}
      {pendingDeletion && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-xl px-4 py-3 shadow-xl"
          style={{
            background:  "var(--zn-ink)",
            color:       "var(--zn-bg)",
            whiteSpace:  "nowrap",
          }}
        >
          <span className="text-[13px]">
            Expense deleted
          </span>
          <button
            type="button"
            onClick={handleUndo}
            className="flex items-center gap-1.5 text-[13px] font-semibold underline underline-offset-2"
            style={{ color: "var(--zn-bg)" }}
          >
            <RotateCcw className="size-3.5" />
            Undo
          </button>
        </div>
      )}
    </div>
  );
}
