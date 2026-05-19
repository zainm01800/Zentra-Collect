"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Receipt, X } from "lucide-react";
import { demoCreditNotes } from "@/lib/demo-data/demo-books-data";

function fmtGBP(n: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency", currency: "GBP",
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(n);
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default function DemoCreditNotesPage() {
  const [openId, setOpenId] = useState<string | null>(null);
  const [newModal, setNewModal] = useState(false);

  const totalNet   = demoCreditNotes.reduce((s, c) => s + c.amountNet, 0);
  const totalVat   = demoCreditNotes.reduce((s, c) => s + c.vatAmount, 0);
  const totalGross = demoCreditNotes.reduce((s, c) => s + c.amountGross, 0);

  return (
    <div className="space-y-6">
      <div>
        <p className="zn-section-label">Demo · Collections</p>
        <h1 className="text-[28px] font-semibold tracking-[-0.02em] leading-[1.1] mt-1"
            style={{ color: "var(--zn-ink)" }}>
          Credit notes
        </h1>
        <p className="mt-1 text-[13.5px]" style={{ color: "var(--zn-ink-3)" }}>
          Issue a credit note for refunds, cancellations, or corrections — reduces taxable income &amp; VAT for the period
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
          <button type="button" onClick={() => setNewModal(true)}
            className="zn-pill zn-pill-ghost text-[12px]"
            style={{ height: 30 }}>
            <Receipt className="size-3.5" /> Issue credit note
          </button>
        </div>
        <div className="divide-y" style={{ borderColor: "var(--zn-line-soft)" }}>
          {demoCreditNotes.map((c) => {
            const expanded = openId === c.id;
            return (
              <div key={c.id}>
                <button
                  type="button"
                  onClick={() => setOpenId(expanded ? null : c.id)}
                  className="w-full flex items-center gap-4 px-5 py-3 hover:bg-[var(--zn-surface-2)] transition-colors text-left"
                >
                  <div className="w-6 shrink-0 flex justify-center" style={{ color: "var(--zn-ink-3)" }}>
                    {expanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                  </div>
                  <div className="w-20 text-[11.5px] tabular-nums font-medium shrink-0"
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
                </button>

                {expanded && (
                  <div className="px-5 pb-4 pt-3 border-t"
                       style={{ borderColor: "var(--zn-line-soft)", background: "var(--zn-surface)" }}>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-[12.5px] mb-3">
                      <DetailField label="Credit note" value={c.creditNoteNumber} />
                      <DetailField label="Issued" value={fmtDate(c.issueDate)} />
                      {c.invoiceNumber && <DetailField label="Against invoice" value={c.invoiceNumber} />}
                      <DetailField label="Customer" value={c.customerName} />
                    </div>
                    <div className="rounded-lg overflow-hidden border" style={{ borderColor: "var(--zn-line-soft)" }}>
                      <div className="grid grid-cols-[1fr_100px] gap-2 px-3 py-2 text-[10.5px] font-semibold uppercase tracking-[0.06em]"
                           style={{ background: "var(--zn-surface-2)", color: "var(--zn-ink-3)" }}>
                        <span>Description</span><span className="text-right">Amount</span>
                      </div>
                      <div className="divide-y" style={{ borderColor: "var(--zn-line-soft)" }}>
                        <div className="grid grid-cols-[1fr_100px] gap-2 px-3 py-2.5 text-[12.5px]">
                          <span style={{ color: "var(--zn-ink)" }}>{c.reason}</span>
                          <span className="text-right tabular-nums font-medium" style={{ color: "var(--zn-ink)" }}>−{fmtGBP(c.amountNet)}</span>
                        </div>
                        {c.vatAmount > 0 && (
                          <div className="grid grid-cols-[1fr_100px] gap-2 px-3 py-2 text-[11.5px]">
                            <span style={{ color: "var(--zn-ink-3)" }}>VAT reversed @ 20%</span>
                            <span className="text-right tabular-nums" style={{ color: "var(--zn-ink-3)" }}>−{fmtGBP(c.vatAmount)}</span>
                          </div>
                        )}
                        <div className="grid grid-cols-[1fr_100px] gap-2 px-3 py-2 text-[12.5px] font-semibold"
                             style={{ background: "var(--zn-surface-2)" }}>
                          <span style={{ color: "var(--zn-risk)" }}>Total credited</span>
                          <span className="text-right tabular-nums" style={{ color: "var(--zn-risk)" }}>−{fmtGBP(c.amountGross)}</span>
                        </div>
                      </div>
                    </div>
                    <p className="mt-2 text-[11px]" style={{ color: "var(--zn-ink-3)" }}>
                      This credit note reduces your taxable income and reverses the VAT liability for the period.
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Issue credit note demo modal */}
      {newModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4"
             style={{ background: "rgba(0,0,0,0.55)" }}
             role="dialog" aria-modal="true">
          <div className="relative w-full max-w-[420px] rounded-2xl overflow-hidden shadow-2xl"
               style={{ background: "var(--zn-bg)" }}>
            <button type="button" onClick={() => setNewModal(false)} aria-label="Close"
              className="absolute top-4 right-4 size-8 rounded-full inline-flex items-center justify-center hover:bg-black/5"
              style={{ color: "var(--zn-ink-3)" }}>
              <X className="size-4" />
            </button>
            <div className="px-6 pt-6 pb-5">
              <div className="flex items-center gap-2 mb-1">
                <Receipt className="size-4" style={{ color: "var(--zn-accent)" }} />
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em]"
                   style={{ color: "var(--zn-ink-3)" }}>Demo</p>
              </div>
              <h2 className="text-[18px] font-semibold mb-2" style={{ color: "var(--zn-ink)" }}>Issue a credit note</h2>
              <p className="text-[13.5px] leading-relaxed mb-5" style={{ color: "var(--zn-ink-2)" }}>
                In the live product you can issue credit notes against specific invoices for refunds, partial credits, or cancellations. They automatically adjust your P&amp;L, reverse the VAT entry, and link back to the original invoice for a clean audit trail.
              </p>
              <div className="flex gap-2">
                <a href="/login?mode=signup"
                   className="zn-pill text-[13px]" style={{ height: 36 }}>
                  Start free trial
                </a>
                <button type="button" onClick={() => setNewModal(false)}
                  className="zn-pill zn-pill-ghost text-[13px]" style={{ height: 36 }}>
                  Back to demo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.07em] mb-0.5"
         style={{ color: "var(--zn-ink-3)" }}>{label}</p>
      <p className="text-[13px]" style={{ color: "var(--zn-ink)" }}>{value}</p>
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
