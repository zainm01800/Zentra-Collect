"use server";

/**
 * src/actions/payment-links.ts
 *
 * Creates a Stripe Payment Link for a specific invoice so the user can
 * paste it into a chase email and let their client pay by card.
 *
 * Flow:
 *   1. Create an ad-hoc Stripe price for the outstanding amount.
 *   2. Create a Payment Link pointing at that price.
 *   3. Return the shareable URL to the client component.
 *
 * No webhook required for the MVP — the link works independently of
 * Zentra's database.  A future iteration will listen for
 * payment_intent.succeeded to auto-mark the invoice as paid.
 */

import { getStripe } from "@/lib/stripe/client";
import {
  createSupabaseServerClient,
  hasSupabaseServerConfig,
} from "@/lib/supabase/server";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CreatePaymentLinkInput {
  invoiceRef:        string;   // e.g. "INV-042"
  clientName:        string;   // e.g. "Acme Ltd"
  amountOutstanding: number;   // GBP, e.g. 1250.00
  currency?:         string;   // defaults to "gbp"
}

export type CreatePaymentLinkResult =
  | { ok: true;  url: string }
  | { ok: false; error: string };

// ── Action ────────────────────────────────────────────────────────────────────

export async function createPaymentLink(
  input: CreatePaymentLinkInput,
): Promise<CreatePaymentLinkResult> {
  // ── Guard: Stripe key must be present ──────────────────────────────────────
  if (!process.env.STRIPE_SECRET_KEY) {
    return {
      ok:    false,
      error: "Stripe is not configured. Add STRIPE_SECRET_KEY to your environment.",
    };
  }

  // ── Guard: must be authenticated ──────────────────────────────────────────
  if (hasSupabaseServerConfig()) {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { ok: false, error: "You must be signed in to generate a payment link." };
    }
  }

  // ── Validate amount ───────────────────────────────────────────────────────
  const amountPence = Math.round(input.amountOutstanding * 100);
  if (amountPence < 50) {
    return {
      ok:    false,
      error: "Amount must be at least £0.50 to create a payment link.",
    };
  }

  const currency = (input.currency ?? "gbp").toLowerCase();

  try {
    const stripe = getStripe();

    // Step 1: create a one-time price for this specific invoice amount.
    const price = await stripe.prices.create({
      currency,
      unit_amount: amountPence,
      product_data: {
        name: `Invoice ${input.invoiceRef}`,
        // Extra context visible in the Stripe dashboard
        metadata: {
          invoice_ref: input.invoiceRef,
          client_name: input.clientName,
        },
      },
    });

    // Step 2: create the Payment Link.
    const paymentLink = await stripe.paymentLinks.create({
      line_items: [{ price: price.id, quantity: 1 }],
      // Metadata on the payment link — queryable via Stripe dashboard / webhooks.
      metadata: {
        invoice_ref: input.invoiceRef,
        client_name: input.clientName,
      },
      // Collect billing address so Stripe can issue a proper receipt.
      billing_address_collection: "auto",
      // Custom fields or redirects can be added here in future iterations.
    });

    return { ok: true, url: paymentLink.url };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown Stripe error";
    console.error("[createPaymentLink]", err);
    return { ok: false, error: msg };
  }
}
