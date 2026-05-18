"use client";

/**
 * Receipt scanner — snap or upload a photo, AI extracts the fields,
 * user confirms / edits, then the parent decides what to do with the
 * cleaned result (typically: add as an expense).
 *
 * Usage:
 *   <ReceiptScanButton onConfirm={(data) => createExpense(data)} />
 *
 * The button opens a sheet with three states:
 *   1. Idle  — file picker / camera input
 *   2. Scanning — spinner while POSTing to /api/receipts/extract
 *   3. Review — pre-filled form with extracted fields; user confirms
 */

import { useRef, useState } from "react";
import { Camera, Check, Loader2, X } from "lucide-react";

export interface ExtractedReceipt {
  vendor?:   string;
  date?:     string;       // YYYY-MM-DD
  amount?:   number;
  currency?: string;
  category?: string;
}

export interface ReceiptScanButtonProps {
  onConfirm: (data: Required<Pick<ExtractedReceipt, "vendor" | "date" | "amount">> & ExtractedReceipt) => void;
  /** Optional className to control button appearance */
  className?: string;
}

export function ReceiptScanButton({ onConfirm, className }: ReceiptScanButtonProps) {
  const [open, setOpen]           = useState(false);
  const [busy, setBusy]           = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [extracted, setExtracted] = useState<ExtractedReceipt | null>(null);
  const inputRef                  = useRef<HTMLInputElement | null>(null);

  function reset() {
    setBusy(false);
    setError(null);
    setExtracted(null);
  }

  function close() {
    reset();
    setOpen(false);
  }

  async function handleFile(file: File) {
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/receipts/extract", { method: "POST", body: form });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Server returned ${res.status}`);
      }
      const { receipt } = (await res.json()) as { receipt: ExtractedReceipt };
      setExtracted(receipt);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read that receipt.");
    } finally {
      setBusy(false);
    }
  }

  function handleConfirm() {
    if (!extracted) return;
    const vendor = extracted.vendor?.trim();
    const date   = extracted.date;
    const amount = extracted.amount;
    if (!vendor || !date || !Number.isFinite(amount)) {
      setError("Vendor, date, and amount are required.");
      return;
    }
    onConfirm({ ...extracted, vendor, date, amount: amount! });
    close();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => { reset(); setOpen(true); inputRef.current?.click(); }}
        className={className ?? "zn-pill zn-pill-ghost inline-flex items-center gap-1.5"}
        style={{ height: 34, padding: "0 12px", fontSize: 12 }}
      >
        <Camera className="size-3.5" /> Scan receipt
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          if (inputRef.current) inputRef.current.value = "";
        }}
      />

      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.45)" }}
          onClick={close}
        >
          <div
            className="rounded-2xl w-full max-w-md"
            style={{ background: "var(--zn-bg)", border: "1px solid var(--zn-line)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: "var(--zn-line-soft)" }}>
              <p className="text-[14px] font-semibold" style={{ color: "var(--zn-ink)" }}>
                {busy ? "Reading receipt…" : extracted ? "Confirm receipt" : "Scan a receipt"}
              </p>
              <button type="button" onClick={close} aria-label="Close">
                <X className="size-4" style={{ color: "var(--zn-ink-3)" }} />
              </button>
            </div>

            <div className="p-5">
              {busy && (
                <div className="flex flex-col items-center gap-3 py-6 text-center">
                  <Loader2 className="size-6 animate-spin" style={{ color: "var(--zn-ink-3)" }} />
                  <p className="text-[13px]" style={{ color: "var(--zn-ink-3)" }}>
                    Extracting vendor, date, amount…
                  </p>
                </div>
              )}

              {!busy && error && (
                <div
                  className="rounded-lg p-3 text-[12.5px]"
                  style={{ background: "var(--zn-risk-soft)", color: "var(--zn-risk)" }}
                >
                  {error}
                  <button
                    type="button"
                    onClick={() => { reset(); inputRef.current?.click(); }}
                    className="mt-2 block underline"
                  >
                    Try another photo
                  </button>
                </div>
              )}

              {!busy && extracted && (
                <div className="flex flex-col gap-3">
                  <Field label="Vendor">
                    <input
                      type="text"
                      value={extracted.vendor ?? ""}
                      onChange={(e) => setExtracted({ ...extracted, vendor: e.target.value })}
                      className="rs-input"
                    />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Date">
                      <input
                        type="date"
                        value={extracted.date ?? ""}
                        onChange={(e) => setExtracted({ ...extracted, date: e.target.value })}
                        className="rs-input"
                      />
                    </Field>
                    <Field label="Amount">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={extracted.amount ?? ""}
                        onChange={(e) => setExtracted({ ...extracted, amount: parseFloat(e.target.value) })}
                        className="rs-input"
                      />
                    </Field>
                  </div>
                  <Field label="Category (suggested)">
                    <input
                      type="text"
                      value={extracted.category ?? ""}
                      onChange={(e) => setExtracted({ ...extracted, category: e.target.value })}
                      className="rs-input"
                    />
                  </Field>
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => { reset(); inputRef.current?.click(); }}
                      className="zn-pill zn-pill-ghost"
                      style={{ height: 32, padding: "0 12px", fontSize: 12 }}
                    >
                      Re-scan
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirm}
                      className="zn-pill inline-flex items-center gap-1.5"
                      style={{ height: 32, padding: "0 12px", fontSize: 12 }}
                    >
                      <Check className="size-3.5" /> Add expense
                    </button>
                  </div>
                </div>
              )}

              {!busy && !error && !extracted && (
                <p className="text-[12.5px]" style={{ color: "var(--zn-ink-3)" }}>
                  Choose a receipt photo to begin. Works with images from
                  your phone camera or a saved screenshot.
                </p>
              )}
            </div>
          </div>

          <style jsx>{`
            :global(.rs-input) {
              width: 100%;
              border-radius: 8px;
              border: 1px solid var(--zn-line);
              background: var(--zn-surface);
              color: var(--zn-ink);
              padding: 0.45rem 0.7rem;
              font-size: 13px;
            }
          `}</style>
        </div>
      )}
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10.5px] font-semibold uppercase tracking-[0.1em]" style={{ color: "var(--zn-ink-3)" }}>
        {label}
      </span>
      {children}
    </label>
  );
}
