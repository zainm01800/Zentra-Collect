/**
 * POST /api/customer-portal/checkout
 *
 * Customer-facing — invoked from the public /pay/[token] page when the
 * customer clicks "Pay now". Creates a Stripe Checkout Session for the
 * exact invoice amount in the signed token, then 303-redirects to it.
 *
 * No auth required (the token IS the auth — it's HMAC-signed).
 */

import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe/client";
import { verifyPaymentToken } from "@/lib/customer-portal/token";
import {
  calculateStatutoryInterest,
  isInterestMaterial,
} from "@/lib/statutory-interest";

const DAY_MS = 24 * 60 * 60 * 1000;

export async function POST(request: Request) {
  const formData = await request.formData();
  const token = String(formData.get("token") ?? "");
  const includeFees = String(formData.get("includeFees") ?? "0") === "1";

  if (!token) {
    return new NextResponse("Missing token", { status: 400 });
  }

  const verified = verifyPaymentToken(token);
  if (!verified.ok) {
    return NextResponse.redirect(new URL(`/pay/${token}`, request.url), 303);
  }

  const inv = verified.payload;
  const origin = new URL(request.url).origin;

  // Build success + cancel URLs that come back to the same portal page
  const successUrl = `${origin}/pay/${token}?success=1`;
  const cancelUrl  = `${origin}/pay/${token}?cancelled=1`;

  // ── Compute charge amount (recompute server-side; never trust client) ──────
  const daysOverdue = Math.max(
    0,
    Math.floor((Date.now() - new Date(inv.dueDate).getTime()) / DAY_MS),
  );
  const eligibleForFees = includeFees && isInterestMaterial(inv.amount, daysOverdue);
  const calc = eligibleForFees
    ? calculateStatutoryInterest(inv.amount, daysOverdue)
    : null;
  const chargeAmount = calc ? calc.totalRecoverable : inv.amount;
  const lineItemName = calc
    ? `Invoice ${inv.invoiceNumber} (incl. statutory interest)`
    : `Invoice ${inv.invoiceNumber}`;

  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "gbp",
            unit_amount: Math.round(chargeAmount * 100), // pence
            product_data: {
              name: lineItemName,
              description: `Payment to ${inv.businessName} from ${inv.customerName}`,
            },
          },
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url:  cancelUrl,
      // Metadata flows back via the webhook so the user's system can
      // reconcile the payment to the original invoice.
      metadata: {
        invoiceId:     inv.invoiceId,
        invoiceNumber: inv.invoiceNumber,
        customerName:  inv.customerName,
        businessName:  inv.businessName,
        baseAmount:    String(inv.amount),
        chargedAmount: String(chargeAmount),
        includedFees:  calc ? "1" : "0",
        interest:      calc ? String(calc.interest) : "0",
        compensation:  calc ? String(calc.compensation) : "0",
      },
      // Optional — pre-populate the customer email if you have it.
      // customer_email: inv.customerEmail,
    });

    if (!session.url) {
      throw new Error("Stripe did not return a checkout URL.");
    }

    return NextResponse.redirect(session.url, 303);
  } catch (err) {
    console.error("[customer-portal/checkout] Stripe error:", err);
    // Send the customer back to the portal with a generic error indicator
    return NextResponse.redirect(
      new URL(`/pay/${token}?cancelled=1`, request.url),
      303,
    );
  }
}
