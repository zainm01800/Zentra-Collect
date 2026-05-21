"use client";

/**
 * Bills — what the business owes to suppliers.
 * Fully localStorage-backed (zentra.bills.v1). No server round-trip.
 */

import { useEffect, useState, useCallback } from "react";
import { Plus, CheckCircle2, Clock, AlertCircle, Trash2, X } from "lucide-react";
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
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(bills)); } catch {}
}

function daysUntil(isoDate: string): number {
  return Math.ceil((new Date(isoDate).getTime() - Date.now()) / 86_400_000);
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

interface AddBillFormProps { onAdd: (bill: Bill) => void; onClose: () => void; }

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

// ── Main component ────────────────────────────────────────────────────────────

export function BillsClient() {
  const [bills, setBills]       = useState<Bill[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter]     = useState<"all" | BillStatus>("all");

  useEffect(() => {
    setBills(loadBills());
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

  function markPaid(id: string) {
    updateBills((prev) => prev.map((b) => b.id === id ? { ...b, status: "paid" } : b));
  }

  function markUnpaid(id: string) {
    updateBills((prev) => prev.map((b) => b.id === id ? { ...b, status: "unpaid" } : b));
  }

  function deleteBill(id: string) {
    updateBills((prev) => prev.filter((b) => b.id !== id));
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

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-bold tracking-tight" style={{ color: "var(--zn-ink)" }}>Bills</h1>
          <p className="mt-1 text-[13px]" style={{ color: "var(--zn-ink-3)" }}>
            What your business owes
          </p>
        </div>
        <div className="flex items-center gap-2">
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
              <div
                key={bill.id}
                className="rounded-xl px-4 py-3.5 flex items-center gap-3"
                style={{
                  background:  "var(--zn-surface)",
                  border:      `1px solid ${bill.status === "overdue" ? "var(--zn-risk)" : "var(--zn-line-soft)"}`,
                }}
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
                      onClick={() => markPaid(bill.id)}
                      title="Mark as paid"
                      className="size-7 rounded-lg flex items-center justify-center transition-colors hover:bg-[var(--zn-safe-soft)]"
                      style={{ color: "var(--zn-safe)" }}
                    >
                      <CheckCircle2 className="size-4" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => markUnpaid(bill.id)}
                      title="Mark as unpaid"
                      className="size-7 rounded-lg flex items-center justify-center transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                      style={{ color: "var(--zn-ink-3)" }}
                    >
                      <Clock className="size-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => deleteBill(bill.id)}
                    title="Delete bill"
                    className="size-7 rounded-lg flex items-center justify-center transition-colors hover:bg-[var(--zn-risk-soft)]"
                    style={{ color: "var(--zn-ink-3)" }}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
