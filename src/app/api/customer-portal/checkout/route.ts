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

export async function POST(request: Request) {
  const formData = await request.formData();
  const token = String(formData.get("token") ?? "");

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

  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "gbp",
            unit_amount: Math.round(inv.amount * 100), // pence
            product_data: {
              name: `Invoice ${inv.invoiceNumber}`,
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
