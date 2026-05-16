"use server";

/**
 * src/actions/create-invoice-link.ts
 *
 * Signs a customer-portal token for a newly-created invoice and returns
 * the shareable URL. The actual invoice data is stored client-side in
 * localStorage (matching the existing import flow) — this server action
 * is only for the HMAC signing, which has to happen server-side because
 * PAYMENT_TOKEN_SECRET never crosses to the browser.
 */

import { signPaymentToken, buildPortalUrl } from "@/lib/customer-portal/token";

export interface CreateInvoiceLinkInput {
  invoiceId:     string;
  invoiceNumber: string;
  customerName:  string;
  amount:        number;
  dueDate:       string;
  businessName:  string;
  businessEmail: string;
}

export type CreateInvoiceLinkResult =
  | { ok: true;  url: string }
  | { ok: false; error: string };

export async function createInvoiceLinkAction(
  input: CreateInvoiceLinkInput,
): Promise<CreateInvoiceLinkResult> {
  if (!input.invoiceNumber || !input.customerName || !input.amount || !input.dueDate) {
    return { ok: false, error: "Missing required invoice fields." };
  }
  if (!input.businessName) {
    return { ok: false, error: "Set your business name in Settings before issuing invoices." };
  }

  const token = signPaymentToken({
    invoiceId:     input.invoiceId,
    invoiceNumber: input.invoiceNumber,
    customerName:  input.customerName,
    amount:        input.amount,
    dueDate:       input.dueDate,
    businessName:  input.businessName,
    businessEmail: input.businessEmail || "noreply@example.com",
  });

  if (!token) {
    return {
      ok:    false,
      error: "Customer portal isn't configured (PAYMENT_TOKEN_SECRET missing). Contact support.",
    };
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://zentracollect.co.uk";
  return { ok: true, url: buildPortalUrl(siteUrl, token) };
}
