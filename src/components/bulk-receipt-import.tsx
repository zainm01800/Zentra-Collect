"use client";

/**
 * bulk-receipt-import.tsx
 *
 * Bulk receipt / invoice importer for the Expenses section.
 * Accepts multiple image files (JPG, PNG, WebP, HEIC) and PDFs,
 * sends each to /api/receipts/extract for AI extraction, then shows
 * a review table where the user can correct any field before confirming.
 *
 * Designed to complement the single-file ReceiptScanButton — use this
 * when the user has a batch of receipts to process at once.
 */

import { useRef, useState } from "react";
import {
  Upload, X, FileText, Loader2, CheckCircle2,
  AlertTriangle, Check, ChevronDown,
} from "lucide-react";
import { EXPENSE_CATEGORIES } from "@/lib/expense-categories";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ExtractedReceiptFull {
  vendor?:        string;
  date?:          string;    // YYYY-MM-DD
  amount?:        number;
  currency?:      string;
  category?:      string;
  vatAmount?:     number | null;
  vatRate?:       number | null;
  invoiceNumber?: string | null;
}

export interface BulkReceiptResult {
  vendor:        string;
  date:          string;
  amount:        number;
  category:      string;
  vatAmount?:    number;
  vatRate?:      number;
  invoiceNumber?: string;
}

interface QueuedFile {
  id:       string;
  file:     File;
  status:   "pending" | "extracting" | "done" | "error";
  result?:  ExtractedReceiptFull;
  error?:   string;
}

interface Props {
  onImport: (results: BulkReceiptResult[]) => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const ACCEPTED = "image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function fmtGBP(n: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency", currency: "GBP",
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(n);
}

async function extractFromFile(file: File): Promise<ExtractedReceiptFull> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/receipts/extract", { method: "POST", body: form });
  if (!res.ok) {
    const data = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(data.error ?? `Server error ${res.status}`);
  }
  const { receipt } = await res.json() as { receipt: ExtractedReceiptFull };
  return receipt ?? {};
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function FileStatusIcon({ status }: { status: QueuedFile["status"] }) {
  if (status === "extracting") return <Loader2 className="size-4 animate-spin" style={{ color: "var(--zn-ink-3)" }} />;
  if (status === "done")       return <CheckCircle2 className="size-4" style={{ color: "var(--zn-safe)" }} />;
  if (status === "error")      return <AlertTriangle className="size-4" style={{ color: "var(--zn-risk)" }} />;
  return <FileText className="size-4" style={{ color: "var(--zn-ink-3)" }} />;
}

function CategorySelect({
  value, onChange,
}: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full appearance-none rounded-lg border px-2 py-1 text-[11.5px] pr-6"
        style={{
          borderColor: "var(--zn-line)",
          background:  "var(--zn-surface)",
          color:       "var(--zn-ink)",
        }}
      >
        {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        <option value="Other">Other</option>
      </select>
      <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 size-3 pointer-events-none" style={{ color: "var(--zn-ink-3)" }} />
    </div>
  );
}

function InlineField({
  type = "text", value, onChange, placeholder,
}: {
  type?:        string;
  value:        string;
  onChange:     (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-lg border px-2 py-1 text-[11.5px]"
      style={{
        borderColor: "var(--zn-line)",
        background:  "var(--zn-surface)",
        color:       "var(--zn-ink)",
      }}
    />
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function BulkReceiptImport({ onImport }: Props) {
  const [open, setOpen]       = useState(false);
  const [queue, setQueue]     = useState<QueuedFile[]>([]);
  const [running, setRunning] = useState(false);
  const [done, setDone]       = useState(false);
  const inputRef              = useRef<HTMLInputElement>(null);

  // Editable copies of the extracted results
  const [edits, setEdits]     = useState<Record<string, Partial<ExtractedReceiptFull>>>({});

  function reset() {
    setQueue([]);
    setEdits({});
    setRunning(false);
    setDone(false);
  }

  function close() {
    setOpen(false);
    reset();
  }

  function patchEdit(id: string, patch: Partial<ExtractedReceiptFull>) {
    setEdits((prev) => ({ ...prev, [id]: { ...(prev[id] ?? {}), ...patch } }));
  }

  function getResult(item: QueuedFile): ExtractedReceiptFull {
    return { ...(item.result ?? {}), ...(edits[item.id] ?? {}) };
  }

  async function processQueue(files: File[]) {
    if (running) return;
    setRunning(true);
    setDone(false);

    // Build initial queue
    const initial: QueuedFile[] = files.map((f) => ({
      id:     crypto.randomUUID(),
      file:   f,
      status: "pending",
    }));
    setQueue(initial);

    // Process one at a time to respect rate limits
    for (const item of initial) {
      setQueue((prev) =>
        prev.map((q) => q.id === item.id ? { ...q, status: "extracting" } : q),
      );
      try {
        const result = await extractFromFile(item.file);
        setQueue((prev) =>
          prev.map((q) =>
            q.id === item.id ? { ...q, status: "done", result } : q,
          ),
        );
      } catch (err) {
        setQueue((prev) =>
          prev.map((q) =>
            q.id === item.id
              ? { ...q, status: "error", error: err instanceof Error ? err.message : "Extraction failed" }
              : q,
          ),
        );
      }
    }
    setRunning(false);
    setDone(true);
  }

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const arr = Array.from(files).filter((f) => f.size <= 8 * 1024 * 1024);
    processQueue(arr);
  }

  function handleConfirm() {
    const results: BulkReceiptResult[] = [];
    for (const item of queue) {
      if (item.status !== "done") continue;
      const r = getResult(item);
      if (!r.vendor?.trim() || !r.amount || r.amount <= 0) continue;
      results.push({
        vendor:        r.vendor.trim(),
        date:          r.date ?? todayISO(),
        amount:        r.amount,
        category:      r.category?.trim() || "Other",
        vatAmount:     r.vatAmount ?? undefined,
        vatRate:       r.vatRate ?? undefined,
        invoiceNumber: r.invoiceNumber ?? undefined,
      });
    }
    onImport(results);
    close();
  }

  const doneCount  = queue.filter((q) => q.status === "done").length;
  const errorCount = queue.filter((q) => q.status === "error").length;
  const readyCount = queue.filter((q) => {
    const r = getResult(q);
    return q.status === "done" && r.vendor?.trim() && r.amount && r.amount > 0;
  }).length;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => { reset(); setOpen(true); }}
        className="zn-pill zn-pill-ghost flex items-center gap-1.5"
        style={{ height: 32, fontSize: 12, padding: "0 12px" }}
      >
        <Upload className="size-3.5" />
        Import receipts
      </button>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: "rgba(29,24,19,0.5)", backdropFilter: "blur(4px)" }}
    >
      <div
        className="w-full max-w-3xl rounded-2xl shadow-2xl flex flex-col max-h-[90dvh]"
        style={{ background: "var(--zn-surface)", border: "1px solid var(--zn-line)" }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b"
          style={{ borderColor: "var(--zn-line-soft)" }}
        >
          <div>
            <p className="text-sm font-semibold" style={{ color: "var(--zn-ink)" }}>
              Import receipts &amp; invoices
            </p>
            <p className="text-xs mt-0.5" style={{ color: "var(--zn-ink-3)" }}>
              AI reads each file and extracts vendor, amount, date &amp; VAT automatically
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            className="size-7 flex items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/5"
          >
            <X className="size-4" style={{ color: "var(--zn-ink-3)" }} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Drop zone — shown when no files yet */}
          {queue.length === 0 && (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
              onClick={() => inputRef.current?.click()}
              className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed py-12 cursor-pointer transition-colors hover:bg-[var(--zn-surface-2)]"
              style={{ borderColor: "var(--zn-line)" }}
            >
              <Upload className="size-9" style={{ color: "var(--zn-ink-3)" }} />
              <div className="text-center">
                <p className="text-sm font-medium" style={{ color: "var(--zn-ink)" }}>
                  Drop receipts and invoices here, or click to browse
                </p>
                <p className="text-xs mt-1" style={{ color: "var(--zn-ink-3)" }}>
                  JPG, PNG, PDF · up to 8 MB each · multiple files supported
                </p>
                <p className="text-xs mt-2" style={{ color: "var(--zn-ink-3)" }}>
                  AI will extract: supplier, date, gross amount, VAT rate &amp; amount
                </p>
              </div>
              <input
                ref={inputRef}
                type="file"
                accept={ACCEPTED}
                multiple
                className="hidden"
                onChange={(e) => handleFiles(e.target.files)}
              />
            </div>
          )}

          {/* Processing queue — file list with status */}
          {queue.length > 0 && (
            <div className="space-y-2">
              {/* Progress summary */}
              <div className="flex items-center gap-3 text-xs" style={{ color: "var(--zn-ink-3)" }}>
                {running ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    <span>Reading receipts with AI… {doneCount + errorCount}/{queue.length}</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="size-3.5" style={{ color: "var(--zn-safe)" }} />
                    <span>
                      {doneCount} extracted{errorCount > 0 ? `, ${errorCount} failed` : ""} · Review and edit below
                    </span>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => { reset(); }}
                  className="ml-auto text-xs underline underline-offset-2"
                  style={{ color: "var(--zn-ink-3)" }}
                >
                  Start over
                </button>
              </div>

              {/* File rows */}
              {queue.map((item) => {
                const r = getResult(item);
                return (
                  <div
                    key={item.id}
                    className="rounded-xl border overflow-hidden"
                    style={{
                      borderColor: item.status === "error" ? "var(--zn-risk)" : "var(--zn-line-soft)",
                      background:  "var(--zn-bg-2)",
                    }}
                  >
                    {/* File name + status row */}
                    <div
                      className="flex items-center gap-2 px-3 py-2 border-b"
                      style={{ borderColor: "var(--zn-line-soft)", background: "var(--zn-surface)" }}
                    >
                      <FileStatusIcon status={item.status} />
                      <span className="flex-1 text-xs font-medium truncate" style={{ color: "var(--zn-ink-2)" }}>
                        {item.file.name}
                      </span>
                      {item.status === "error" && (
                        <span className="text-[10.5px]" style={{ color: "var(--zn-risk)" }}>
                          {item.error}
                        </span>
                      )}
                      {item.status === "extracting" && (
                        <span className="text-[10.5px]" style={{ color: "var(--zn-ink-3)" }}>
                          Reading with AI…
                        </span>
                      )}
                    </div>

                    {/* Extracted fields — editable */}
                    {item.status === "done" && (
                      <div className="px-3 py-2.5 grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {/* Vendor */}
                        <div className="col-span-2 sm:col-span-1">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.07em] mb-1" style={{ color: "var(--zn-ink-3)" }}>Vendor / Supplier</p>
                          <InlineField
                            value={r.vendor ?? ""}
                            onChange={(v) => patchEdit(item.id, { vendor: v })}
                            placeholder="Merchant name"
                          />
                        </div>

                        {/* Date */}
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.07em] mb-1" style={{ color: "var(--zn-ink-3)" }}>Date</p>
                          <InlineField
                            type="date"
                            value={r.date ?? todayISO()}
                            onChange={(v) => patchEdit(item.id, { date: v })}
                          />
                        </div>

                        {/* Gross amount */}
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.07em] mb-1" style={{ color: "var(--zn-ink-3)" }}>Gross (inc. VAT)</p>
                          <InlineField
                            type="number"
                            value={r.amount !== undefined ? String(r.amount) : ""}
                            onChange={(v) => patchEdit(item.id, { amount: parseFloat(v) || undefined })}
                            placeholder="0.00"
                          />
                        </div>

                        {/* Category */}
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.07em] mb-1" style={{ color: "var(--zn-ink-3)" }}>Category</p>
                          <CategorySelect
                            value={r.category ?? "Other"}
                            onChange={(v) => patchEdit(item.id, { category: v })}
                          />
                        </div>

                        {/* VAT amount */}
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.07em] mb-1" style={{ color: "var(--zn-ink-3)" }}>VAT amount (£)</p>
                          <InlineField
                            type="number"
                            value={r.vatAmount != null ? String(r.vatAmount) : ""}
                            onChange={(v) => patchEdit(item.id, { vatAmount: parseFloat(v) || null })}
                            placeholder="0.00"
                          />
                        </div>

                        {/* VAT rate */}
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.07em] mb-1" style={{ color: "var(--zn-ink-3)" }}>VAT rate</p>
                          <div className="relative">
                            <select
                              value={r.vatRate != null ? String(r.vatRate) : ""}
                              onChange={(e) => patchEdit(item.id, { vatRate: e.target.value ? parseInt(e.target.value) : null })}
                              className="w-full appearance-none rounded-lg border px-2 py-1 text-[11.5px] pr-6"
                              style={{
                                borderColor: "var(--zn-line)",
                                background:  "var(--zn-surface)",
                                color:       "var(--zn-ink)",
                              }}
                            >
                              <option value="">No VAT</option>
                              <option value="0">0% (Zero rated)</option>
                              <option value="5">5% (Reduced)</option>
                              <option value="20">20% (Standard)</option>
                            </select>
                            <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 size-3 pointer-events-none" style={{ color: "var(--zn-ink-3)" }} />
                          </div>
                        </div>

                        {/* Invoice number */}
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.07em] mb-1" style={{ color: "var(--zn-ink-3)" }}>Invoice / ref no.</p>
                          <InlineField
                            value={r.invoiceNumber ?? ""}
                            onChange={(v) => patchEdit(item.id, { invoiceNumber: v || null })}
                            placeholder="Optional"
                          />
                        </div>

                        {/* Computed net */}
                        {r.amount && r.vatAmount != null && r.vatAmount > 0 && (
                          <div className="flex items-end pb-1">
                            <p className="text-[10.5px]" style={{ color: "var(--zn-ink-3)" }}>
                              Net: <span className="font-medium" style={{ color: "var(--zn-ink-2)" }}>
                                {fmtGBP(r.amount - r.vatAmount)}
                              </span>
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Add more button */}
              {!running && (
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="text-xs underline underline-offset-2 mt-1"
                  style={{ color: "var(--zn-ink-3)" }}
                >
                  + Add more files
                </button>
              )}
              <input
                ref={inputRef}
                type="file"
                accept={ACCEPTED}
                multiple
                className="hidden"
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? []);
                  if (!files.length) return;
                  const newItems: QueuedFile[] = files.map((f) => ({
                    id: crypto.randomUUID(), file: f, status: "pending",
                  }));
                  setQueue((prev) => [...prev, ...newItems]);
                  // Process the new ones
                  setRunning(true);
                  (async () => {
                    for (const item of newItems) {
                      setQueue((prev) =>
                        prev.map((q) => q.id === item.id ? { ...q, status: "extracting" } : q),
                      );
                      try {
                        const result = await extractFromFile(item.file);
                        setQueue((prev) =>
                          prev.map((q) => q.id === item.id ? { ...q, status: "done", result } : q),
                        );
                      } catch (err) {
                        setQueue((prev) =>
                          prev.map((q) =>
                            q.id === item.id
                              ? { ...q, status: "error", error: err instanceof Error ? err.message : "Failed" }
                              : q,
                          ),
                        );
                      }
                    }
                    setRunning(false);
                  })();
                }}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        {done && readyCount > 0 && (
          <div
            className="flex items-center justify-between px-5 py-3 border-t"
            style={{ borderColor: "var(--zn-line-soft)" }}
          >
            <span className="text-xs" style={{ color: "var(--zn-ink-3)" }}>
              {readyCount} expense{readyCount !== 1 ? "s" : ""} ready to add
              {errorCount > 0 ? ` · ${errorCount} skipped (failed)` : ""}
            </span>
            <button
              type="button"
              onClick={handleConfirm}
              className="zn-pill flex items-center gap-1.5"
              style={{ height: 32, fontSize: 12, padding: "0 16px" }}
            >
              <Check className="size-3.5" />
              Add {readyCount} expense{readyCount !== 1 ? "s" : ""}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
