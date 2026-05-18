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

    let accountId: string;
    let stripeCustomerIdFromAccount: string | undefined;

    if (!memberData) {
      // Authenticated user has no zentra_accounts row — create one so checkout
      // can proceed. This happens when someone signs up via the auth form but
      // hasn't completed onboarding, or is upgrading from a localStorage trial.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: newAccount, error: createErr } = await (supabase as any)
        .from("zentra_accounts")
        .insert({
          plan_id: "TRIAL",
          status: "trialing",
          trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
          business_name: user.user_metadata?.business_name ?? null,
        })
        .select("id")
        .single();
      if (createErr || !newAccount) {
        return NextResponse.json({ error: "Failed to create account" }, { status: 500 });
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from("zentra_account_members").insert({
        account_id: newAccount.id,
        user_id: user.id,
        role: "owner",
      });
      accountId = newAccount.id;
      stripeCustomerIdFromAccount = undefined;
    } else {
      accountId = memberData.account_id;
      const acc = (Array.isArray(memberData.zentra_accounts)
        ? memberData.zentra_accounts[0]
        : memberData.zentra_accounts) as Record<string, unknown>;
      stripeCustomerIdFromAccount = acc?.stripe_customer_id as string | undefined;
    }
    let stripeCustomerId = stripeCustomerIdFromAccount;
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
      .replace("FOUNDING_SINGLE_BUSINESS", "SINGLE_BUSINESS")
      .replace("FOUNDING_BOOKKEEPER", "BOOKKEEPER_STARTER") ?? "SINGLE_BUSINESS";

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
    console.error("[billing/checkout]", err);
    return NextResponse.json({ error: "Checkout session could not be created." }, { status: 500 });
  }
}
