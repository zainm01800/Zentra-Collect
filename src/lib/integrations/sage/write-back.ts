/**
 * Sage Business Cloud Accounting — mark invoice paid by recording a
 * contact payment against the sales invoice.
 *
 * POST /sales_invoices/{id}/contact_payments creates a payment record
 * and allocates it to the invoice in one call. Needs a payment_method
 * (we look up the first active bank account) and a date.
 *
 * https://developer.sage.com/accounting/reference/sales-invoices/
 */

import { readConnection, isTokenExpired, updateTokens } from "@/lib/integrations/oauth-store";
import { refreshTokens } from "./client";
import type { WriteBackInput, WriteBackResult } from "../write-back";

const SAGE_API_BASE = "https://api.accounting.sage.com/v3.1";

async function freshAccessToken(accountId: string): Promise<string | null> {
  const conn = await readConnection(accountId, "sage");
  if (!conn) return null;
  if (!isTokenExpired(conn)) return conn.accessToken;
  const r = await refreshTokens(conn.refreshToken);
  await updateTokens(conn.id, r.accessToken, r.refreshToken, new Date(Date.now() + r.expiresIn * 1000));
  return r.accessToken;
}

async function findBankAccountId(token: string): Promise<string | null> {
  const res = await fetch(`${SAGE_API_BASE}/bank_accounts?items_per_page=1`, {
    headers: {
      "Authorization": `Bearer ${token}`,
      "Accept":        "application/json",
    },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data?.$items?.[0]?.id ?? null;
}

async function findPaymentMethodId(token: string): Promise<string | null> {
  // Sage requires a payment_method; fetch the first one available.
  const res = await fetch(`${SAGE_API_BASE}/payment_methods?items_per_page=1`, {
    headers: {
      "Authorization": `Bearer ${token}`,
      "Accept":        "application/json",
    },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data?.$items?.[0]?.id ?? null;
}

export async function markPaidInSage(input: WriteBackInput): Promise<WriteBackResult> {
  const invoiceId = input.sourceInvoiceId.replace(/^sage-/, "");

  const token = await freshAccessToken(input.accountId);
  if (!token) return { ok: false, error: "No Sage connection." };

  const [bankId, methodId] = await Promise.all([
    findBankAccountId(token),
    findPaymentMethodId(token),
  ]);

  if (!bankId || !methodId) {
    return {
      ok: false,
      error: "Couldn't find a Sage bank account or payment method — write-back skipped.",
    };
  }

  const body = {
    contact_payment: {
      transaction_type_id: "INVOICE_PAYMENT",
      payment_method_id:   methodId,
      bank_account_id:     bankId,
      date:                input.paidDate,
      total_amount:        input.amountPaid,
      reference:           (input.reference ?? "Zentra Collect").slice(0, 60),
    },
  };

  const res = await fetch(`${SAGE_API_BASE}/sales_invoices/${invoiceId}/contact_payments`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type":  "application/json",
      "Accept":        "application/json",
    },
    body: JSON.stringify(body),
  });

  if (res.status === 401 || res.status === 403) {
    return {
      ok: false,
      reauthorize: true,
      error: "Sage connection is read-only — reconnect from /settings/integrations to enable write-back.",
    };
  }

  if (!res.ok) {
    const errText = await res.text();
    return { ok: false, error: `Sage ${res.status}: ${errText.slice(0, 200)}` };
  }

  return { ok: true };
}
