/**
 * POST /api/portal/payment-link
 *
 * Generates a signed customer portal payment link for a given invoice.
 * Body: { invoiceId, invoiceNumber, customerName, amount, dueDate, businessName?, businessEmail? }
 * Returns: { url: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { signPaymentToken } from "@/lib/customer-portal/token";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://zentracollect.co.uk";

export async function POST(req: NextRequest) {
  let body: {
    invoiceId: string;
    invoiceNumber: string;
    customerName: string;
    amount: number;
    dueDate?: string;
    businessName?: string;
    businessEmail?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { invoiceId, invoiceNumber, customerName, amount, dueDate, businessName, businessEmail } = body;

  if (!invoiceId || !invoiceNumber || !customerName || !amount) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  try {
    const token = signPaymentToken({
      invoiceId,
      invoiceNumber,
      customerName,
      amount,
      dueDate: dueDate ?? new Date().toISOString().slice(0, 10),
      businessName: businessName ?? "Zentra Collect",
      businessEmail: businessEmail ?? "",
    });

    return NextResponse.json({ url: `${SITE_URL}/pay/${token}` });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to generate link";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
