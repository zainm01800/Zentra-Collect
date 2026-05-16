/**
 * Xero — mark invoice paid by creating a Payment record.
 *
 * Xero doesn't let you flip Status to PAID directly. You create a
 * Payment against the invoice, against an Account of Type BANK.
 *
 * Required OAuth scope: accounting.transactions (write). Read-only
 * scope returns 403 — we detect this and return { reauthorize: true }
 * so the UI can prompt the user to reconnect.
 *
 * https://developer.xero.com/documentation/api/accounting/payments
 */

import { readConnection, isTokenExpired, updateTokens } from "@/lib/integrations/oauth-store";
import { refreshTokens } from "./client";
import type { WriteBackInput, WriteBackResult } from "../write-back";

const XERO_API_BASE = "https://api.xero.com/api.xro/2.0";

async function freshAccessToken(accountId: string): Promise<{ token: string; tenantId: string } | null> {
  const conn = await readConnection(accountId, "xero");
  if (!conn) return null;
  if (!isTokenExpired(conn)) {
    return { token: conn.accessToken, tenantId: conn.providerTenantId };
  }
  const r = await refreshTokens(conn.refreshToken);
  await updateTokens(conn.id, r.accessToken, r.refreshToken, new Date(Date.now() + r.expiresIn * 1000));
  return { token: r.accessToken, tenantId: conn.providerTenantId };
}

async function findBankAccountCode(token: string, tenantId: string): Promise<string | null> {
  const res = await fetch(`${XERO_API_BASE}/Accounts?where=${encodeURIComponent('Type=="BANK"&&Status=="ACTIVE"')}`, {
    headers: {
      "Authorization": `Bearer ${token}`,
      "Xero-Tenant-Id": tenantId,
      "Accept":         "application/json",
    },
  });
  if (!res.ok) return null;
  const data = await res.json();
  const accounts = (data.Accounts ?? []) as Array<{ Code?: string }>;
  const first = accounts.find((a) => a.Code);
  return first?.Code ?? null;
}

export async function markPaidInXero(input: WriteBackInput): Promise<WriteBackResult> {
  // Source ID stored as "xero-{InvoiceID}" by the mapper
  const invoiceId = input.sourceInvoiceId.replace(/^xero-/, "");

  const auth = await freshAccessToken(input.accountId);
  if (!auth) return { ok: false, error: "No Xero connection." };

  const bankCode = await findBankAccountCode(auth.token, auth.tenantId);
  if (!bankCode) {
    return {
      ok: false,
      error: "No active Xero BANK account found — can't record the payment. Add a bank account in Xero or disable write-back.",
    };
  }

  const body = {
    Invoice: { InvoiceID: invoiceId },
    Account: { Code: bankCode },
    Date:    input.paidDate,
    Amount:  input.amountPaid,
    Reference: input.reference ?? "Zentra Collect — paid via customer portal",
  };

  const res = await fetch(`${XERO_API_BASE}/Payments`, {
    method: "PUT",
    headers: {
      "Authorization": `Bearer ${auth.token}`,
      "Xero-Tenant-Id": auth.tenantId,
      "Content-Type":   "application/json",
      "Accept":         "application/json",
    },
    body: JSON.stringify(body),
  });

  if (res.status === 403) {
    return {
      ok: false,
      reauthorize: true,
      error: "Xero connection is read-only — reconnect from /settings/integrations to enable write-back.",
    };
  }

  if (!res.ok) {
    const errText = await res.text();
    return { ok: false, error: `Xero ${res.status}: ${errText.slice(0, 200)}` };
  }

  return { ok: true };
}
