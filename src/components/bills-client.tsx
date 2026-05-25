"use client";

/**
 * Bills — what the business owes to suppliers.
 * Fully localStorage-backed (zentra.bills.v1). No server round-trip.
 */

import { useEffect, useState, useCallback } from "react";
import { Plus, CheckCircle2, Clock, AlertCircle, Trash2, X, Landmark } from "lucide-react";
import { cn } from "@/lib/utils";
import { SectionCsvImport } from "@/components/section-csv-import";
import type { ImportResult } from "@/components/section-csv-import";

// ── Types ─────────────────────────────────────────────────────────────────────

export type BillStatus = "unpaid" | "paid" | "overdue";

export interface Bill {
  id:          string;
  supplier:    string;
  description: string;
  amount:      number;
  dueDate:     string; // YYYY-MM-DD
  category:    string;
  status:      BillStatus;
  createdAt:   string;
}

const STORAGE_KEY = "zentra.bills.v1";

const CATEGORIES = [
  "Rent & rates",
  "Utilities",
  "Subscriptions",
  "Professional services",
  "Insurance",
  "Equipment",
  "Advertising",
  "Contractor",
  "Bank charges",
  "Other",
];

// ── Helpers ───────────────────────────────────────────────────────────────────

const GBP = (n: number) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency", currency: "GBP",
    minimumFractionDigits: 0, maximumFractionDigits: 2,
  }).format(n);

function inferStatus(bill: Bill): BillStatus {
  if (bill.status === "paid") return "paid";
  const due = new Date(bill.dueDate).getTime();
  return due < Date.now() ? "overdue" : "unpaid";
}

function loadBills(): Bill[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Bill[];
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function saveBills(bills: Bill[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(bills));
    void import("@/lib/sync/workspace-sync").then(({ pushDataType, getLocalSupabaseAccountId }) => {
      const id = getLocalSupabaseAccountId();
      if (id) return pushDataType("bills", id);
    }).catch(() => {});
  } catch {}
}

function daysUntil(isoDate: string): number {
  return Math.ceil((new Date(isoDate).getTime() - Date.now()) / 86_400_000);
}

// ── Bank import helpers ───────────────────────────────────────────────────────

const BANK_STATEMENT_KEY = "zentra.bankStatement.v1";

interface BankTx { date: string; description: string; amount: number; }

function loadBankDebits(): BankTx[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(BANK_STATEMENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as BankTx[];
    return Array.isArray(parsed) ? parsed.filter((t) => t.amount < 0) : [];
  } catch { return []; }
}

function countImportable(debits: BankTx[], existing: Bill[]): number {
  return debits.filter((tx) =>
    !existing.some(
      (b) =>
        b.dueDate === tx.date &&
        Math.abs(b.amount - Math.abs(tx.amount)) < 0.01 &&
        b.supplier.toLowerCase() === tx.description.toLowerCase(),
    ),
  ).length;
}

/** Infer a Bill category from the transaction description. */
function inferBillCategory(desc: string): string {
  const d = desc.toLowerCase();
  if (/rent|rates|office|workspace|wework|regus/.test(d))              return "Rent & rates";
  if (/electric|gas|water|edf|eon|british gas|utility|utilit/.test(d)) return "Utilities";
  if (/vodafone|o2|ee |three|bt |virgin|broadband|mobile|phone/.test(d)) return "Utilities";
  if (/spotify|netflix|adobe|microsoft|google|aws|azure|dropbox|slack|zoom|github|canva|notion|figma|xero|quickbooks|sage/.test(d)) return "Subscriptions";
  if (/insurance|hiscox|axa|aviva|zurich|allianz/.test(d))             return "Insurance";
  if (/bank charge|bank fee|overdraft|interest|hsbc|barclays|lloyds|natwest|starling|monzo/.test(d)) return "Bank charges";
  if (/solicitor|barrister|legal|accountant|consultant/.test(d))        return "Professional services";
  if (/laptop|computer|hardware|equipment|server/.test(d))              return "Equipment";
  if (/facebook|google ads|meta ads|linkedin ads|advertising/.test(d))  return "Advertising";
  if (/contractor|freelance|subcontract/.test(d))                       return "Contractor";
  return "Other";
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: BillStatus }) {
  const cfg = {
    paid:    { icon: CheckCircle2, bg: "var(--zn-safe-soft)",  fg: "var(--zn-safe)",  label: "Paid" },
    unpaid:  { icon: Clock,        bg: "var(--zn-info-soft)",  fg: "var(--zn-info)",  label: "Unpaid" },
    overdue: { icon: AlertCircle,  bg: "var(--zn-risk-soft)",  fg: "var(--zn-risk)",  label: "Overdue" },
  }[status];
  const Icon = cfg.icon;
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium"
      style={{ background: cfg.bg, color: cfg.fg }}
    >
      <Icon className="size-3" />
      {cfg.label}
    </span>
  );
}

interface AddBillFormProps  { onAdd:  (bill: Bill) => void; onClose: () => void; }
interface EditBillFormProps { bill: Bill; onSave: (bill: Bill) => void; onClose: () => void; }

function EditBillForm({ bill, onSave, onClose }: EditBillFormProps) {
  const [supplier, setSupplier]       = useState(bill.supplier);
  const [description, setDescription] = useState(bill.description);
  const [amount, setAmount]           = useState(String(bill.amount));
  const [dueDate, setDueDate]         = useState(bill.dueDate);
  const [category, setCategory]       = useState(bill.category);
  const [error, setError]             = useState("");

  function submit() {
    const amt = parseFloat(amount);
    if (!supplier.trim()) { setError("Supplier name is required."); return; }
    if (!amt || amt <= 0)  { setError("Enter a valid amount."); return; }
    if (!dueDate)          { setError("Due date is required."); return; }
    onSave({
      ...bill,
      supplier:    supplier.trim(),
      description: description.trim(),
      amount:      Math.round(amt * 100) / 100,
      dueDate,
      category,
    });
  }

  const fieldCls = "w-full rounded-lg px-3 py-2 text-[13px] outline-none";
  const fieldStyle = {
    background: "var(--zn-surface)",
    border: "1px solid var(--zn-line)",
    color: "var(--zn-ink)",
  };

  return (
    <div
      className="rounded-2xl p-5 flex flex-col gap-3"
      style={{ background: "var(--zn-surface-2)", border: "1px solid var(--zn-line-soft)" }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between">
        <h2 className="text-[14px] font-semibold" style={{ color: "var(--zn-ink)" }}>Edit bill</h2>
        <button type="button" onClick={onClose} style={{ color: "var(--zn-ink-3)" }}>
          <X className="size-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1 col-span-2 sm:col-span-1">
          <label className="text-[11px] font-medium uppercase tracking-[0.08em]" style={{ color: "var(--zn-ink-3)" }}>Supplier *</label>
          <input className={fieldCls} style={fieldStyle} placeholder="e.g. ACME Ltd" value={supplier} onChange={(e) => setSupplier(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1 col-span-2 sm:col-span-1">
          <label className="text-[11px] font-medium uppercase tracking-[0.08em]" style={{ color: "var(--zn-ink-3)" }}>Amount (£) *</label>
          <input className={fieldCls} style={fieldStyle} placeholder="0.00" type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium uppercase tracking-[0.08em]" style={{ color: "var(--zn-ink-3)" }}>Due date *</label>
          <input className={fieldCls} style={fieldStyle} type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium uppercase tracking-[0.08em]" style={{ color: "var(--zn-ink-3)" }}>Category</label>
          <select className={fieldCls} style={fieldStyle} value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1 col-span-2">
          <label className="text-[11px] font-medium uppercase tracking-[0.08em]" style={{ color: "var(--zn-ink-3)" }}>Description</label>
          <input className={fieldCls} style={fieldStyle} placeholder="Optional note" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
      </div>

      {error && <p className="text-[12px]" style={{ color: "var(--zn-risk)" }}>{error}</p>}

      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-[13px]" style={{ color: "var(--zn-ink-2)" }}>Cancel</button>
        <button
          type="button" onClick={submit}
          className="px-4 py-2 rounded-full text-[13px] font-semibold"
          style={{ background: "var(--zn-ink)", color: "var(--background)" }}
        >
          Save
        </button>
      </div>
    </div>
  );
}

function AddBillForm({ onAdd, onClose }: AddBillFormProps) {
  const today = new Date().toISOString().slice(0, 10);
  const [supplier, setSupplier]       = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount]           = useState("");
  const [dueDate, setDueDate]         = useState(today);
  const [category, setCategory]       = useState(CATEGORIES[0]);
  const [error, setError]             = useState("");

  function submit() {
    const amt = parseFloat(amount);
    if (!supplier.trim()) { setError("Supplier name is required."); return; }
    if (!amt || amt <= 0)  { setError("Enter a valid amount."); return; }
    if (!dueDate)          { setError("Due date is required."); return; }
    onAdd({
      id:          crypto.randomUUID(),
      supplier:    supplier.trim(),
      description: description.trim(),
      amount:      Math.round(amt * 100) / 100,
      dueDate,
      category,
      status:      "unpaid",
      createdAt:   new Date().toISOString(),
    });
  }

  const fieldCls = "w-full rounded-lg px-3 py-2 text-[13px] outline-none";
  const fieldStyle = {
    background: "var(--zn-surface)",
    border: "1px solid var(--zn-line)",
    color: "var(--zn-ink)",
  };

  return (
    <div
      className="rounded-2xl p-5 flex flex-col gap-3"
      style={{ background: "var(--zn-surface)", border: "1px solid var(--zn-line-soft)" }}
    >
      <div className="flex items-center justify-between">
        <h2 className="text-[14px] font-semibold" style={{ color: "var(--zn-ink)" }}>Add bill</h2>
        <button type="button" onClick={onClose} style={{ color: "var(--zn-ink-3)" }}>
          <X className="size-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1 col-span-2 sm:col-span-1">
          <label className="text-[11px] font-medium uppercase tracking-[0.08em]" style={{ color: "var(--zn-ink-3)" }}>Supplier *</label>
          <input className={fieldCls} style={fieldStyle} placeholder="e.g. ACME Ltd" value={supplier} onChange={(e) => setSupplier(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1 col-span-2 sm:col-span-1">
          <label className="text-[11px] font-medium uppercase tracking-[0.08em]" style={{ color: "var(--zn-ink-3)" }}>Amount (£) *</label>
          <input className={fieldCls} style={fieldStyle} placeholder="0.00" type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium uppercase tracking-[0.08em]" style={{ color: "var(--zn-ink-3)" }}>Due date *</label>
          <input className={fieldCls} style={fieldStyle} type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium uppercase tracking-[0.08em]" style={{ color: "var(--zn-ink-3)" }}>Category</label>
          <select className={fieldCls} style={fieldStyle} value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1 col-span-2">
          <label className="text-[11px] font-medium uppercase tracking-[0.08em]" style={{ color: "var(--zn-ink-3)" }}>Description</label>
          <input className={fieldCls} style={fieldStyle} placeholder="Optional note" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
      </div>

      {error && <p className="text-[12px]" style={{ color: "var(--zn-risk)" }}>{error}</p>}

      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-[13px]" style={{ color: "var(--zn-ink-2)" }}>Cancel</button>
        <button
          type="button" onClick={submit}
          className="px-4 py-2 rounded-full text-[13px] font-semibold"
          style={{ background: "var(--zn-ink)", color: "var(--background)" }}
        >
          Add bill
        </button>
      </div>
    </div>
  );
}

// ── Bank import dialog ────────────────────────────────────────────────────────

interface BankImportDialogProps {
  debits:   BankTx[];
  existing: Bill[];
  onImport: (bills: Bill[]) => void;
  onClose:  () => void;
}

function BankImportDialog({ debits, existing, onImport, onClose }: BankImportDialogProps) {
  const importable = debits.filter((tx) =>
    !existing.some(
      (b) =>
        b.dueDate === tx.date &&
        Math.abs(b.amount - Math.abs(tx.amount)) < 0.01 &&
        b.supplier.toLowerCase() === tx.description.toLowerCase(),
    ),
  );

  const [selected,   setSelected]   = useState<Set<number>>(() => new Set(importable.map((_, i) => i)));
  const [categories, setCategories] = useState<string[]>(() => importable.map((tx) => inferBillCategory(tx.description)));

  function toggle(i: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  }

  function handleImport() {
    const bills: Bill[] = [];
    for (const i of selected) {
      const tx = importable[i];
      bills.push({
        id:          crypto.randomUUID(),
        supplier:    tx.description,
        description: "",
        amount:      Math.abs(tx.amount),
        dueDate:     tx.date,
        category:    categories[i],
        status:      "paid",   // already left the account
        createdAt:   new Date().toISOString(),
      });
    }
    onImport(bills);
    onClose();
  }

  if (importable.length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
        <div
          className="rounded-2xl p-6 max-w-sm w-full mx-4 text-center"
          style={{ background: "var(--zn-surface)", border: "1px solid var(--zn-line)" }}
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-[14px] font-semibold" style={{ color: "var(--zn-ink)" }}>All caught up</p>
          <p className="mt-1 text-[12.5px]" style={{ color: "var(--zn-ink-3)" }}>
            Every debit in your bank statement is already in Bills.
          </p>
          <button onClick={onClose} className="mt-4 text-[12px]" style={{ color: "var(--zn-ink-3)" }}>Close</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[80vh] flex flex-col"
        style={{ background: "var(--zn-surface)", border: "1px solid var(--zn-line)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b" style={{ borderColor: "var(--zn-line-soft)" }}>
          <div>
            <p className="text-[14px] font-semibold" style={{ color: "var(--zn-ink)" }}>Import from bank statement</p>
            <p className="text-[12px] mt-0.5" style={{ color: "var(--zn-ink-3)" }}>
              {importable.length} debit{importable.length !== 1 ? "s" : ""} not yet in Bills · status set to Paid
            </p>
          </div>
          <button onClick={onClose} style={{ color: "var(--zn-ink-3)" }}><X className="size-4" /></button>
        </div>

        {/* List */}
        <div className="overflow-y-auto flex-1 px-5 py-3 space-y-2">
          {importable.map((tx, i) => (
            <div
              key={i}
              className="flex items-start gap-3 rounded-xl px-3 py-2.5 cursor-pointer transition-colors"
              style={{
                background: selected.has(i) ? "var(--zn-info-soft)" : "var(--zn-surface-alt, var(--zn-line-soft))",
                border: `1px solid ${selected.has(i) ? "color-mix(in srgb, var(--zn-info) 30%, transparent)" : "transparent"}`,
              }}
              onClick={() => toggle(i)}
            >
              {/* Checkbox */}
              <div
                className="mt-0.5 size-4 rounded flex-shrink-0 flex items-center justify-center"
                style={{
                  background: selected.has(i) ? "var(--zn-info)" : "transparent",
                  border: `2px solid ${selected.has(i) ? "var(--zn-info)" : "var(--zn-line)"}`,
                }}
              >
                {selected.has(i) && <CheckCircle2 className="size-3 text-white" />}
              </div>

              {/* Details */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[12.5px] font-semibold truncate" style={{ color: "var(--zn-ink)" }}>{tx.description}</p>
                  <p className="text-[12.5px] font-bold tabular-nums flex-shrink-0" style={{ color: "var(--zn-risk)" }}>
                    −{GBP(Math.abs(tx.amount))}
                  </p>
                </div>
                <p className="text-[11px] mt-0.5" style={{ color: "var(--zn-ink-3)" }}>
                  {new Date(tx.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                </p>
                {/* Category picker — stop row toggle propagation */}
                <select
                  value={categories[i]}
                  onChange={(e) => {
                    e.stopPropagation();
                    const next = [...categories];
                    next[i] = e.target.value;
                    setCategories(next);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="mt-1.5 rounded-lg px-2 py-1 text-[11px] w-full"
                  style={{ background: "var(--zn-surface)", border: "1px solid var(--zn-line)", color: "var(--zn-ink)" }}
                >
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-t" style={{ borderColor: "var(--zn-line-soft)" }}>
          <button
            type="button"
            onClick={() => setSelected(selected.size === importable.length ? new Set() : new Set(importable.map((_, i) => i)))}
            className="text-[12px]"
            style={{ color: "var(--zn-ink-3)" }}
          >
            {selected.size === importable.length ? "Deselect all" : "Select all"}
          </button>
          <button
            type="button"
            disabled={selected.size === 0}
            onClick={handleImport}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full text-[12.5px] font-semibold disabled:opacity-50"
            style={{ background: "var(--zn-ink)", color: "var(--background)" }}
          >
            Add {selected.size} to Bills
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function BillsClient() {
  const [bills, setBills]             = useState<Bill[]>([]);
  const [hydrated, setHydrated]       = useState(false);
  const [showForm, setShowForm]       = useState(false);
  const [showBankImport, setShowBankImport] = useState(false);
  const [bankDebits, setBankDebits]   = useState<BankTx[]>([]);
  const [filter, setFilter]           = useState<"all" | BillStatus>("all");
  const [editingId, setEditingId]     = useState<string | null>(null);

  useEffect(() => {
    const loaded = loadBills();
    setBills(loaded);
    const debits = loadBankDebits();
    setBankDebits(debits);
    setHydrated(true);
  }, []);

  const updateBills = useCallback((updater: (prev: Bill[]) => Bill[]) => {
    setBills((prev) => {
      const next = updater(prev);
      saveBills(next);
      return next;
    });
  }, []);

  function handleCsvImport(result: ImportResult) {
    const today = new Date().toISOString().slice(0, 10);
    const newBills: Bill[] = [];
    for (const row of result.rows) {
      const rawAmt = (row.amount ?? "").replace(/[£$€,\s]/g, "");
      const amount = Math.round(parseFloat(rawAmt) * 100) / 100;
      if (!Number.isFinite(amount) || amount <= 0) continue;

      const supplier = (row.supplier ?? "").trim();
      if (!supplier) continue;

      const rawDue = row.dueDate ?? row.date ?? "";
      const dm = rawDue.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      const dueDate = dm
        ? `${dm[3]}-${dm[2].padStart(2, "0")}-${dm[1].padStart(2, "0")}`
        : /^\d{4}-\d{2}-\d{2}$/.test(rawDue) ? rawDue : today;

      const rawCat = (row.category ?? "").trim();
      const category = CATEGORIES.includes(rawCat) ? rawCat : "Other";

      newBills.push({
        id:          crypto.randomUUID(),
        supplier,
        description: (row.description ?? row.notes ?? "").trim(),
        amount,
        dueDate,
        category,
        status:      "unpaid",
        createdAt:   new Date().toISOString(),
      });
    }
    if (newBills.length === 0) return;
    updateBills((prev) => [...newBills, ...prev]);
  }

  function addBill(bill: Bill) {
    updateBills((prev) => [bill, ...prev]);
    setShowForm(false);
  }

  function handleBankImport(newBills: Bill[]) {
    if (newBills.length === 0) return;
    updateBills((prev) => [...newBills, ...prev]);
  }

  function markPaid(id: string) {
    updateBills((prev) => prev.map((b) => b.id === id ? { ...b, status: "paid" } : b));
  }

  function markUnpaid(id: string) {
    updateBills((prev) => prev.map((b) => b.id === id ? { ...b, status: "unpaid" } : b));
  }

  function deleteBill(id: string) {
    updateBills((prev) => prev.filter((b) => b.id !== id));
  }

  function handleEditSave(updated: Bill) {
    updateBills((prev) => prev.map((b) => b.id === updated.id ? updated : b));
    setEditingId(null);
  }

  // Compute live statuses (overdue if unpaid + past due date)
  const enriched = bills.map((b) => ({ ...b, status: inferStatus(b) }));

  const totals = {
    outstanding: enriched.filter((b) => b.status !== "paid").reduce((s, b) => s + b.amount, 0),
    overdue:     enriched.filter((b) => b.status === "overdue").reduce((s, b) => s + b.amount, 0),
    paid:        enriched.filter((b) => b.status === "paid").reduce((s, b) => s + b.amount, 0),
  };

  const filtered = filter === "all" ? enriched : enriched.filter((b) => b.status === filter);
  const sorted   = [...filtered].sort((a, b) => {
    if (a.status === "overdue" && b.status !== "overdue") return -1;
    if (b.status === "overdue" && a.status !== "overdue") return 1;
    return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
  });

  const tabs: Array<{ key: "all" | BillStatus; label: string; count: number }> = [
    { key: "all",     label: "All",     count: enriched.length },
    { key: "overdue", label: "Overdue", count: enriched.filter((b) => b.status === "overdue").length },
    { key: "unpaid",  label: "Unpaid",  count: enriched.filter((b) => b.status === "unpaid").length },
    { key: "paid",    label: "Paid",    count: enriched.filter((b) => b.status === "paid").length },
  ];

  if (!hydrated) return null;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 flex flex-col gap-6">

      {/* Bank import dialog */}
      {showBankImport && (
        <BankImportDialog
          debits={bankDebits}
          existing={bills}
          onImport={handleBankImport}
          onClose={() => setShowBankImport(false)}
        />
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-bold tracking-tight" style={{ color: "var(--zn-ink)" }}>Bills</h1>
          <p className="mt-1 text-[13px]" style={{ color: "var(--zn-ink-3)" }}>
            What your business owes
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Bank import button — only shown when a statement is loaded */}
          {bankDebits.length > 0 && (() => {
            const count = countImportable(bankDebits, bills);
            return (
              <button
                type="button"
                onClick={() => setShowBankImport(true)}
                className="relative flex items-center gap-1.5 px-3 py-2 rounded-full text-[12.5px] font-semibold"
                style={{ background: "var(--zn-info-soft)", color: "var(--zn-info)", border: "1px solid color-mix(in srgb, var(--zn-info) 25%, transparent)" }}
              >
                <Landmark className="size-3.5" />
                Import from bank
                {count > 0 && (
                  <span
                    className="absolute -top-1.5 -right-1.5 size-4 rounded-full text-[9px] font-bold flex items-center justify-center"
                    style={{ background: "var(--zn-info)", color: "#fff" }}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })()}
          <SectionCsvImport
            title="Bills"
            fields={[
              { key: "supplier",    label: "Supplier",    synonyms: ["supplier", "vendor", "payee", "company", "name", "from", "creditor"],             required: true  },
              { key: "amount",      label: "Amount",      synonyms: ["amount", "total", "cost", "price", "value", "gross", "invoice total", "sum"],      required: true  },
              { key: "dueDate",     label: "Due date",    synonyms: ["due date", "due", "payment due", "due by", "pay by", "date"],                      required: true  },
              { key: "description", label: "Description", synonyms: ["description", "note", "notes", "details", "memo", "reference", "ref"]                            },
              { key: "category",    label: "Category",    synonyms: ["category", "cat", "type", "class", "expense type"]                                              },
            ]}
            onImport={handleCsvImport}
            example="Supplier, Amount, Due date, Description"
            sampleRows={[
              ["AWS Cloud Services",       "£142.80", "28/05/2026", "Monthly hosting — May 2026",         "Subscriptions"],
              ["Hiscox Business Insurance","£320.00", "15/06/2026", "Professional indemnity Q2 2026",      "Insurance"],
              ["WeWork Moorgate",          "£650.00", "01/06/2026", "Office desk rental — June 2026",      "Rent & rates"],
              ["Vodafone Business",        "£54.99",  "20/05/2026", "Mobile plan — May 2026",              "Utilities"],
              ["Adobe Creative Cloud",     "£84.98",  "10/06/2026", "Creative suite annual renewal",       "Subscriptions"],
              ["Royal Mail Business",      "£38.50",  "30/05/2026", "Postage account top-up",              "Other"],
            ]}
          />
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full text-[13px] font-semibold"
            style={{ background: "var(--zn-ink)", color: "var(--background)" }}
          >
            <Plus className="size-4" />
            Add bill
          </button>
        </div>
      </div>

      {/* Add form */}
      {showForm && <AddBillForm onAdd={addBill} onClose={() => setShowForm(false)} />}

      {/* Summary strip */}
      {bills.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Outstanding", value: totals.outstanding, color: totals.outstanding > 0 ? "var(--zn-risk)" : "var(--zn-ink)" },
            { label: "Overdue",     value: totals.overdue,     color: totals.overdue > 0 ? "var(--zn-risk)" : "var(--zn-ink)" },
            { label: "Paid",        value: totals.paid,        color: "var(--zn-safe)" },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-xl px-4 py-3" style={{ background: "var(--zn-surface)", border: "1px solid var(--zn-line-soft)" }}>
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em]" style={{ color: "var(--zn-ink-3)" }}>{label}</p>
              <p className="mt-1.5 text-[20px] font-bold tabular-nums" style={{ color }}>{GBP(value)}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tab filter */}
      {bills.length > 0 && (
        <div className="flex gap-1">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setFilter(t.key)}
              className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium transition-colors")}
              style={{
                background: filter === t.key ? "var(--zn-ink)" : "var(--zn-surface)",
                color:      filter === t.key ? "var(--background)" : "var(--zn-ink-2)",
                border:     filter === t.key ? "none" : "1px solid var(--zn-line)",
              }}
            >
              {t.label}
              {t.count > 0 && (
                <span
                  className="text-[10px] font-bold min-w-[16px] h-4 rounded-full flex items-center justify-center px-1 tabular-nums"
                  style={{
                    background: filter === t.key ? "rgba(255,255,255,0.2)" : "var(--zn-line)",
                    color: filter === t.key ? "var(--background)" : "var(--zn-ink-2)",
                  }}
                >
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Bill list */}
      {sorted.length === 0 ? (
        <div
          className="rounded-2xl px-6 py-12 text-center"
          style={{ background: "var(--zn-surface)", border: "1px solid var(--zn-line-soft)" }}
        >
          <p className="text-[15px] font-medium" style={{ color: "var(--zn-ink)" }}>
            {bills.length === 0 ? "No bills yet" : `No ${filter} bills`}
          </p>
          <p className="mt-1.5 text-[13px]" style={{ color: "var(--zn-ink-3)" }}>
            {bills.length === 0
              ? "Add supplier invoices or recurring costs to track what you owe."
              : "Try a different filter."}
          </p>
          {bills.length === 0 && (
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="mt-4 px-4 py-2 rounded-full text-[13px] font-semibold"
              style={{ background: "var(--zn-ink)", color: "var(--background)" }}
            >
              Add your first bill
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {sorted.map((bill) => {
            const days    = daysUntil(bill.dueDate);
            const dueText = bill.status === "paid"
              ? "Paid"
              : days === 0 ? "Due today"
              : days > 0   ? `Due in ${days}d`
              : `${Math.abs(days)}d overdue`;

            return (
              <div key={bill.id} className="flex flex-col gap-0">
              <div
                className="rounded-xl px-4 py-3.5 flex items-center gap-3 cursor-pointer hover:bg-[var(--zn-surface-2)]"
                style={{
                  background:  "var(--zn-surface)",
                  border:      `1px solid ${bill.status === "overdue" ? "var(--zn-risk)" : "var(--zn-line-soft)"}`,
                  borderBottomLeftRadius:  editingId === bill.id ? 0 : undefined,
                  borderBottomRightRadius: editingId === bill.id ? 0 : undefined,
                }}
                onClick={() => setEditingId(editingId === bill.id ? null : bill.id)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[13px] font-semibold truncate" style={{ color: "var(--zn-ink)" }}>
                      {bill.supplier}
                    </span>
                    <StatusBadge status={bill.status} />
                  </div>
                  {bill.description && (
                    <p className="text-[12px] truncate mt-0.5" style={{ color: "var(--zn-ink-3)" }}>{bill.description}</p>
                  )}
                  <p className="text-[11.5px] mt-0.5" style={{ color: bill.status === "overdue" ? "var(--zn-risk)" : "var(--zn-ink-3)" }}>
                    {dueText} · {bill.category}
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-[15px] font-bold tabular-nums" style={{ color: "var(--zn-ink)" }}>
                    {GBP(bill.amount)}
                  </span>
                  {bill.status !== "paid" ? (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); markPaid(bill.id); }}
                      title="Mark as paid"
                      className="size-7 rounded-lg flex items-center justify-center transition-colors hover:bg-[var(--zn-safe-soft)]"
                      style={{ color: "var(--zn-safe)" }}
                    >
                      <CheckCircle2 className="size-4" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); markUnpaid(bill.id); }}
                      title="Mark as unpaid"
                      className="size-7 rounded-lg flex items-center justify-center transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                      style={{ color: "var(--zn-ink-3)" }}
                    >
                      <Clock className="size-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); deleteBill(bill.id); }}
                    title="Delete bill"
                    className="size-7 rounded-lg flex items-center justify-center transition-colors hover:bg-[var(--zn-risk-soft)]"
                    style={{ color: "var(--zn-ink-3)" }}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
              {editingId === bill.id && (
                <EditBillForm
                  bill={bill}
                  onSave={handleEditSave}
                  onClose={() => setEditingId(null)}
                />
              )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
