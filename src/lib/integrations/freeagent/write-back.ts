/**
 * FreeAgent — mark invoice paid by creating a bank transaction
 * explanation linked to the invoice.
 *
 * FreeAgent doesn't have a single "mark paid" endpoint. The Sage-style
 * flow is to create a bank_transaction (the payment hitting your account)
 * and then an explanation tying it to the invoice. To keep this simple,
 * we look up the user's primary bank account and create both records in
 * one call via the manual_journal-less /bank_transaction_explanations
 * endpoint when a transaction already exists, OR use the simpler
 * /invoices/{id}/transitions to "mark as sent" + a payment record.
 *
 * The cleanest path: POST /v2/invoices/{id}/payments — no, that endpoint
 * doesn't exist either. Pragmatic path: create a bank_transaction +
 * explanation. We do this in two API calls.
 *
 * https://dev.freeagent.com/docs/bank_transactions
 * https://dev.freeagent.com/docs/bank_transaction_explanations
 */

import { readConnection, isTokenExpired, updateTokens } from "@/lib/integrations/oauth-store";
import { refreshTokens } from "./client";
import type { WriteBackInput, WriteBackResult } from "../write-back";

const FA_API_BASE =
  process.env.FA_ENV === "sandbox"
    ? "https://api.sandbox.freeagent.com/v2"
    : "https://api.freeagent.com/v2";

async function freshAccessToken(accountId: string): Promise<string | null> {
  const conn = await readConnection(accountId, "freeagent");
  if (!conn) return null;
  if (!isTokenExpired(conn)) return conn.accessToken;
  const r = await refreshTokens(conn.refreshToken);
  await updateTokens(conn.id, r.accessToken, r.refreshToken, new Date(Date.now() + r.expiresIn * 1000));
  return r.accessToken;
}

async function findPrimaryBankAccountUrl(token: string): Promise<string | null> {
  const res = await fetch(`${FA_API_BASE}/bank_accounts?type=standard_bank_account`, {
    headers: {
      "Authorization": `Bearer ${token}`,
      "Accept":        "application/json",
      "User-Agent":    "Zentra Collect (contact: support@zentracollect.app)",
    },
  });
  if (!res.ok) return null;
  const data = await res.json();
  const accounts = (data.bank_accounts ?? []) as Array<{ url: string }>;
  return accounts[0]?.url ?? null;
}

export async function markPaidInFreeAgent(input: WriteBackInput): Promise<WriteBackResult> {
  // FreeAgent invoice URLs are absolute; the source id we stored is
  // "freeagent-{lastUrlSegment}" by the mapper, so rebuild the URL.
  const invoiceId = input.sourceInvoiceId.replace(/^freeagent-/, "");
  const invoiceUrl = `${FA_API_BASE}/invoices/${invoiceId}`;

  const token = await freshAccessToken(input.accountId);
  if (!token) return { ok: false, error: "No FreeAgent connection." };

  const bankUrl = await findPrimaryBankAccountUrl(token);
  if (!bankUrl) {
    return {
      ok: false,
      error: "Couldn't find a FreeAgent standard bank account — write-back skipped.",
    };
  }

  // Create a bank transaction (the incoming payment)
  const txnBody = {
    bank_transaction: {
      bank_account:  bankUrl,
      dated_on:      input.paidDate,
      amount:        input.amountPaid,
      description:   input.reference ?? "Zentra Collect — paid via customer portal",
    },
  };
  const txnRes = await fetch(`${FA_API_BASE}/bank_transactions`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type":  "application/json",
      "Accept":        "application/json",
      "User-Agent":    "Zentra Collect (contact: support@zentracollect.app)",
    },
    body: JSON.stringify(txnBody),
  });

  if (txnRes.status === 401 || txnRes.status === 403) {
    return {
      ok: false,
      reauthorize: true,
      error: "FreeAgent connection needs to be re-authorized — reconnect from /settings/integrations.",
    };
  }
  if (!txnRes.ok) {
    return { ok: false, error: `FreeAgent (txn) ${txnRes.status}: ${(await txnRes.text()).slice(0, 200)}` };
  }
  const txnData = await txnRes.json();
  const txnUrl  = txnData?.bank_transaction?.url as string | undefined;
  if (!txnUrl) {
    return { ok: false, error: "FreeAgent didn't return a transaction URL." };
  }

  // Explain that transaction against the invoice
  const explainBody = {
    bank_transaction_explanation: {
      bank_transaction: txnUrl,
      bank_account:     bankUrl,
      dated_on:         input.paidDate,
      gross_value:      input.amountPaid,
      paid_invoice:     invoiceUrl,
    },
  };
  const expRes = await fetch(`${FA_API_BASE}/bank_transaction_explanations`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type":  "application/json",
      "Accept":        "application/json",
      "User-Agent":    "Zentra Collect (contact: support@zentracollect.app)",
    },
    body: JSON.stringify(explainBody),
  });
  if (!expRes.ok) {
    return { ok: false, error: `FreeAgent (explanation) ${expRes.status}: ${(await expRes.text()).slice(0, 200)}` };
  }

  return { ok: true };
}
