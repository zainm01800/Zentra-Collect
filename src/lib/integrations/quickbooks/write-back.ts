/**
 * QuickBooks Online — mark invoice paid by creating a Payment object.
 *
 * The Payment links to the invoice via LinkedTxn (TxnType=Invoice).
 * If DepositToAccountRef is omitted QB drops the payment into the
 * customer's default Undeposited Funds — which is the right thing to
 * do when we don't know the user's bank chart.
 *
 * Required OAuth scope: com.intuit.quickbooks.accounting (covers both
 * read and write — read-only doesn't exist in QB OAuth).
 *
 * https://developer.intuit.com/app/developer/qbo/docs/api/accounting/all-entities/payment
 */

import { readConnection, isTokenExpired, updateTokens } from "@/lib/integrations/oauth-store";
import { refreshTokens } from "./client";
import type { WriteBackInput, WriteBackResult } from "../write-back";

const QB_API_BASE =
  process.env.QUICKBOOKS_ENV === "sandbox"
    ? "https://sandbox-quickbooks.api.intuit.com/v3/company"
    : "https://quickbooks.api.intuit.com/v3/company";

async function freshAccessToken(accountId: string): Promise<{ token: string; realmId: string } | null> {
  const conn = await readConnection(accountId, "quickbooks");
  if (!conn) return null;
  if (!isTokenExpired(conn)) {
    return { token: conn.accessToken, realmId: conn.providerTenantId };
  }
  const r = await refreshTokens(conn.refreshToken);
  await updateTokens(conn.id, r.accessToken, r.refreshToken, new Date(Date.now() + r.expiresIn * 1000));
  return { token: r.accessToken, realmId: conn.providerTenantId };
}

async function findInvoiceCustomerRef(
  token: string,
  realmId: string,
  invoiceId: string,
): Promise<string | null> {
  const res = await fetch(`${QB_API_BASE}/${realmId}/invoice/${invoiceId}`, {
    headers: {
      "Authorization": `Bearer ${token}`,
      "Accept":        "application/json",
    },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data?.Invoice?.CustomerRef?.value ?? null;
}

export async function markPaidInQuickBooks(input: WriteBackInput): Promise<WriteBackResult> {
  const invoiceId = input.sourceInvoiceId.replace(/^quickbooks-/, "");

  const auth = await freshAccessToken(input.accountId);
  if (!auth) return { ok: false, error: "No QuickBooks connection." };

  // QB requires CustomerRef on the Payment; fetch it from the invoice.
  const customerId = await findInvoiceCustomerRef(auth.token, auth.realmId, invoiceId);
  if (!customerId) {
    return {
      ok: false,
      error: "Couldn't find the QuickBooks invoice to mark paid. It may have been deleted.",
    };
  }

  const payment = {
    TotalAmt: input.amountPaid,
    CustomerRef: { value: customerId },
    TxnDate: input.paidDate,
    PaymentRefNum: (input.reference ?? "Zentra").slice(0, 21),
    Line: [
      {
        Amount: input.amountPaid,
        LinkedTxn: [
          { TxnId: invoiceId, TxnType: "Invoice" },
        ],
      },
    ],
  };

  const res = await fetch(`${QB_API_BASE}/${auth.realmId}/payment?minorversion=70`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${auth.token}`,
      "Content-Type":  "application/json",
      "Accept":        "application/json",
    },
    body: JSON.stringify(payment),
  });

  if (res.status === 401 || res.status === 403) {
    return {
      ok: false,
      reauthorize: true,
      error: "QuickBooks connection needs to be re-authorized — reconnect from /settings/integrations.",
    };
  }

  if (!res.ok) {
    const errText = await res.text();
    return { ok: false, error: `QuickBooks ${res.status}: ${errText.slice(0, 200)}` };
  }

  return { ok: true };
}
