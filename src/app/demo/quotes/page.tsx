"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, FileText, X } from "lucide-react";
import { demoQuotes } from "@/lib/demo-data/demo-books-data";

const STATUS_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  draft:     { bg: "var(--zn-surface-2)", color: "var(--zn-ink-3)", label: "Draft" },
  sent:      { bg: "var(--zn-warn-soft)", color: "var(--zn-warn)",  label: "Sent" },
  accepted:  { bg: "var(--zn-safe-soft)", color: "var(--zn-safe)",  label: "Accepted" },
  converted: { bg: "var(--zn-accent-soft)", color: "var(--zn-accent)", label: "Converted" },
  declined:  { bg: "var(--zn-risk-soft)", color: "var(--zn-risk)",  label: "Declined" },
};

function fmtGBP(n: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency", currency: "GBP",
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(n);
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default function DemoQuotesPage() {
  const [openId, setOpenId] = useState<string | null>(null);
  const [newModal, setNewModal] = useState(false);

  const totals = {
    draft:     demoQuotes.filter((q) => q.status === "draft").length,
    sent:      demoQuotes.filter((q) => q.status === "sent").length,
    accepted:  demoQuotes.filter((q) => q.status === "accepted").length,
    converted: demoQuotes.filter((q) => q.status === "converted").length,
  };
  const outstandingValue = demoQuotes
    .filter((q) => q.status === "sent" || q.status === "accepted")
    .reduce((s, q) => s + q.amountGross, 0);

  return (
    <div className="space-y-6">
      <div>
        <p className="zn-section-label">Demo · Collections</p>
        <h1 className="text-[28px] font-semibold tracking-[-0.02em] leading-[1.1] mt-1"
            style={{ color: "var(--zn-ink)" }}>
          Quotes
        </h1>
        <p className="mt-1 text-[13.5px]" style={{ color: "var(--zn-ink-3)" }}>
          Draft · sent · accepted · convert to an invoice in one click
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Stat label="Outstanding" value={fmtGBP(outstandingValue)} accent="var(--zn-accent)" />
        <Stat label="Draft"       value={String(totals.draft)} />
        <Stat label="Sent"        value={String(totals.sent)} />
        <Stat label="Accepted"    value={String(totals.accepted)} accent="var(--zn-safe)" />
        <Stat label="Converted"   value={String(totals.converted)} />
      </div>

      <div className="zn-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b"
             style={{ borderColor: "var(--zn-line-soft)" }}>
          <p className="text-[13px] font-semibold" style={{ color: "var(--zn-ink)" }}>
            All quotes
          </p>
          <button type="button" onClick={() => setNewModal(true)}
            className="zn-pill zn-pill-ghost text-[12px]"
            style={{ height: 30 }}>
            <FileText className="size-3.5" /> New quote
          </button>
        </div>
        <div className="divide-y" style={{ borderColor: "var(--zn-line-soft)" }}>
          {demoQuotes.map((q) => {
            const s = STATUS_STYLES[q.status];
            const expanded = openId === q.id;
            return (
              <div key={q.id}>
                <button
                  type="button"
                  onClick={() => setOpenId(expanded ? null : q.id)}
                  className="w-full flex items-center gap-4 px-5 py-3 hover:bg-[var(--zn-surface-2)] transition-colors text-left"
                >
                  <div className="w-6 shrink-0 flex justify-center" style={{ color: "var(--zn-ink-3)" }}>
                    {expanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                  </div>
                  <div className="w-20 text-[11.5px] tabular-nums font-medium shrink-0"
                       style={{ color: "var(--zn-ink-2)" }}>
                    {q.quoteNumber}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium truncate" style={{ color: "var(--zn-ink)" }}>
                      {q.customerName}
                    </p>
                    <p className="text-[11.5px] mt-0.5 truncate" style={{ color: "var(--zn-ink-3)" }}>
                      {q.description} · {fmtDate(q.issueDate)}
                    </p>
                  </div>
                  <span className="inline-block rounded-full px-2.5 py-0.5 text-[10.5px] font-semibold whitespace-nowrap shrink-0"
                        style={{ background: s.bg, color: s.color }}>
                    {s.label}
                  </span>
                  <div className="text-right shrink-0 w-24">
                    <p className="text-[13px] font-semibold tabular-nums" style={{ color: "var(--zn-ink)" }}>
                      {fmtGBP(q.amountGross)}
                    </p>
                    {q.vatAmount > 0 && (
                      <p className="text-[11px] tabular-nums" style={{ color: "var(--zn-ink-3)" }}>
                        incl. {fmtGBP(q.vatAmount)} VAT
                      </p>
                    )}
                  </div>
                </button>

                {expanded && (
                  <div className="px-5 pb-4 pt-1 border-t"
                       style={{ borderColor: "var(--zn-line-soft)", background: "var(--zn-surface)" }}>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-[12.5px] mb-3">
                      <DetailField label="Quote number" value={q.quoteNumber} />
                      <DetailField label="Issued" value={fmtDate(q.issueDate)} />
                      {q.expiresOn && <DetailField label="Expires" value={fmtDate(q.expiresOn)} />}
                      <DetailField label="Net" value={fmtGBP(q.amountGross - q.vatAmount)} />
                    </div>
                    <div className="rounded-lg overflow-hidden border" style={{ borderColor: "var(--zn-line-soft)" }}>
                      <div className="grid grid-cols-[1fr_80px_80px] gap-2 px-3 py-2 text-[10.5px] font-semibold uppercase tracking-[0.06em]"
                           style={{ background: "var(--zn-surface-2)", color: "var(--zn-ink-3)" }}>
                        <span>Description</span><span className="text-right">Qty</span><span className="text-right">Total</span>
                      </div>
                      <div className="divide-y" style={{ borderColor: "var(--zn-line-soft)" }}>
                        <div className="grid grid-cols-[1fr_80px_80px] gap-2 px-3 py-2.5 text-[12.5px]">
                          <span style={{ color: "var(--zn-ink)" }}>{q.description}</span>
                          <span className="text-right tabular-nums" style={{ color: "var(--zn-ink-3)" }}>1</span>
                          <span className="text-right tabular-nums font-medium" style={{ color: "var(--zn-ink)" }}>{fmtGBP(q.amountGross - q.vatAmount)}</span>
                        </div>
                        {q.vatAmount > 0 && (
                          <div className="grid grid-cols-[1fr_80px_80px] gap-2 px-3 py-2 text-[11.5px]">
                            <span style={{ color: "var(--zn-ink-3)" }}>VAT @ 20%</span>
                            <span className="text-right" style={{ color: "var(--zn-ink-3)" }}></span>
                            <span className="text-right tabular-nums" style={{ color: "var(--zn-ink-3)" }}>{fmtGBP(q.vatAmount)}</span>
                          </div>
                        )}
                        <div className="grid grid-cols-[1fr_80px_80px] gap-2 px-3 py-2 text-[12.5px] font-semibold"
                             style={{ background: "var(--zn-surface-2)" }}>
                          <span style={{ color: "var(--zn-ink)" }}>Total</span>
                          <span className="text-right" style={{ color: "var(--zn-ink-3)" }}></span>
                          <span className="text-right tabular-nums" style={{ color: "var(--zn-ink)" }}>{fmtGBP(q.amountGross)}</span>
                        </div>
                      </div>
                    </div>
                    {q.status === "accepted" && (
                      <div className="mt-3 flex gap-2">
                        <button type="button"
                          onClick={() => alert("Sign up to convert quotes to invoices →")}
                          className="zn-pill text-[12px]" style={{ height: 30 }}>
                          Convert to invoice
                        </button>
                      </div>
                    )}
                    {q.status === "sent" && (
                      <div className="mt-3 flex gap-2">
                        <button type="button"
                          onClick={() => alert("Sign up to mark quotes as accepted →")}
                          className="zn-pill zn-pill-ghost text-[12px]" style={{ height: 30 }}>
                          Mark as accepted
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* New quote demo modal */}
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
                <FileText className="size-4" style={{ color: "var(--zn-accent)" }} />
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em]"
                   style={{ color: "var(--zn-ink-3)" }}>Demo</p>
              </div>
              <h2 className="text-[18px] font-semibold mb-2" style={{ color: "var(--zn-ink)" }}>Create quotes</h2>
              <p className="text-[13.5px] leading-relaxed mb-5" style={{ color: "var(--zn-ink-2)" }}>
                In the live product you can create professional quotes, email them directly to clients, mark them accepted, and convert them to invoices in one click. Quote data flows into your P&amp;L and credit note workflows automatically.
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
