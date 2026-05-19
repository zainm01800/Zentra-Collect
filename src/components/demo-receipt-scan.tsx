"use client";

/**
 * Demo receipt OCR — visually mimics the real "scan a receipt" flow
 * (camera/upload → spinner → extracted fields). Doesn't call any
 * Vision API. Returns one of three pre-canned receipts at random so
 * the visitor sees the output style without us using API credits.
 */

import { useState } from "react";
import { Bot, Camera, Check, Loader2, Sparkles, Upload, X } from "lucide-react";

interface ExtractedReceipt {
  vendor:   string;
  date:     string;
  amount:   number;
  currency: string;
  category: string;
}

const DEMO_RECEIPTS: ExtractedReceipt[] = [
  { vendor: "Shell — A34 Newbury",   date: "2026-05-12", amount: 64.20, currency: "GBP", category: "Vehicle · Fuel" },
  { vendor: "Pret a Manger",         date: "2026-05-09", amount: 9.85,  currency: "GBP", category: "Subsistence · Meals" },
  { vendor: "Office Depot",          date: "2026-05-04", amount: 47.99, currency: "GBP", category: "Office · Supplies" },
];

interface Props { open: boolean; onClose: () => void }

export function DemoReceiptScan({ open, onClose }: Props) {
  const [phase, setPhase] = useState<"idle" | "scanning" | "ready">("idle");
  const [extracted, setExtracted] = useState<ExtractedReceipt | null>(null);

  function simulateScan() {
    setPhase("scanning");
    setExtracted(null);
    setTimeout(() => {
      const random = DEMO_RECEIPTS[Math.floor(Math.random() * DEMO_RECEIPTS.length)];
      setExtracted(random);
      setPhase("ready");
    }, 1200);
  }

  function reset() {
    setPhase("idle");
    setExtracted(null);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4"
         style={{ background: "rgba(0,0,0,0.55)" }}
         role="dialog" aria-modal="true">
      <div className="relative w-full max-w-[520px] rounded-2xl overflow-hidden shadow-2xl"
           style={{ background: "var(--zn-bg)" }}>
        <button type="button" onClick={() => { onClose(); reset(); }} aria-label="Close"
          className="absolute top-4 right-4 size-8 rounded-full inline-flex items-center justify-center hover:bg-black/5 z-10"
          style={{ color: "var(--zn-ink-3)" }}>
          <X className="size-4" />
        </button>

        <div className="px-6 pt-6 pb-4 border-b" style={{ borderColor: "var(--zn-line-soft)" }}>
          <div className="flex items-center gap-2 mb-1.5">
            <Sparkles className="size-4" style={{ color: "var(--zn-accent)" }} />
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em]"
               style={{ color: "var(--zn-ink-3)" }}>
              AI receipt scanner
            </p>
          </div>
          <h2 className="text-[18px] font-semibold leading-tight"
              style={{ color: "var(--zn-ink)" }}>
            Snap a receipt, get an expense
          </h2>
          <p className="text-[12px] mt-1" style={{ color: "var(--zn-ink-3)" }}>
            On mobile this opens the camera. On desktop you upload a photo or PDF.
          </p>
        </div>

        <div className="px-6 py-2 flex items-center gap-2 text-[11.5px] font-medium"
             style={{ background: "var(--zn-warn-soft)", color: "var(--zn-warn)" }}>
          <Bot className="size-3.5" />
          Demo AI · no API call · uses one of three pre-extracted sample receipts
        </div>

        <div className="px-6 py-5">
          {phase === "idle" && (
            <div className="flex flex-col items-center gap-3 py-6">
              <div className="size-14 rounded-xl inline-flex items-center justify-center"
                   style={{ background: "var(--zn-surface-2)", color: "var(--zn-ink-3)" }}>
                <Camera className="size-6" />
              </div>
              <p className="text-[13px] text-center" style={{ color: "var(--zn-ink-2)" }}>
                Tap below to simulate a receipt scan.
              </p>
              <div className="flex gap-2 mt-1">
                <button type="button" onClick={simulateScan} className="zn-pill text-[12px]"
                  style={{ height: 34, padding: "0 14px" }}>
                  <Camera className="size-3.5" /> Simulate scan
                </button>
                <button type="button" onClick={simulateScan} className="zn-pill zn-pill-ghost text-[12px]"
                  style={{ height: 34, padding: "0 14px" }}>
                  <Upload className="size-3.5" /> Simulate upload
                </button>
              </div>
            </div>
          )}

          {phase === "scanning" && (
            <div className="flex flex-col items-center gap-3 py-10">
              <Loader2 className="size-6 animate-spin" style={{ color: "var(--zn-accent)" }} />
              <p className="text-[13px]" style={{ color: "var(--zn-ink-3)" }}>
                Extracting vendor, date, amount…
              </p>
            </div>
          )}

          {phase === "ready" && extracted && (
            <div className="space-y-3">
              <div className="rounded-xl p-4 space-y-2"
                   style={{ background: "var(--zn-surface)", border: "1px solid var(--zn-line-soft)" }}>
                <Field label="Vendor"   value={extracted.vendor} />
                <Field label="Date"     value={extracted.date} />
                <Field label="Amount"   value={`${extracted.currency} ${extracted.amount.toFixed(2)}`} />
                <Field label="Category" value={extracted.category} />
              </div>
              <div className="flex items-center justify-between gap-3">
                <button type="button" onClick={reset}
                  className="text-[12px] hover:underline"
                  style={{ color: "var(--zn-ink-3)" }}>
                  ← Scan another
                </button>
                <button type="button" disabled
                  title="Disabled in demo — sign up to save real expenses"
                  className="zn-pill opacity-50 cursor-not-allowed text-[12px]"
                  style={{ height: 34, padding: "0 14px" }}>
                  <Check className="size-3.5" /> Save expense
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-[12.5px]">
      <span style={{ color: "var(--zn-ink-3)" }}>{label}</span>
      <span className="font-medium tabular-nums" style={{ color: "var(--zn-ink)" }}>{value}</span>
    </div>
  );
}
