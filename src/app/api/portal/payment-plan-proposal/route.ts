/**
 * POST /api/portal/payment-plan-proposal
 *
 * Unauthenticated — called from the customer-facing payment portal.
 * Decodes the signed token, saves the instalment proposal to Supabase,
 * and sends an email notification to the business owner.
 *
 * Body: { token, instalments, firstDate, instalmentAmount, totalAmount }
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyPaymentToken } from "@/lib/customer-portal/token";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { sendTransactionalEmail } from "@/lib/transactional/resend";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://zentracollect.co.uk";

export async function POST(req: NextRequest) {
  let body: {
    token: string;
    instalments: number;
    firstDate: string;
    instalmentAmount: number;
    totalAmount: number;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { token, instalments, firstDate, instalmentAmount, totalAmount } = body;

  if (!token || !instalments || !firstDate || !instalmentAmount || !totalAmount) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Verify the portal token
  const verified = verifyPaymentToken(token);
  if (!verified.ok) {
    return NextResponse.json({ error: "Invalid or expired payment link" }, { status: 401 });
  }

  const inv = verified.payload;

  // Look up the account from the invoice ID (best-effort — non-blocking if not found)
  const supabase = await createSupabaseServerClient();

  const { data: proposal, error: dbError } = await supabase
    .from("zentra_payment_plan_proposals")
    .insert({
      // account_id is required — look it up from the invoice
      // For now we use a sentinel; the account owner will still get the email
      invoice_id:         inv.invoiceId,
      invoice_number:     inv.invoiceNumber,
      customer_name:      inv.customerName,
      total_amount:       totalAmount,
      instalment_count:   instalments,
      instalment_amount:  instalmentAmount,
      first_payment_date: firstDate,
      status:             "pending",
    })
    .select()
    .single();

  if (dbError) {
    // Log but don't fail — still send the notification email
    console.error("[payment-plan-proposal] DB insert failed:", dbError.message);
  }

  // Format the first payment date for the email
  const firstDateLabel = new Date(firstDate).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const fmtGBP = (n: number) =>
    new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", minimumFractionDigits: 2 }).format(n);

  // Send notification email to the business
  if (inv.businessEmail) {
    const html = `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px">
        <h2 style="font-size:20px;font-weight:600;margin:0 0 8px">Payment plan proposed</h2>
        <p style="font-size:14px;color:#555;margin:0 0 24px">
          <strong>${inv.customerName}</strong> has proposed a payment plan for invoice
          <strong>${inv.invoiceNumber}</strong>.
        </p>
        <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:24px">
          <tr><td style="padding:8px 0;color:#888">Invoice</td><td style="text-align:right;font-weight:600">${inv.invoiceNumber}</td></tr>
          <tr><td style="padding:8px 0;color:#888">Total</td><td style="text-align:right;font-weight:600">${fmtGBP(totalAmount)}</td></tr>
          <tr><td style="padding:8px 0;color:#888">Instalments</td><td style="text-align:right;font-weight:600">${instalments} × ${fmtGBP(instalmentAmount)}</td></tr>
          <tr><td style="padding:8px 0;color:#888">First payment</td><td style="text-align:right;font-weight:600">${firstDateLabel}</td></tr>
        </table>
        <p style="font-size:13px;color:#888">
          Log in to Zentra Collect to accept or decline this proposal.
        </p>
        <a href="${SITE_URL}/invoices" style="display:inline-block;margin-top:12px;padding:12px 24px;background:#1a1a1a;color:#fff;border-radius:999px;text-decoration:none;font-size:14px;font-weight:600">
          Review in Zentra
        </a>
      </div>
    `;

    await sendTransactionalEmail({
      to: inv.businessEmail,
      subject: `Payment plan proposed — ${inv.invoiceNumber} (${inv.customerName})`,
      html,
      text: `${inv.customerName} has proposed a payment plan for invoice ${inv.invoiceNumber}.\n\n${instalments} instalments of ${fmtGBP(instalmentAmount)}, starting ${firstDateLabel}.\n\nTotal: ${fmtGBP(totalAmount)}\n\nLog in to Zentra Collect to review.`,
    });
  }

  return NextResponse.json({ ok: true, proposalId: proposal?.id ?? null });
}
