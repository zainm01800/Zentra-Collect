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
import { AlertCircle, ArrowDownLeft, ArrowUpRight, CheckCircle2, RefreshCw } from "lucide-react";
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

  // Load invoices from localStorage after hydration
  useEffect(() => {
    setInvoices(readStoredInvoices());
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

  // ── Error state ───────────────────────────────────────────────────────────

  if (fetchError) {
    return (
      <div
        className="flex items-start gap-3 rounded-[12px] px-4 py-4"
        style={{ background: "var(--zn-risk-soft)", border: "1px solid var(--zn-risk)" }}
      >
        <AlertCircle className="size-4 flex-shrink-0 mt-0.5" style={{ color: "var(--zn-risk)" }} />
        <div>
          <p className="text-[13px] font-semibold" style={{ color: "var(--zn-risk)" }}>
            Could not load transactions
          </p>
          <p className="mt-0.5 text-[12px]" style={{ color: "var(--zn-risk)" }}>
            {fetchError}
          </p>
          <a
            href="/api/banking/connect"
            className="mt-2 inline-flex items-center gap-1 text-[12px] font-medium underline"
            style={{ color: "var(--zn-risk)" }}
          >
            <RefreshCw className="size-3" /> Reconnect bank
          </a>
        </div>
      </div>
    );
  }

  if (!transactions.length) {
    return (
      <p className="text-center text-[13px] py-8" style={{ color: "var(--zn-ink-3)" }}>
        No transactions found in the last 30 days.
      </p>
    );
  }

  return (
    <div className="space-y-6">

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

      {/* ── All transactions ──────────────────────────────────────────────── */}
      <section>
        <p
          className="mb-3 text-[11px] font-semibold uppercase tracking-[0.1em]"
          style={{ color: "var(--zn-ink-3)" }}
        >
          Last 30 days · {transactions.length} transactions
        </p>
        <div
          className="rounded-[12px] overflow-hidden"
          style={{ border: "1px solid var(--zn-line-soft)" }}
        >
          {transactions.map((tx, idx) => {
            const isCredit = tx.transaction_type === "CREDIT";
            return (
              <div
                key={tx.transaction_id}
                className="flex items-center gap-3 px-4 py-3"
                style={{
                  borderTop: idx === 0 ? "none" : "1px solid var(--zn-line-soft)",
                  background: "var(--zn-surface)",
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

                {/* Amount */}
                <p
                  className="text-[13px] font-semibold tabular-nums flex-shrink-0"
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
      </section>

    </div>
  );
}
