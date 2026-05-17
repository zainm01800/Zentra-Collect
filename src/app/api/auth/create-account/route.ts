import { NextRequest, NextResponse } from "next/server";
import {
  createSupabaseServerClient,
  hasSupabaseServerConfig,
} from "@/lib/supabase/server";

/**
 * POST /api/auth/create-account
 *
 * Called after OTP verification to create the zentra_accounts and
 * zentra_account_members rows for a new user. Idempotent — safe to call
 * again if rows already exist (returns the existing account ID).
 *
 * Body: { businessName?: string; planId?: string }
 */
export async function POST(req: NextRequest) {
  if (!hasSupabaseServerConfig()) {
    return NextResponse.json({ ok: true, accountId: null, note: "no-supabase" });
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const businessName: string = body.businessName ?? "My Business";
    const planId: string = body.planId ?? "TRIAL";

    // Check if an account already exists for this user
    const { data: existing } = await supabase
      .from("zentra_account_members")
      .select("account_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ ok: true, accountId: existing.account_id, created: false });
    }

    // Map the frontend plan IDs (lowercase) to the DB enum values (uppercase)
    const planMap: Record<string, string> = {
      trial: "TRIAL",
      demo: "DEMO",
      single_business: "SINGLE_BUSINESS",
      starter_solo: "SINGLE_BUSINESS",
      bookkeeper: "BOOKKEEPER_STARTER",
      bookkeeper_pro: "BOOKKEEPER_PRO",
      founding: "FOUNDING_SINGLE",
    };
    const dbPlanId = planMap[planId.toLowerCase()] ?? "TRIAL";

    const now = new Date();
    const trialEndsAt = new Date(now);
    trialEndsAt.setDate(trialEndsAt.getDate() + 14);
    const graceEndsAt = new Date(trialEndsAt);
    graceEndsAt.setDate(graceEndsAt.getDate() + 30);

    // Create the account row using service role (bypasses RLS for the insert)
    const { createClient } = await import("@supabase/supabase-js");
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    const { data: account, error: accountError } = await admin
      .from("zentra_accounts")
      .insert({
        owner_user_id: user.id,
        plan_id: dbPlanId,
        status: "trialing",
        trial_started_at: now.toISOString(),
        trial_ends_at: trialEndsAt.toISOString(),
        grace_period_ends_at: graceEndsAt.toISOString(),
        current_period_started_at: now.toISOString(),
      })
      .select("id")
      .single();

    if (accountError || !account) {
      console.error("[create-account] account insert failed:", accountError?.message);
      return NextResponse.json(
        { ok: false, error: "Failed to create account." },
        { status: 500 },
      );
    }

    // Add owner membership
    await admin.from("zentra_account_members").insert({
      account_id: account.id,
      user_id: user.id,
      role: "owner",
    });

    // Create the business row
    await admin.from("zentra_businesses").insert({
      account_id: account.id,
      name: businessName,
      business_type: "service_business",
    });

    return NextResponse.json({ ok: true, accountId: account.id, created: true });
  } catch (err) {
    console.error("[create-account] unexpected error:", err);
    return NextResponse.json(
      { ok: false, error: "Unexpected error creating account." },
      { status: 500 },
    );
  }
}
