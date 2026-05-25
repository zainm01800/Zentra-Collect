"use client";

/**
 * src/components/bank-transactions-list.tsx
 *
 * Receives pre-fetched TrueLayer transactions from the server component,
 * reads invoices from localStorage, runs the matching logic in the browser,
 * and renders:
 *
 *   1. "Possible payments received" — matched credits with a "Mark as paid" hint
 *   2. "Recent transactions" — all credits and debits
 *
 * The "Mark as paid" action updates the invoice state in localStorage
 * (same pattern as the rest of the app) so no server round-trip is needed
 * for demo/localStorage users.
 */

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, ArrowDownLeft, ArrowUpRight, CheckCircle2, PiggyBank, RefreshCw, X } from "lucide-react";
import {
  matchTransactionsToInvoices,
  type TransactionMatch,
} from "@/lib/banking/match";
import { readLocalAccount } from "@/lib/demo-auth";
import { importedInvoicesStorageKey } from "@/lib/import/zentra-import";
import { writeBackFromBankFeedAction } from "@/actions/banking-write-back";
import {
  demoCashpilotInvoices as demoInvoices,
} from "@/lib/demo-data/zentra-demo-data";
import {
  isTagged,
  readTaggedIncome,
  tagAsIncome,
  totalTaggedIncome,
  untagIncome,
  type TaggedIncome,
} from "@/lib/banking/direct-income";
import type { TLTransaction } from "@/lib/truelayer/client";
import type { Invoice } from "@/types/zentra";

const demoInvoiceStateStorageKey = "zentra.demoInvoiceState.v1";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BankTransactionsListProps {
  transactions: TLTransaction[];
  fetchError?:  string;
}

// ── Formatters ────────────────────────────────────────────────────────────────

function fmtGBP(n: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency", currency: "GBP",
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(n);
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  });
}

// ── Read invoices from localStorage ──────────────────────────────────────────

function readStoredInvoices(): Invoice[] {
  if (typeof window === "undefined") return [];
  const local = readLocalAccount();
  const isDemo = local?.planId === "demo";
  const key = isDemo ? demoInvoiceStateStorageKey : importedInvoicesStorageKey;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fallback: Invoice[] = isDemo ? (demoInvoices as unknown as Invoice[]) : [];
  const stored = window.localStorage.getItem(key);
  if (!stored) return fallback;
  try {
    const parsed = JSON.parse(stored) as Invoice[];
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

// ── Mark invoice as paid in localStorage ─────────────────────────────────────

function markInvoicePaidInStorage(invoiceId: string) {
  if (typeof window === "undefined") return;
  const local = readLocalAccount();
  const isDemo = local?.planId === "demo";
  const key = isDemo ? demoInvoiceStateStorageKey : importedInvoicesStorageKey;
  const stored = window.localStorage.getItem(key);
  if (!stored) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parsed = JSON.parse(stored) as any[];
    const updated = parsed.map((inv) =>
      inv.id === invoiceId
        ? { ...inv, status: "paid", amountOutstanding: 0 }
        : inv,
    );
    window.localStorage.setItem(key, JSON.stringify(updated));
  } catch {
    /* ignore */
  }
}

// ── Month filter helpers ──────────────────────────────────────────────────────

/** Returns "Apr 2026" label for a transaction timestamp */
function txMonthLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}

/** Returns a sortable key "2026-04" for a timestamp */
function txMonthKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function BankTransactionsList({
  transactions,
  fetchError,
}: BankTransactionsListProps) {
  const [invoices, setInvoices]      = useState<Invoice[]>([]);
  const [paidIds, setPaidIds]        = useState<Set<string>>(new Set());
  const [writeBackById, setWriteBackById] = useState<Record<string,
    | { kind: "pending" }
    | { kind: "ok"; provider: string }
    | { kind: "err"; message: string }
    | undefined
  >>({});
  const [tagged, setTagged]          = useState<TaggedIncome[]>([]);
  const [selectedTxId, setSelectedTxId] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>("all");

  // Load invoices + tagged income from localStorage after hydration
  useEffect(() => {
    setInvoices(readStoredInvoices());
    setTagged(readTaggedIncome());
    function onChange() { setTagged(readTaggedIncome()); }
    window.addEventListener("zentra:direct-income-change", onChange);
    return () => window.removeEventListener("zentra:direct-income-change", onChange);
  }, []);

  // Run matching
  const matches: TransactionMatch[] = useMemo(() => {
    if (!invoices.length || !transactions.length) return [];
    return matchTransactionsToInvoices(
      transactions,
      invoices
        .filter((inv) => inv.amountOutstanding > 0)
        .map((inv) => ({
          id:                inv.id,
          customerName:      inv.customerName,
          invoiceNumber:     inv.invoiceNumber,
          amountOutstanding: inv.amountOutstanding,
          dueDate:           inv.dueDate,
        })),
    );
  }, [invoices, transactions]);

  // ── Direct-income helpers ──────────────────────────────────────────────────
  // A credit is "matched" if it's already in the matches list above —
  // those go through the invoice flow. Everything else is eligible
  // for direct-income tagging.
  const matchedTxIds = useMemo(
    () => new Set(matches.map((m) => m.transaction.transaction_id)),
    [matches],
  );
  const taggedTxIds = useMemo(
    () => new Set(tagged.map((t) => t.transactionId)),
    [tagged],
  );
  // Compute total from the `tagged` state array directly (don't call
  // totalTaggedIncome() in a memo — it reads localStorage internally and
  // won't recompute correctly when the state array identity hasn't changed).
  const taggedTotalThisTaxYear = useMemo(() => {
    const now = new Date();
    // UK tax year starts 6 April
    const taxYearStart = new Date(
      now.getMonth() < 3 || (now.getMonth() === 3 && now.getDate() < 6)
        ? now.getFullYear() - 1
        : now.getFullYear(),
      3, 6, // April 6
    );
    return tagged
      .filter((t) => new Date(t.date) >= taxYearStart)
      .reduce((sum, t) => sum + t.amount, 0);
  }, [tagged]);

  // Build sorted list of unique months present in the transactions
  const availableMonths = useMemo(() => {
    const seen = new Map<string, string>(); // key → label
    for (const tx of transactions) {
      const key = txMonthKey(tx.timestamp);
      if (!seen.has(key)) seen.set(key, txMonthLabel(tx.timestamp));
    }
    return [...seen.entries()].sort((a, b) => b[0].localeCompare(a[0])); // newest first
  }, [transactions]);

  // Transactions filtered by the selected month
  const visibleTx = useMemo(() => {
    if (selectedMonth === "all") return transactions;
    return transactions.filter((tx) => txMonthKey(tx.timestamp) === selectedMonth);
  }, [transactions, selectedMonth]);

  // Summary figures for the visible set
  const totalIn  = useMemo(() => visibleTx.filter((t) => t.transaction_type === "CREDIT").reduce((s, t) => s + t.amount, 0), [visibleTx]);
  const totalOut = useMemo(() => visibleTx.filter((t) => t.transaction_type === "DEBIT").reduce((s, t) => s + t.amount, 0), [visibleTx]);
  const netTotal = totalIn - totalOut;

  function handleTagAsIncome(tx: TLTransaction) {
    tagAsIncome({
      transactionId: tx.transaction_id,
      amount:        tx.amount,
      date:          tx.timestamp,
      description:   (tx.description ?? "").slice(0, 200),
      category:      "services",  // default — UI for changing comes later
    });
    setTagged(readTaggedIncome());
  }

  function handleUntag(transactionId: string) {
    untagIncome(transactionId);
    setTagged(readTaggedIncome());
  }

  async function handleMarkPaid(match: TransactionMatch) {
    // 1. Local mark-paid for immediate UI feedback
    markInvoicePaidInStorage(match.invoice.id);
    setPaidIds((prev) => new Set([...prev, match.invoice.id]));
    setInvoices(readStoredInvoices());

    // 2. If the invoice came from an integration, fire write-back so it
    //    gets marked paid in Xero/Sage/FreeAgent/QB too. The action is
    //    a no-op for manually-created invoices.
    setWriteBackById((s) => ({ ...s, [match.invoice.id]: { kind: "pending" } }));
    try {
      const result = await writeBackFromBankFeedAction({
        invoiceId:  match.invoice.id,
        amountPaid: match.transaction.amount,
        paidDate:   match.transaction.timestamp.slice(0, 10),
        reference:  match.transaction.description?.slice(0, 60),
      });
      if (result.ok) {
        if (result.provider) {
          setWriteBackById((s) => ({
            ...s,
            [match.invoice.id]: { kind: "ok", provider: result.provider as string },
          }));
        } else {
          // Manual invoice — nothing to write back; clear pending state
          setWriteBackById((s) => ({ ...s, [match.invoice.id]: undefined }));
        }
      } else {
        setWriteBackById((s) => ({
          ...s,
          [match.invoice.id]: { kind: "err", message: result.error },
        }));
      }
    } catch (err) {
      setWriteBackById((s) => ({
        ...s,
        [match.invoice.id]: {
          kind: "err",
          message: err instanceof Error ? err.message : "Write-back failed.",
        },
      }));
    }
  }

  // ── Soft error / empty state ──────────────────────────────────────────────

  // Determine whether the error is a hard "session expired → must reconnect"
  // or a soft "temporary API hiccup → just retry later".
  const isSessionError = fetchError?.toLowerCase().includes("session expired") ||
                         fetchError?.toLowerCase().includes("reconnect your bank");

  if (fetchError && transactions.length === 0) {
    return (
      <div
        className="flex items-start gap-3 rounded-[12px] px-4 py-4"
        style={{
          background: isSessionError ? "var(--zn-risk-soft)"  : "var(--zn-warn-soft)",
          border: `1px solid ${isSessionError ? "var(--zn-risk)" : "var(--zn-warn)"}`,
        }}
      >
        <AlertCircle
          className="size-4 flex-shrink-0 mt-0.5"
          style={{ color: isSessionError ? "var(--zn-risk)" : "var(--zn-warn)" }}
        />
        <div>
          <p
            className="text-[13px] font-semibold"
            style={{ color: isSessionError ? "var(--zn-risk)" : "var(--zn-warn)" }}
          >
            {isSessionError ? "Bank session expired" : "Transactions temporarily unavailable"}
          </p>
          <p className="mt-0.5 text-[12px]" style={{ color: "var(--zn-ink-2)" }}>
            {fetchError}
          </p>
          {isSessionError && (
            <a
              href="/api/banking/connect"
              className="mt-2 inline-flex items-center gap-1 text-[12px] font-medium underline"
              style={{ color: "var(--zn-risk)" }}
            >
              <RefreshCw className="size-3" /> Reconnect bank
            </a>
          )}
        </div>
      </div>
    );
  }

  if (!transactions.length) {
    return (
      <p className="text-center text-[13px] py-8" style={{ color: "var(--zn-ink-3)" }}>
        No transactions found yet. Bank data may take a moment to sync.
      </p>
    );
  }

  return (
    <div className="space-y-4">

      {/* ── Summary strip ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-[10px] px-3 py-2.5" style={{ background: "var(--zn-safe-soft)", border: "1px solid color-mix(in srgb, var(--zn-safe) 30%, transparent)" }}>
          <p className="text-[10.5px] font-semibold uppercase tracking-wide" style={{ color: "var(--zn-safe)" }}>Money in</p>
          <p className="text-[15px] font-semibold tabular-nums mt-0.5" style={{ color: "var(--zn-safe)" }}>+{fmtGBP(totalIn)}</p>
        </div>
        <div className="rounded-[10px] px-3 py-2.5" style={{ background: "var(--zn-surface-2)", border: "1px solid var(--zn-line-soft)" }}>
          <p className="text-[10.5px] font-semibold uppercase tracking-wide" style={{ color: "var(--zn-ink-3)" }}>Money out</p>
          <p className="text-[15px] font-semibold tabular-nums mt-0.5" style={{ color: "var(--zn-ink)" }}>−{fmtGBP(totalOut)}</p>
        </div>
        <div className="rounded-[10px] px-3 py-2.5" style={{ background: "var(--zn-surface-2)", border: "1px solid var(--zn-line-soft)" }}>
          <p className="text-[10.5px] font-semibold uppercase tracking-wide" style={{ color: "var(--zn-ink-3)" }}>Net</p>
          <p className="text-[15px] font-semibold tabular-nums mt-0.5" style={{ color: netTotal >= 0 ? "var(--zn-safe)" : "var(--zn-risk)" }}>
            {netTotal >= 0 ? "+" : "−"}{fmtGBP(Math.abs(netTotal))}
          </p>
        </div>
      </div>

      {/* ── Month / year filter pills ─────────────────────────────────────── */}
      {availableMonths.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setSelectedMonth("all")}
            className="rounded-full px-3 py-1 text-[12px] font-medium transition-colors"
            style={{
              background: selectedMonth === "all" ? "var(--zn-ink)" : "var(--zn-surface-2)",
              color:      selectedMonth === "all" ? "var(--zn-surface)" : "var(--zn-ink-2)",
              border: `1px solid ${selectedMonth === "all" ? "var(--zn-ink)" : "var(--zn-line-soft)"}`,
            }}
          >
            All
          </button>
          {availableMonths.map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setSelectedMonth(key)}
              className="rounded-full px-3 py-1 text-[12px] font-medium transition-colors"
              style={{
                background: selectedMonth === key ? "var(--zn-ink)" : "var(--zn-surface-2)",
                color:      selectedMonth === key ? "var(--zn-surface)" : "var(--zn-ink-2)",
                border: `1px solid ${selectedMonth === key ? "var(--zn-ink)" : "var(--zn-line-soft)"}`,
              }}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* ── Matched payments ─────────────────────────────────────────────── */}
      {matches.length > 0 && (
        <section>
          <p
            className="mb-3 text-[11px] font-semibold uppercase tracking-[0.1em]"
            style={{ color: "var(--zn-ink-3)" }}
          >
            Possible payments received ({matches.length})
          </p>
          <div className="space-y-2">
            {matches.map((m) => {
              const alreadyPaid = paidIds.has(m.invoice.id);
              return (
                <div
                  key={m.transaction.transaction_id}
                  className="rounded-[12px] p-4"
                  style={{
                    background: alreadyPaid ? "var(--zn-safe-soft)" : "var(--zn-surface-2)",
                    border: `1px solid ${alreadyPaid ? "var(--zn-safe)" : "var(--zn-line-soft)"}`,
                  }}
                >
                  {/* Top row */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[13.5px] font-semibold" style={{ color: "var(--zn-ink)" }}>
                        {fmtGBP(m.transaction.amount)} received
                      </p>
                      <p className="text-[12px] mt-0.5 truncate" style={{ color: "var(--zn-ink-3)" }}>
                        {m.transaction.description}
                        {m.transaction.merchant_name ? ` · ${m.transaction.merchant_name}` : ""}
                      </p>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <span
                        className="inline-block rounded-full px-2 py-0.5 text-[10.5px] font-semibold"
                        style={{
                          background: m.confidence === "high" ? "var(--zn-safe-soft)" : "var(--zn-warn-soft)",
                          color:      m.confidence === "high" ? "var(--zn-safe)"      : "var(--zn-warn)",
                        }}
                      >
                        {m.confidence === "high" ? "High match" : "Possible match"}
                      </span>
                      <p className="mt-1 text-[11px]" style={{ color: "var(--zn-ink-3)" }}>
                        {fmtDate(m.transaction.timestamp)}
                      </p>
                    </div>
                  </div>

                  {/* Invoice link */}
                  <div
                    className="mt-3 flex items-center justify-between gap-3 rounded-[8px] px-3 py-2"
                    style={{ background: "var(--zn-bg-2)", border: "1px solid var(--zn-line-soft)" }}
                  >
                    <div className="min-w-0">
                      <p className="text-[12px] font-medium truncate" style={{ color: "var(--zn-ink)" }}>
                        {m.invoice.customerName} · {m.invoice.invoiceNumber}
                      </p>
                      <p className="text-[11px]" style={{ color: "var(--zn-ink-3)" }}>
                        {m.reasons.join(" · ")}
                      </p>
                    </div>
                    {alreadyPaid ? (
                      <div className="text-right">
                        <span className="inline-flex items-center gap-1 text-[12px] font-semibold" style={{ color: "var(--zn-safe)" }}>
                          <CheckCircle2 className="size-3.5" /> Marked paid
                        </span>
                        {(() => {
                          const wb = writeBackById[m.invoice.id];
                          if (!wb) return null;
                          if (wb.kind === "pending") {
                            return (
                              <p className="text-[10.5px] mt-0.5" style={{ color: "var(--zn-ink-3)" }}>
                                Syncing to accounting tool…
                              </p>
                            );
                          }
                          if (wb.kind === "ok") {
                            return (
                              <p className="text-[10.5px] mt-0.5" style={{ color: "var(--zn-safe)" }}>
                                Also marked paid in {wb.provider}
                              </p>
                            );
                          }
                          return (
                            <p className="text-[10.5px] mt-0.5" title={wb.message} style={{ color: "var(--zn-warn)" }}>
                              Local only — write-back failed
                            </p>
                          );
                        })()}
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleMarkPaid(m)}
                        className="flex-shrink-0 rounded-full px-3 py-1 text-[12px] font-semibold transition-colors"
                        style={{
                          background: "var(--zn-accent)",
                          color:      "var(--zn-accent-ink)",
                        }}
                      >
                        Mark paid ✓
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Direct income totals strip ─────────────────────────────────── */}
      {taggedTotalThisTaxYear > 0 && (
        <section
          className="flex items-center justify-between gap-3 rounded-[12px] px-4 py-3"
          style={{ background: "var(--zn-surface-2)", border: "1px solid var(--zn-line-soft)" }}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <PiggyBank className="size-4 flex-shrink-0" style={{ color: "var(--zn-accent)" }} />
            <div className="min-w-0">
              <p className="text-[12.5px] font-semibold" style={{ color: "var(--zn-ink)" }}>
                Direct income this tax year
              </p>
              <p className="text-[11px]" style={{ color: "var(--zn-ink-3)" }}>
                Tagged credits counted toward your Self-Assessment estimate.
              </p>
            </div>
          </div>
          <p
            className="text-[16px] font-semibold tabular-nums flex-shrink-0"
            style={{ color: "var(--zn-accent)" }}
          >
            {fmtGBP(taggedTotalThisTaxYear)}
          </p>
        </section>
      )}

      {/* ── All transactions ──────────────────────────────────────────────── */}
      <section>
        <p
          className="mb-3 text-[11px] font-semibold uppercase tracking-[0.1em]"
          style={{ color: "var(--zn-ink-3)" }}
        >
          {selectedMonth === "all"
            ? `All transactions · ${visibleTx.length}`
            : `${availableMonths.find(([k]) => k === selectedMonth)?.[1] ?? ""} · ${visibleTx.length} transaction${visibleTx.length === 1 ? "" : "s"}`}
        </p>

        {visibleTx.length === 0 && (
          <p className="text-center text-[13px] py-6" style={{ color: "var(--zn-ink-3)" }}>
            No transactions in this period.
          </p>
        )}

        <div className="flex gap-4 items-start">
        <div
          className="rounded-[12px] overflow-hidden flex-1 min-w-0"
          style={{ border: visibleTx.length > 0 ? "1px solid var(--zn-line-soft)" : "none" }}
        >
          {visibleTx.map((tx, idx) => {
            const isCredit  = tx.transaction_type === "CREDIT";
            const isMatched = matchedTxIds.has(tx.transaction_id);
            const isThisTagged = taggedTxIds.has(tx.transaction_id);
            // Eligible: it's an inbound credit, not already matched to an
            // open invoice (those have their own flow).
            const canTagAsIncome = isCredit && !isMatched;
            const isSelected = selectedTxId === tx.transaction_id;
            return (
              <div
                key={tx.transaction_id}
                role="button"
                tabIndex={0}
                className="flex items-center gap-3 px-4 py-3 cursor-pointer"
                onClick={() => setSelectedTxId(isSelected ? null : tx.transaction_id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelectedTxId(isSelected ? null : tx.transaction_id);
                  }
                }}
                aria-label={`${tx.description} — ${tx.transaction_type === "CREDIT" ? "+" : "−"}${tx.amount} on ${fmtDate(tx.timestamp)}`}
                aria-expanded={isSelected}
                style={{
                  borderTop: idx === 0 ? "none" : "1px solid var(--zn-line-soft)",
                  background: isSelected ? "var(--zn-surface-2)" : "var(--zn-surface)",
                }}
              >
                {/* Direction icon */}
                <span
                  className="size-7 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{
                    background: isCredit ? "var(--zn-safe-soft)" : "var(--zn-surface-2)",
                  }}
                >
                  {isCredit
                    ? <ArrowDownLeft className="size-3.5" style={{ color: "var(--zn-safe)" }} />
                    : <ArrowUpRight  className="size-3.5" style={{ color: "var(--zn-ink-3)" }} />
                  }
                </span>

                {/* Description */}
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium truncate" style={{ color: "var(--zn-ink)" }}>
                    {tx.description}
                    {tx.merchant_name && tx.merchant_name !== tx.description
                      ? ` · ${tx.merchant_name}` : ""}
                  </p>
                  <p className="text-[11px]" style={{ color: "var(--zn-ink-3)" }}>
                    {fmtDate(tx.timestamp)} · {tx.transaction_category}
                  </p>
                </div>

                {/* Direct-income tag action / badge */}
                {canTagAsIncome && (
                  isThisTagged ? (
                    <span
                      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold flex-shrink-0"
                      style={{ background: "var(--zn-safe-soft)", color: "var(--zn-safe)" }}
                    >
                      <PiggyBank className="size-3" /> Income
                      <button
                        type="button"
                        aria-label="Untag this transaction"
                        onClick={() => handleUntag(tx.transaction_id)}
                        className="ml-1 rounded-full hover:bg-black/10"
                        style={{ color: "var(--zn-safe)" }}
                      >
                        <X className="size-2.5" />
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleTagAsIncome(tx)}
                      className="hidden sm:inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full flex-shrink-0 transition-colors hover:bg-[var(--zn-surface-2)]"
                      style={{
                        color: "var(--zn-ink-3)",
                        border: "1px solid var(--zn-line-soft)",
                      }}
                      title="Count this credit toward your Self-Assessment income"
                    >
                      Tag as income
                    </button>
                  )
                )}

                {/* Amount */}
                <p
                  className="text-[13px] font-semibold tabular-nums flex-shrink-0 w-20 text-right"
                  style={{
                    color: isCredit ? "var(--zn-safe)" : "var(--zn-ink)",
                  }}
                >
                  {isCredit ? "+" : "−"}{fmtGBP(tx.amount)}
                </p>
              </div>
            );
          })}
        </div>

        {/* Detail panel */}
        {selectedTxId && (() => {
          const tx = transactions.find((t) => t.transaction_id === selectedTxId);
          if (!tx) return null;
          const isCredit = tx.transaction_type === "CREDIT";
          return (
            <div
              className="w-72 flex-shrink-0 rounded-[12px] p-4 flex flex-col gap-3"
              style={{
                background: "var(--zn-surface)",
                border: "1px solid var(--zn-line-soft)",
                position: "sticky",
                top: "24px",
              }}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-[15px] font-semibold leading-tight" style={{ color: "var(--zn-ink)" }}>
                  {tx.merchant_name ?? tx.description ?? "Transaction"}
                </p>
                <button
                  type="button"
                  onClick={() => setSelectedTxId(null)}
                  className="flex-shrink-0 rounded-full p-0.5 hover:bg-[var(--zn-surface-2)]"
                  style={{ color: "var(--zn-ink-3)" }}
                  aria-label="Close"
                >
                  <X className="size-4" />
                </button>
              </div>

              {tx.merchant_name && tx.description && tx.merchant_name !== tx.description && (
                <p className="text-[12px]" style={{ color: "var(--zn-ink-3)" }}>{tx.description}</p>
              )}

              <p
                className="text-[22px] font-bold tabular-nums"
                style={{ color: isCredit ? "var(--zn-safe)" : "var(--zn-ink)" }}
              >
                {isCredit ? "+" : "−"}{fmtGBP(tx.amount)}
              </p>

              <div className="flex flex-col gap-2 text-[12.5px]">
                <div className="flex justify-between">
                  <span style={{ color: "var(--zn-ink-3)" }}>Date</span>
                  <span style={{ color: "var(--zn-ink)" }}>{fmtDate(tx.timestamp)}</span>
                </div>
                {tx.transaction_category && (
                  <div className="flex justify-between">
                    <span style={{ color: "var(--zn-ink-3)" }}>Category</span>
                    <span style={{ color: "var(--zn-ink)" }}>{tx.transaction_category}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span style={{ color: "var(--zn-ink-3)" }}>Type</span>
                  <span style={{ color: "var(--zn-ink)" }}>{isCredit ? "Credit" : "Debit"}</span>
                </div>
              </div>

              <p className="text-[10px] break-all" style={{ color: "var(--zn-ink-3)" }}>
                ID: {tx.transaction_id}
              </p>
            </div>
          );
        })()}
        </div>
      </section>

    </div>
  );
}
