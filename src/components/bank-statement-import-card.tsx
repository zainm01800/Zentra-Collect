"use client";

/**
 * src/components/bank-statement-import-card.tsx
 *
 * Multi-statement bank feed card. Users can import one CSV per month (or account),
 * up to their plan limit. Each import is stored as a separate "statement" and
 * displayed as a dismissible chip. All transactions are aggregated into a single feed.
 *
 * Storage: zentra.bankStatements.v2  (array of SavedStatement)
 * Migration: if v1 key exists and v2 doesn't, the old single statement is migrated.
 *
 * Plan limits (soft-enforced client-side):
 *   bookkeeper_pro     → 24 statements
 *   bookkeeper_starter → 12 statements
 *   single_business / starter_solo → 6 statements
 *   trial / trader / freelance / free / default → 3 statements
 */

import { useEffect, useMemo, useState } from "react";
import {
  BankStatementImport,
  BANK_STATEMENT_KEY,
  BANK_STATEMENT_BANK_KEY,
  type ParsedTransaction,
} from "@/components/bank-statement-import";
import { readLocalAccount } from "@/lib/demo-auth";
import {
  ArrowDownLeft,
  ArrowUpRight,
  FilePlus2,
  Landmark,
  Lock,
  Plus,
  X,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SavedStatement {
  id:           string;
  filename:     string;
  bank?:        string;
  importedAt:   string;           // ISO
  transactions: ParsedTransaction[];
}

// ── Storage ───────────────────────────────────────────────────────────────────

const STATEMENTS_KEY = "zentra.bankStatements.v2";
// Legacy keys (v1) — kept for migration
const LEGACY_TX_KEY  = BANK_STATEMENT_KEY;
const LEGACY_BK_KEY  = BANK_STATEMENT_BANK_KEY;

function loadStatements(): SavedStatement[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STATEMENTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as SavedStatement[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
    // One-time migration from v1 single statement
    const legacyRaw = localStorage.getItem(LEGACY_TX_KEY);
    if (legacyRaw) {
      const txs = JSON.parse(legacyRaw) as ParsedTransaction[];
      if (Array.isArray(txs) && txs.length > 0) {
        const bank = localStorage.getItem(LEGACY_BK_KEY) ?? undefined;
        const migrated: SavedStatement[] = [{
          id:           "migrated",
          filename:     bank ? `${bank} statement` : "imported-statement.csv",
          bank,
          importedAt:   new Date().toISOString(),
          transactions: txs,
        }];
        localStorage.setItem(STATEMENTS_KEY, JSON.stringify(migrated));
        localStorage.removeItem(LEGACY_TX_KEY);
        if (bank) localStorage.removeItem(LEGACY_BK_KEY);
        return migrated;
      }
    }
  } catch { /* ignore */ }
  return [];
}

function persistStatements(stmts: SavedStatement[]) {
  localStorage.setItem(STATEMENTS_KEY, JSON.stringify(stmts));
}

// ── Plan limits ───────────────────────────────────────────────────────────────

function getStatementLimit(): number {
  try {
    const account = readLocalAccount();
    if (!account) return 3;
    const { planId } = account;
    if (planId === "bookkeeper_pro")                                return 24;
    if (planId === "bookkeeper_starter")                           return 12;
    if (["single_business", "starter_solo"].includes(planId))     return 6;
    return 3;
  } catch {
    return 3;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtGBP(n: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency", currency: "GBP",
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(Math.abs(n));
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  });
}

function stmtLabel(s: SavedStatement): string {
  if (s.bank) return s.bank;
  // Try to extract a readable name from the filename
  return s.filename.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ");
}

// ── Component ─────────────────────────────────────────────────────────────────

export function BankStatementImportCard() {
  const [statements, setStatements] = useState<SavedStatement[]>([]);
  const [showImport, setShowImport] = useState(false);

  // Load on mount (after hydration)
  useEffect(() => {
    setStatements(loadStatements());
  }, []);

  const limit    = getStatementLimit();
  const atLimit  = statements.length >= limit;
  const hasFeed  = statements.length > 0;

  // Aggregate all transactions across all statements, newest first
  const allTx = useMemo(() => (
    statements
      .flatMap((s) => s.transactions)
      .filter((t) => t.amount !== 0)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  ), [statements]);

  const totalIn  = allTx.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const totalOut = allTx.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
  const netTotal = totalIn - totalOut;

  function handleImported(rows: ParsedTransaction[], filename: string, bank?: string) {
    const newStmt: SavedStatement = {
      id:           `stmt_${Date.now()}`,
      filename,
      bank,
      importedAt:   new Date().toISOString(),
      transactions: rows,
    };
    const updated = [...statements, newStmt];
    setStatements(updated);
    persistStatements(updated);
    setShowImport(false);
  }

  function removeStatement(id: string) {
    const updated = statements.filter((s) => s.id !== id);
    setStatements(updated);
    persistStatements(updated);
  }

  // handleCleared: keep existing statements intact while user picks a new file
  function handleCleared() { /* existing statements stay */ }

  return (
    <div className="zn-card overflow-hidden">

      {/* ── Card header (always visible) ─────────────────────────────── */}
      <div
        className="flex items-center justify-between gap-3 px-5 py-4"
        style={{ borderBottom: (hasFeed || showImport) ? "1px solid var(--zn-line-soft)" : "none" }}
      >
        {/* Left: icon + title */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="size-7 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: "var(--zn-bg-2)" }}
          >
            <FilePlus2 className="size-3.5" style={{ color: "var(--zn-ink-3)" }} />
          </div>
          <div className="min-w-0">
            <p className="text-[13.5px] font-semibold" style={{ color: "var(--zn-ink)" }}>
              Bank statements
            </p>
            <p className="text-[11.5px] truncate" style={{ color: "var(--zn-ink-3)" }}>
              {hasFeed
                ? `${statements.length} of ${limit} imported · ${allTx.length} transactions`
                : "CSV, Excel, TSV or TXT — auto-detects all major UK banks"}
            </p>
          </div>
        </div>

        {/* Right: action button */}
        {showImport ? (
          <button
            type="button"
            onClick={() => setShowImport(false)}
            className="text-[12px] font-medium flex-shrink-0"
            style={{ color: "var(--zn-ink-3)" }}
          >
            Cancel
          </button>
        ) : atLimit ? (
          <span
            className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full flex-shrink-0"
            style={{ background: "var(--zn-surface-2)", color: "var(--zn-ink-3)", border: "1px solid var(--zn-line-soft)" }}
          >
            <Lock className="size-2.5" />
            {limit}-statement limit
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setShowImport(true)}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors flex-shrink-0"
            style={{ background: "var(--zn-ink)", color: "var(--zn-surface)" }}
          >
            <Plus className="size-3" />
            {hasFeed ? "Add month" : "Import"}
          </button>
        )}
      </div>

      {/* ── Import panel (appears when button clicked) ───────────────── */}
      {showImport && (
        <div
          className="px-5 py-5"
          style={{ background: "var(--zn-surface-2)", borderBottom: "1px solid var(--zn-line-soft)" }}
        >
          <BankStatementImport onImported={handleImported} onCleared={handleCleared} />
        </div>
      )}

      {/* ── Statement chips ───────────────────────────────────────────── */}
      {hasFeed && (
        <div
          className="px-5 py-3 flex flex-wrap gap-2"
          style={{ borderBottom: "1px solid var(--zn-line-soft)" }}
        >
          {statements.map((s) => {
            const txCount = s.transactions.filter((t) => t.amount !== 0).length;
            return (
              <div
                key={s.id}
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px]"
                style={{
                  background: "var(--zn-surface-2)",
                  border:     "1px solid var(--zn-line-soft)",
                  color:      "var(--zn-ink-2)",
                }}
              >
                <Landmark className="size-3 flex-shrink-0" style={{ color: "var(--zn-ink-3)" }} />
                <span className="font-medium">{stmtLabel(s)}</span>
                <span style={{ color: "var(--zn-ink-3)" }}>· {txCount} tx</span>
                <button
                  type="button"
                  onClick={() => removeStatement(s.id)}
                  className="ml-0.5 rounded-full p-0.5 transition-colors hover:bg-black/10 dark:hover:bg-white/10"
                  aria-label={`Remove ${stmtLabel(s)}`}
                >
                  <X className="size-2.5" style={{ color: "var(--zn-ink-3)" }} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Empty state: full drop zone when no data and panel not open ─ */}
      {!hasFeed && !showImport && (
        <div className="px-5 py-5">
          <BankStatementImport onImported={handleImported} onCleared={handleCleared} />
        </div>
      )}

      {/* ── Aggregated feed ───────────────────────────────────────────── */}
      {hasFeed && (
        <div className="px-5 py-5 space-y-4">

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
                style={{ color: netTotal >= 0 ? "var(--zn-safe)" : "var(--zn-risk)" }}
              >
                {netTotal >= 0 ? "+" : "−"}{fmtGBP(netTotal)}
              </p>
            </div>
          </div>

          {/* Transaction list */}
          <div className="rounded-[10px] overflow-hidden" style={{ border: "1px solid var(--zn-line-soft)" }}>
            {allTx.map((tx, i) => {
              const isCredit = tx.amount > 0;
              return (
                <div
                  key={i}
                  className="flex items-center gap-3 px-4 py-2.5"
                  style={{
                    borderTop:  i > 0 ? "1px solid var(--zn-line-soft)" : "none",
                    background: "var(--zn-surface)",
                  }}
                >
                  <span
                    className="size-7 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: isCredit ? "var(--zn-safe-soft)" : "var(--zn-surface-2)" }}
                  >
                    {isCredit
                      ? <ArrowDownLeft className="size-3.5" style={{ color: "var(--zn-safe)" }} />
                      : <ArrowUpRight  className="size-3.5" style={{ color: "var(--zn-ink-3)" }} />
                    }
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12.5px] font-medium truncate" style={{ color: "var(--zn-ink)" }}>
                      {tx.description}
                    </p>
                    <p className="text-[11px] mt-0.5" style={{ color: "var(--zn-ink-3)" }}>
                      {fmtDate(tx.date)}
                    </p>
                  </div>
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
            {allTx.length} transactions · {statements.length} statement{statements.length === 1 ? "" : "s"} ·{" "}
            {limit - statements.length > 0
              ? `${limit - statements.length} more slot${limit - statements.length === 1 ? "" : "s"} available`
              : "plan limit reached — remove a statement to add another"}
          </p>
        </div>
      )}

    </div>
  );
}
