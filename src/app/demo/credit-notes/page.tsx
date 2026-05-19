"use client";

import { Receipt } from "lucide-react";
import { demoCreditNotes } from "@/lib/demo-data/demo-books-data";

function fmtGBP(n: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency", currency: "GBP",
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(n);
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export default function DemoCreditNotesPage() {
  const totalNet   = demoCreditNotes.reduce((s, c) => s + c.amountNet, 0);
  const totalVat   = demoCreditNotes.reduce((s, c) => s + c.vatAmount, 0);
  const totalGross = demoCreditNotes.reduce((s, c) => s + c.amountGross, 0);

  return (
    <div className="space-y-6">
      <div>
        <p className="zn-section-label">Demo · Books</p>
        <h1 className="text-[28px] font-semibold tracking-[-0.02em] leading-[1.1] mt-1"
            style={{ color: "var(--zn-ink)" }}>
          Credit notes
        </h1>
        <p className="mt-1 text-[13.5px]" style={{ color: "var(--zn-ink-3)" }}>
          Issue a credit note for refunds, cancellations, or corrections — reduces taxable income & VAT for the period
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Total credited (net)"   value={fmtGBP(totalNet)} />
        <Stat label="VAT reversed"           value={fmtGBP(totalVat)} />
        <Stat label="Total gross"            value={fmtGBP(totalGross)} accent="var(--zn-risk)" />
      </div>

      <div className="zn-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b"
             style={{ borderColor: "var(--zn-line-soft)" }}>
          <p className="text-[13px] font-semibold" style={{ color: "var(--zn-ink)" }}>
            All credit notes
          </p>
          <button type="button" disabled title="Disabled in demo"
            className="zn-pill zn-pill-ghost opacity-50 cursor-not-allowed text-[12px]"
            style={{ height: 30 }}>
            <Receipt className="size-3.5" /> Issue credit note
          </button>
        </div>
        <div className="divide-y" style={{ borderColor: "var(--zn-line-soft)" }}>
          {demoCreditNotes.map((c) => (
            <div key={c.id} className="flex items-center gap-4 px-5 py-3">
              <div className="w-20 text-[11.5px] tabular-nums font-medium"
                   style={{ color: "var(--zn-ink-2)" }}>
                {c.creditNoteNumber}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium truncate" style={{ color: "var(--zn-ink)" }}>
                  {c.customerName}
                  {c.invoiceNumber && (
                    <span className="ml-2 text-[11px] font-normal" style={{ color: "var(--zn-ink-3)" }}>
                      vs. {c.invoiceNumber}
                    </span>
                  )}
                </p>
                <p className="text-[11.5px] mt-0.5 truncate" style={{ color: "var(--zn-ink-3)" }}>
                  {c.reason} · {fmtDate(c.issueDate)}
                </p>
              </div>
              <div className="text-right shrink-0 w-32">
                <p className="text-[13px] font-semibold tabular-nums" style={{ color: "var(--zn-risk)" }}>
                  −{fmtGBP(c.amountGross)}
                </p>
                <p className="text-[11px] tabular-nums" style={{ color: "var(--zn-ink-3)" }}>
                  {fmtGBP(c.amountNet)} net + {fmtGBP(c.vatAmount)} VAT
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="zn-card p-4">
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.07em]"
         style={{ color: "var(--zn-ink-3)" }}>{label}</p>
      <p className="mt-2 text-[20px] font-bold tabular-nums leading-none"
         style={{ color: accent ?? "var(--zn-ink)" }}>{value}</p>
    </div>
  );
}
