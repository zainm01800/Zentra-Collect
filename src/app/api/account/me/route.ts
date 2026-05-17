import { NextResponse } from "next/server";
import { createSupabaseServerClient, hasSupabaseServerConfig } from "@/lib/supabase/server";
import type { PlanId, AccountType, SubscriptionStatus } from "@/lib/billing/plans";

// Maps central SCREAMING_SNAKE_CASE plan IDs (stored in DB) to legacy snake_case
// used by DemoUser / useLocalAccount throughout the UI.
const centralToLegacyPlan: Record<string, PlanId> = {
  DEMO: "demo",
  TRIAL: "trial",
  TRADER: "trader",
  FREELANCE: "freelance",
  STARTER_SOLO: "starter_solo",
  // Legacy founding plans — map to their equivalent non-founding plans
  FOUNDING_SINGLE: "single_business",
  FOUNDING_BOOKKEEPER: "bookkeeper_starter",
  SINGLE_BUSINESS: "single_business",
  BOOKKEEPER_STARTER: "bookkeeper_starter",
  BOOKKEEPER_PRO: "bookkeeper_pro",
};

const centralToAccountType: Record<string, AccountType> = {
  DEMO: "demo",
  TRIAL: "trial",
  TRADER: "paid",
  FREELANCE: "paid",
  STARTER_SOLO: "paid",
  FOUNDING_SINGLE: "paid",
  FOUNDING_BOOKKEEPER: "paid",
  SINGLE_BUSINESS: "paid",
  BOOKKEEPER_STARTER: "paid",
  BOOKKEEPER_PRO: "paid",
};

export async function GET() {
  if (!hasSupabaseServerConfig()) {
    return NextResponse.json({ authenticated: false, reason: "supabase_not_configured" });
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ authenticated: false, reason: "no_session" });
    }

    // Fetch account + first business name in one go
    const { data: member, error: memberError } = await supabase
      .from("zentra_account_members")
      .select("account_id, zentra_accounts(*)")
      .eq("user_id", user.id)
      .single();

    if (memberError || !member) {
      return NextResponse.json({ authenticated: true, hasAccount: false });
    }

    // zentra_accounts(*) from a join can come back as array or object depending on cardinality
    const raw = member.zentra_accounts;
    const account = (Array.isArray(raw) ? raw[0] : raw) as Record<string, unknown>;

    const { data: business } = await supabase
      .from("zentra_businesses")
      .select("name")
      .eq("account_id", member.account_id)
      .limit(1)
      .single();

    const centralPlanId = String(account.plan_id ?? "DEMO");
    const legacyPlanId: PlanId = centralToLegacyPlan[centralPlanId] ?? "demo";
    const accountType: AccountType = centralToAccountType[centralPlanId] ?? "demo";
    const status = String(account.status ?? "demo") as SubscriptionStatus;

    const trialEndsAt = account.trial_ends_at ? String(account.trial_ends_at) : undefined;
    const graceEndsAt = account.grace_period_ends_at ? String(account.grace_period_ends_at) : undefined;

    // expiresAt: for trials use trialEndsAt; for paid accounts use far future
    const expiresAt = trialEndsAt ?? new Date(Date.now() + 3650 * 24 * 60 * 60 * 1000).toISOString();

    return NextResponse.json({
      authenticated: true,
      hasAccount: true,
      account: {
        name: String(user.user_metadata?.name ?? user.email ?? ""),
        email: user.email ?? "",
        businessName: business?.name ?? "",
        accountType,
        planId: legacyPlanId,
        subscriptionStatus: status,
        createdAt: String(account.created_at ?? new Date().toISOString()),
        expiresAt,
        trialEndsAt,
        graceEndsAt,
        emailAddon: account.email_addon === true,
      },
    });
  } catch (err) {
    console.error("[account/me]", err);
    return NextResponse.json({ authenticated: false, reason: "error" }, { status: 500 });
  }
}
