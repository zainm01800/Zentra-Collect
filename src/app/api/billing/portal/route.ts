import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe/client";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: memberData } = await supabase
      .from("zentra_account_members")
      .select("account_id, zentra_accounts(stripe_customer_id)")
      .eq("user_id", user.id)
      .single();

    if (!memberData) {
      return NextResponse.json({ error: "Account not found." }, { status: 404 });
    }

    const acc = (
      Array.isArray(memberData.zentra_accounts)
        ? memberData.zentra_accounts[0]
        : memberData.zentra_accounts
    ) as Record<string, unknown> | null;

    const stripeCustomerId = acc?.stripe_customer_id as string | undefined;

    if (!stripeCustomerId) {
      return NextResponse.json(
        { error: "No Stripe billing account found. Contact support to manage your subscription." },
        { status: 400 },
      );
    }

    const origin = new URL(request.url).origin;
    const session = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${origin}/settings`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Portal session failed.";
    console.error("[billing/portal]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
