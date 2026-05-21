"use client";

/**
 * src/components/bank-statement-import-card.tsx
 *
 * Self-contained card that wraps BankStatementImport and adds a persistent
 * transaction feed that survives page refreshes.
 *
 * State flow:
 *   1. No data in localStorage  → full drop-zone shown inside the card
 *   2. File uploaded (preview)  → preview + "Import N" button inside BankStatementImport
 *   3. After "Import" clicked   → compact header pill only; full feed below
 *   4. Page refresh             → compact header pill + feed reloaded from localStorage
 *   5. User clicks "Replace"    → full drop-zone re-appears above the existing feed
 */

import { useEffect, useState } from "react";
import {
  BankStatementImport,
  BANK_STATEMENT_KEY,
  BANK_STATEMENT_BANK_KEY,
  type ParsedTransaction,
} from "@/components/bank-statement-import";
import { ArrowDownLeft, ArrowUpRight, Landmark, RefreshCw, Upload } from "lucide-react";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtGBP(n: number) {
  return new Intl.NumberFormat("en-GB", {
    style:                 "currency",
    currency:              "GBP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(n));
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day:   "numeric",
    month: "short",
    year:  "numeric",
  });
}

// ── Component ─────────────────────────────────────────────────────────────────

export function BankStatementImportCard() {
  const [saved,       setSaved]       = useState<ParsedTransaction[]>([]);
  const [bank,        setBank]        = useState<string | null>(null);
  const [showImport,  setShowImport]  = useState(false);   // true = drop-zone visible

  // Load persisted transactions on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(BANK_STATEMENT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as ParsedTransaction[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSaved(parsed);
          // Data already exists → keep drop-zone hidden
        }
      }
      const b = localStorage.getItem(BANK_STATEMENT_BANK_KEY);
      if (b) setBank(b);
    } catch {
      /* ignore parse errors */
    }
  }, []);

  /** Called after the user clicks "Import N transactions" in BankStatementImport. */
  function handleImported(rows: ParsedTransaction[]) {
    setSaved(rows);
    setBank(localStorage.getItem(BANK_STATEMENT_BANK_KEY));
    setShowImport(false);   // collapse back to compact mode
  }

  /**
   * Called when the user hits "Choose different file" / clear inside BankStatementImport.
   * BankStatementImport removes the localStorage key — restore the existing data so the
   * feed below doesn't disappear when the user is just trying to pick a new file.
   */
  function handleCleared() {
    if (saved.length > 0) {
      localStorage.setItem(BANK_STATEMENT_KEY, JSON.stringify(saved));
      if (bank) localStorage.setItem(BANK_STATEMENT_BANK_KEY, bank);
    }
  }

  // Transactions to display — exclude zero-amount (card auth checks, etc.)
  const visible  = saved.filter((t) => t.amount !== 0);
  const totalIn  = saved.filter((t) => t.amount >  0).reduce((s, t) => s + t.amount, 0);
  const totalOut = saved.filter((t) => t.amount <  0).reduce((s, t) => s + Math.abs(t.amount), 0);
  const hasFeed  = visible.length > 0;

  return (
    <div className="zn-card px-5 py-5 space-y-4">

      {/* ── Card header ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div
            className="size-7 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: "var(--zn-bg-2)" }}
          >
            <Upload className="size-3.5" style={{ color: "var(--zn-ink-3)" }} />
          </div>
          <div>
            <p className="text-[14px] font-semibold" style={{ color: "var(--zn-ink)" }}>
              Import bank statement
            </p>
            <p className="text-[12px] flex items-center gap-1" style={{ color: "var(--zn-ink-3)" }}>
              {hasFeed && bank ? (
                <>
                  <Landmark className="size-3 flex-shrink-0" />
                  {bank} · {visible.length} transactions
                </>
              ) : hasFeed ? (
                `${visible.length} transactions imported`
              ) : (
                "CSV, Excel (.xlsx / .xls), TSV or TXT — auto-detects every major UK bank."
              )}
            </p>
          </div>
        </div>

        {/* Compact "Replace" pill — only visible once data exists */}
        {hasFeed && !showImport && (
          <button
            type="button"
            onClick={() => setShowImport(true)}
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11.5px] font-medium transition-colors flex-shrink-0"
            style={{
              background:  "var(--zn-surface-2)",
              border:      "1px solid var(--zn-line-soft)",
              color:       "var(--zn-ink-2)",
            }}
          >
            <RefreshCw className="size-3" />
            Replace
          </button>
        )}

        {/* Cancel button — shown while replace drop-zone is open */}
        {hasFeed && showImport && (
          <button
            type="button"
            onClick={() => setShowImport(false)}
            className="text-[11.5px] font-medium flex-shrink-0"
            style={{ color: "var(--zn-ink-3)" }}
          >
            Cancel
          </button>
        )}
      </div>

      {/* ── Import component — shown when no data, or user clicked "Replace" ── */}
      {(!hasFeed || showImport) && (
        <div style={{ borderTop: "1px solid var(--zn-line-soft)", paddingTop: "1rem" }}>
          <BankStatementImport onImported={handleImported} onCleared={handleCleared} />
        </div>
      )}

      {/* ── Persistent transaction feed (shown once data is saved) ───────── */}
      {hasFeed && (
        <div className="space-y-3" style={{ borderTop: "1px solid var(--zn-line-soft)", paddingTop: "1rem" }}>

          {/* Summary strip */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <div
              className="rounded-[10px] px-3 py-2.5"
              style={{ background: "var(--zn-safe-soft)", border: "1px solid color-mix(in srgb, var(--zn-safe) 30%, transparent)" }}
            >
              <p className="text-[10.5px] font-semibold uppercase tracking-wide" style={{ color: "var(--zn-safe)" }}>
                Money in
              </p>
              <p className="text-[15px] font-semibold tabular-nums mt-0.5" style={{ color: "var(--zn-safe)" }}>
                +{fmtGBP(totalIn)}
              </p>
            </div>
            <div
              className="rounded-[10px] px-3 py-2.5"
              style={{ background: "var(--zn-surface-2)", border: "1px solid var(--zn-line-soft)" }}
            >
              <p className="text-[10.5px] font-semibold uppercase tracking-wide" style={{ color: "var(--zn-ink-3)" }}>
                Money out
              </p>
              <p className="text-[15px] font-semibold tabular-nums mt-0.5" style={{ color: "var(--zn-ink)" }}>
                −{fmtGBP(totalOut)}
              </p>
            </div>
            <div
              className="col-span-2 sm:col-span-1 rounded-[10px] px-3 py-2.5"
              style={{ background: "var(--zn-surface-2)", border: "1px solid var(--zn-line-soft)" }}
            >
              <p className="text-[10.5px] font-semibold uppercase tracking-wide" style={{ color: "var(--zn-ink-3)" }}>
                Net
              </p>
              <p
                className="text-[15px] font-semibold tabular-nums mt-0.5"
                style={{ color: totalIn - totalOut >= 0 ? "var(--zn-safe)" : "var(--zn-risk)" }}
              >
                {totalIn - totalOut >= 0 ? "+" : "−"}
                {fmtGBP(totalIn - totalOut)}
              </p>
            </div>
          </div>

          {/* Transaction list */}
          <div
            className="rounded-[10px] overflow-hidden"
            style={{ border: "1px solid var(--zn-line-soft)" }}
          >
            {visible.map((tx, i) => {
              const isCredit = tx.amount > 0;
              return (
                <div
                  key={i}
                  className="flex items-center gap-3 px-4 py-2.5"
                  style={{
                    borderTop: i > 0 ? "1px solid var(--zn-line-soft)" : "none",
                    background: "var(--zn-surface)",
                  }}
                >
                  {/* Direction icon */}
                  <span
                    className="size-7 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: isCredit ? "var(--zn-safe-soft)" : "var(--zn-surface-2)" }}
                  >
                    {isCredit
                      ? <ArrowDownLeft className="size-3.5" style={{ color: "var(--zn-safe)" }} />
                      : <ArrowUpRight  className="size-3.5" style={{ color: "var(--zn-ink-3)" }} />
                    }
                  </span>

                  {/* Description + date */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[12.5px] font-medium truncate" style={{ color: "var(--zn-ink)" }}>
                      {tx.description}
                    </p>
                    <p className="text-[11px] mt-0.5" style={{ color: "var(--zn-ink-3)" }}>
                      {fmtDate(tx.date)}
                    </p>
                  </div>

                  {/* Amount */}
                  <p
                    className="text-[13px] font-semibold tabular-nums flex-shrink-0 w-24 text-right"
                    style={{ color: isCredit ? "var(--zn-safe)" : "var(--zn-ink)" }}
                  >
                    {isCredit ? "+" : "−"}{fmtGBP(tx.amount)}
                  </p>
                </div>
              );
            })}
          </div>

          <p className="text-[11px] text-center" style={{ color: "var(--zn-ink-3)" }}>
            {visible.length} transactions · click &quot;Replace&quot; above to upload a new file
          </p>
        </div>
      )}

    </div>
  );
}
