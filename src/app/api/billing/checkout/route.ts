import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe/client";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Single add-on price for all eligible plans (£5/mo).
const EMAIL_ADDON_PRICE_ID = process.env.STRIPE_EMAIL_ADDON_PRICE_ID;

export async function POST(request: Request) {
  try {
    const { priceId, planId, addonType } = await request.json() as {
      priceId?: string;
      planId?: string;
      addonType?: string;
    };

    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: memberData } = await supabase
      .from("zentra_account_members")
      .select("account_id, zentra_accounts(stripe_customer_id, plan_id)")
      .eq("user_id", user.id)
      .single();

    if (!memberData) return NextResponse.json({ error: "No account found" }, { status: 404 });

    const accountId = memberData.account_id;
    const account = (Array.isArray(memberData.zentra_accounts)
      ? memberData.zentra_accounts[0]
      : memberData.zentra_accounts) as Record<string, unknown>;

    let stripeCustomerId = account?.stripe_customer_id as string | undefined;
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { accountId, supabaseUserId: user.id },
      });
      stripeCustomerId = customer.id;
      await supabase
        .from("zentra_accounts")
        .update({ stripe_customer_id: stripeCustomerId })
        .eq("id", accountId);
    }

    // ── Email add-on purchase ────────────────────────────────────────────────
    if (addonType === "email") {
      if (!EMAIL_ADDON_PRICE_ID) {
        return NextResponse.json(
          { error: "Email add-on price not configured." },
          { status: 400 },
        );
      }

      const session = await stripe.checkout.sessions.create({
        customer: stripeCustomerId,
        line_items: [{ price: EMAIL_ADDON_PRICE_ID, quantity: 1 }],
        mode: "subscription",
        success_url: `${new URL(request.url).origin}/settings?addon_success=email`,
        cancel_url: `${new URL(request.url).origin}/settings`,
        subscription_data: {
          metadata: { accountId, addonType: "email" },
        },
        metadata: { accountId, addonType: "email" },
      });

      return NextResponse.json({ url: session.url });
    }

    // ── Base plan purchase ───────────────────────────────────────────────────
    if (!priceId) return NextResponse.json({ error: "Price ID is required" }, { status: 400 });

    const centralPlanId = planId?.toUpperCase()
      .replace("FOUNDING_SINGLE_BUSINESS", "FOUNDING_SINGLE") ?? "SINGLE_BUSINESS";

    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "subscription",
      success_url: `${new URL(request.url).origin}/dashboard?checkout_success=true`,
      cancel_url: `${new URL(request.url).origin}/pricing?checkout_cancelled=true`,
      subscription_data: {
        metadata: { accountId, planId: centralPlanId },
      },
      metadata: { accountId, planId: centralPlanId },
    });

    return NextResponse.json({ url: session.url });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Checkout failed";
    console.error("Checkout error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
