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

  // Fetch transactions if connected
  let transactions: Awaited<ReturnType<typeof fetchBankTransactions>> = { transactions: [] };
  if (connection) {
    transactions = await fetchBankTransactions(30);
  }

  return (
    <div className="space-y-8 max-w-2xl">

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
            Upload a statement export from any major UK bank — CSV, Excel, TSV
            or TXT all work. Zentra parses it client-side and matches credits
            to your outstanding invoices.
          </p>
        </div>

        {/* ── Success banner ────────────────────────────────────────────── */}
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

        {/* ── Error banner ──────────────────────────────────────────────── */}
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

        {/* ── Connection card ───────────────────────────────────────────── */}
        <div
          className="zn-card px-5 py-5"
        >
          {connection ? (
            /* Connected state */
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="zn-label">Connected bank</p>
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
                <form action="/api/banking/connect" method="GET">
                  <button
                    type="submit"
                    className="text-[11.5px] font-medium"
                    style={{ color: "var(--zn-ink-3)" }}
                  >
                    Reconnect
                  </button>
                </form>
              </div>
            </div>
          ) : isConfigured ? (
            /* Configured but not yet connected */
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <div>
                <p
                  className="text-[15px] font-semibold"
                  style={{ color: "var(--zn-ink)" }}
                >
                  Connect your business bank
                </p>
                <p
                  className="mt-1 text-[13px] max-w-sm mx-auto"
                  style={{ color: "var(--zn-ink-2)" }}
                >
                  Zentra will read your last 30 days of transactions and match
                  credits to outstanding invoices — no manual reconciliation.
                </p>
              </div>
              <a
                href="/api/banking/connect"
                className="zn-pill"
                style={{
                  background: "var(--zn-accent)",
                  color:      "var(--zn-accent-ink)",
                }}
              >
                Connect bank account
              </a>
              <p className="text-[11px]" style={{ color: "var(--zn-ink-3)" }}>
                Read-only access · secured via Open Banking · powered by TrueLayer
              </p>
            </div>
          ) : (
            /* TrueLayer not configured */
            <SetupInstructions />
          )}
        </div>

        {/* ── Transactions ──────────────────────────────────────────────── */}
        {connection && (
          <BankTransactionsList
            transactions={transactions.transactions}
            fetchError={transactions.error}
          />
        )}

        {/* ── Manual CSV import ─────────────────────────────────────────── */}
        <BankStatementImportCard />

    </div>
  );
}

// ── Setup instructions sub-component ─────────────────────────────────────────

function SetupInstructions() {
  return (
    <div className="flex flex-col items-center gap-3 py-4 text-center">
      <div>
        <p className="text-[15px] font-semibold" style={{ color: "var(--zn-ink)" }}>
          Upload your bank statement below
        </p>
        <p className="mt-1 text-[13px] max-w-sm mx-auto" style={{ color: "var(--zn-ink-2)" }}>
          Zentra accepts CSV, Excel, TSV, and TXT exports from every major UK
          bank. Drag-and-drop the file you exported from your bank&apos;s
          online banking — Zentra detects the format and shows a preview
          before saving.
        </p>
      </div>
      <p className="text-[11px]" style={{ color: "var(--zn-ink-3)" }}>
        Files are parsed in your browser · nothing leaves your device unless you save
      </p>
    </div>
  );
}
