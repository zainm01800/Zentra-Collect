"use client";

/**
 * /demo/quotes — read-only quotes view with fake data. Buttons are
 * disabled so nothing is persisted.
 */

import { FileText } from "lucide-react";
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
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export default function DemoQuotesPage() {
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
        <p className="zn-section-label">Demo · Books</p>
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
          <button type="button" disabled title="Disabled in demo"
            className="zn-pill zn-pill-ghost opacity-50 cursor-not-allowed text-[12px]"
            style={{ height: 30 }}>
            <FileText className="size-3.5" /> New quote
          </button>
        </div>
        <div className="divide-y" style={{ borderColor: "var(--zn-line-soft)" }}>
          {demoQuotes.map((q) => {
            const s = STATUS_STYLES[q.status];
            return (
              <div key={q.id} className="flex items-center gap-4 px-5 py-3">
                <div className="w-20 text-[11.5px] tabular-nums font-medium"
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
              </div>
            );
          })}
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
