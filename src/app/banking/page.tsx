/**
 * src/app/banking/page.tsx
 *
 * Bank feed page — server component.
 *
 * States:
 *   1. Not configured (no TRUELAYER_CLIENT_ID) — shows setup instructions
 *   2. Not connected — "Connect your bank" CTA
 *   3. Connected — fetches transactions and renders BankTransactionsList
 *
 * TrueLayer sandbox test credentials:
 *   Username: john  Password: doe
 *   (works only when TRUELAYER_ENV != "production")
 */

import { BankTransactionsList }    from "@/components/bank-transactions-list";
import { BankStatementImportCard } from "@/components/bank-statement-import-card";
import { getBankConnection, fetchBankTransactions } from "@/actions/bank-feed";
import type { Metadata }           from "next";

export const metadata: Metadata = {
  title: "Bank feed",
  description: "Connect your bank to automatically detect when invoices have been paid.",
};

// ── Error message map ─────────────────────────────────────────────────────────

const ERROR_MESSAGES: Record<string, string> = {
  not_configured:      "TrueLayer isn't set up yet. See setup instructions below.",
  state_mismatch:      "Security check failed. Please try connecting again.",
  token_exchange_failed: "Could not connect to your bank. Please try again.",
  save_failed:         "Connected to your bank but couldn't save the session. Please try again.",
  no_account:          "Could not find your account. Please sign in and try again.",
  missing_params:      "Connection attempt was incomplete. Please try again.",
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function BankingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params     = await searchParams;
  const justConnected = params.connected === "1";
  const errorKey   = params.error;
  const errorMsg   = errorKey ? (ERROR_MESSAGES[errorKey] ?? `Error: ${errorKey}`) : null;

  const isConfigured = Boolean(
    process.env.TRUELAYER_CLIENT_ID && process.env.TRUELAYER_CLIENT_SECRET,
  );

  const connection = isConfigured ? await getBankConnection() : null;

  // Fetch up to 90 days of transactions (most banks cap at 90 days via TrueLayer).
  // The action will automatically try shorter windows if the bank rejects the range.
  let transactions: Awaited<ReturnType<typeof fetchBankTransactions>> = { transactions: [] };
  if (connection) {
    transactions = await fetchBankTransactions(90);
  }

  return (
    <div className="space-y-6 max-w-2xl">

        {/* ── Page header ───────────────────────────────────────────────── */}
        <div>
          <p className="zn-label">Banking</p>
          <h1
            className="mt-1 text-[26px] font-semibold tracking-[-0.02em]"
            style={{ color: "var(--zn-ink)" }}
          >
            Bank feed
          </h1>
          <p className="mt-1 text-[14px]" style={{ color: "var(--zn-ink-2)" }}>
            Connect your bank for automatic daily sync, or import a statement
            CSV manually — then match credits to outstanding invoices.
          </p>
        </div>

        {/* ── Success / error banners ───────────────────────────────────── */}
        {justConnected && (
          <div
            className="flex items-center gap-2 rounded-[10px] px-4 py-3"
            style={{ background: "var(--zn-safe-soft)", border: "1px solid var(--zn-safe)" }}
          >
            <span className="text-[13px] font-medium" style={{ color: "var(--zn-safe)" }}>
              ✓ Bank connected successfully. Transactions are loading below.
            </span>
          </div>
        )}
        {errorMsg && (
          <div
            className="rounded-[10px] px-4 py-3"
            style={{ background: "var(--zn-risk-soft)", border: "1px solid var(--zn-risk)" }}
          >
            <p className="text-[13px] font-medium" style={{ color: "var(--zn-risk)" }}>
              {errorMsg}
            </p>
          </div>
        )}

        {/* ── Live bank connection (TrueLayer) — primary when configured ── */}
        {isConfigured && (
          connection ? (
            /* Connected state */
            <div className="zn-card px-5 py-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="zn-label">Open Banking connection</p>
                  <p
                    className="mt-1.5 text-[17px] font-semibold"
                    style={{ color: "var(--zn-ink)" }}
                  >
                    {connection.providerName ?? "Bank account"}
                  </p>
                  {connection.bankAccountName && (
                    <p className="text-[13px] mt-0.5" style={{ color: "var(--zn-ink-2)" }}>
                      {connection.bankAccountName}
                    </p>
                  )}
                  <p className="text-[12px] mt-2" style={{ color: "var(--zn-ink-3)" }}>
                    Last synced{" "}
                    {new Date(connection.updatedAt).toLocaleString("en-GB", {
                      day: "numeric", month: "short",
                      hour: "2-digit", minute: "2-digit",
                    })}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-medium"
                    style={{ background: "var(--zn-safe-soft)", color: "var(--zn-safe)" }}
                  >
                    <span className="size-1.5 rounded-full" style={{ background: "var(--zn-safe)" }} />
                    Connected
                  </span>
                  <a
                    href="/api/banking/connect"
                    className="text-[11.5px] font-medium"
                    style={{ color: "var(--zn-ink-3)" }}
                  >
                    Reconnect
                  </a>
                </div>
              </div>
            </div>
          ) : (
            /* Configured but not yet connected */
            <div className="zn-card px-5 py-5">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <p className="text-[13.5px] font-semibold" style={{ color: "var(--zn-ink)" }}>
                    Connect via Open Banking
                  </p>
                  <p className="mt-0.5 text-[12.5px]" style={{ color: "var(--zn-ink-3)" }}>
                    Read-only · auto-syncs daily · powered by TrueLayer
                  </p>
                </div>
                <a
                  href="/api/banking/connect"
                  className="zn-pill flex-shrink-0"
                  style={{ background: "var(--zn-ink)", color: "var(--zn-surface)", fontSize: 12 }}
                >
                  Connect bank
                </a>
              </div>
            </div>
          )
        )}

        {/* ── Manual CSV import — always visible for adding extra statements ── */}
        {/* When Open Banking is connected the transaction list inside is hidden
            (no duplication) but the card stays so users can still import extra
            months or accounts. */}
        <BankStatementImportCard openBankingConnected={!!connection} />

        {/* ── Live transaction list (when Open Banking connected) ────────── */}
        {connection && (
          <BankTransactionsList
            transactions={transactions.transactions}
            fetchError={transactions.error}
          />
        )}

    </div>
  );
}

