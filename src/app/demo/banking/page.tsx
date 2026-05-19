"use client";

/**
 * /demo/banking — fake bank-feed view showcasing the "tag as income"
 * flow for credits that don't match an invoice. Tagging is purely
 * visual local state — nothing persists.
 */

import { useState } from "react";
import { Camera, Check, Tag } from "lucide-react";
import { demoBankCredits } from "@/lib/demo-data/demo-books-data";
import dynamic from "next/dynamic";
const DemoReceiptScan = dynamic(
  () => import("@/components/demo-receipt-scan").then((m) => m.DemoReceiptScan),
  { ssr: false },
);

function fmtGBP(n: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency", currency: "GBP",
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(n);
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export default function DemoBankingPage() {
  // Per-tab toggle — vanishes on refresh. Pure demo.
  const [tagged, setTagged] = useState<Record<string, boolean>>(
    Object.fromEntries(demoBankCredits.map((c) => [c.transactionId, c.tagged])),
  );
  const [scanOpen, setScanOpen] = useState(false);

  const taggedTotal = demoBankCredits.reduce(
    (s, c) => s + (tagged[c.transactionId] ? c.amount : 0),
    0,
  );
  const untaggedCount = demoBankCredits.filter((c) => !tagged[c.transactionId]).length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="zn-section-label">Demo · Banking</p>
          <h1 className="text-[28px] font-semibold tracking-[-0.02em] leading-[1.1] mt-1"
              style={{ color: "var(--zn-ink)" }}>
            Bank feed
          </h1>
          <p className="mt-1 text-[13.5px]" style={{ color: "var(--zn-ink-3)" }}>
            Credits that don&rsquo;t match an invoice can be tagged as direct income — counts toward your Self-Assessment turnover
          </p>
        </div>
        <button
          type="button"
          onClick={() => setScanOpen(true)}
          className="zn-pill text-[12px]"
          style={{ height: 34, padding: "0 14px" }}
        >
          <Camera className="size-3.5" /> Scan receipt (demo AI)
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Stat label="Tagged income"   value={fmtGBP(taggedTotal)} accent="var(--zn-safe)" />
        <Stat label="Untagged credits" value={String(untaggedCount)} />
        <Stat label="This tax year"   value="2026/27" />
      </div>

      <div className="zn-card overflow-hidden">
        <div className="px-5 py-3.5 border-b" style={{ borderColor: "var(--zn-line-soft)" }}>
          <p className="text-[13px] font-semibold" style={{ color: "var(--zn-ink)" }}>
            Recent credits — no invoice match
          </p>
        </div>
        <div className="divide-y" style={{ borderColor: "var(--zn-line-soft)" }}>
          {demoBankCredits.map((c) => {
            const isTagged = tagged[c.transactionId];
            return (
              <div key={c.transactionId} className="flex items-center gap-4 px-5 py-3">
                <div className="w-16 text-[11.5px] tabular-nums" style={{ color: "var(--zn-ink-3)" }}>
                  {fmtDate(c.date)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[12.5px] font-medium truncate" style={{ color: "var(--zn-ink)" }}>
                    {c.description}
                  </p>
                </div>
                <p className="text-[13px] font-semibold tabular-nums shrink-0 w-20 text-right"
                   style={{ color: "var(--zn-safe)" }}>
                  +{fmtGBP(c.amount)}
                </p>
                <button
                  type="button"
                  onClick={() => setTagged((p) => ({ ...p, [c.transactionId]: !p[c.transactionId] }))}
                  className="shrink-0 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold border transition-colors"
                  style={{
                    background:  isTagged ? "var(--zn-safe-soft)"    : "transparent",
                    color:       isTagged ? "var(--zn-safe)"          : "var(--zn-ink-3)",
                    borderColor: isTagged ? "var(--zn-safe)"          : "var(--zn-line)",
                  }}
                >
                  {isTagged ? <Check className="size-3" /> : <Tag className="size-3" />}
                  {isTagged ? "Tagged" : "Tag as income"}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-[11.5px]" style={{ color: "var(--zn-ink-3)" }}>
        Tagging in the demo is local to this tab and disappears on refresh. In the real product, tagged credits flow into your Tax &amp; VAT estimate.
      </p>

      <DemoReceiptScan open={scanOpen} onClose={() => setScanOpen(false)} />
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="zn-card p-4">
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.07em]"
         style={{ color: "var(--zn-ink-3)" }}>{label}</p>
      <p className="mt-2 text-[22px] font-bold tabular-nums leading-none"
         style={{ color: accent ?? "var(--zn-ink)" }}>{value}</p>
    </div>
  );
}
