import { NextResponse } from "next/server";
import {
  createSupabaseServerClient,
  getSupabaseAdminClient,
  hasSupabaseAdminConfig,
  hasSupabaseServerConfig,
} from "@/lib/supabase/server";

/**
 * GET /api/auth/account-lookup
 *
 * Returns the caller's account info (plan_id, account_id) using the admin
 * client so RLS never blocks the read. Called by the login form after
 * sign-in to decide whether to go to /dashboard or /onboarding.
 *
 * Response:
 *   { found: true, accountId: string, planId: string }
 *   { found: false }
 */
export async function GET() {
  if (!hasSupabaseServerConfig()) {
    return NextResponse.json({ found: false });
  }

  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ found: false });

    // Use admin client to bypass RLS
    const db = hasSupabaseAdminConfig() ? getSupabaseAdminClient() : supabase;

    const { data: member } = await db
      .from("zentra_account_members")
      .select("account_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle<{ account_id: string }>();

    if (!member?.account_id) return NextResponse.json({ found: false });

    const { data: account } = await db
      .from("zentra_accounts")
      .select("plan_id, status")
      .eq("id", member.account_id)
      .maybeSingle<{ plan_id: string; status: string }>();

    return NextResponse.json({
      found: true,
      accountId: member.account_id,
      planId: account?.plan_id ?? "TRIAL",
      status: account?.status ?? "trialing",
    });
  } catch {
    return NextResponse.json({ found: false });
  }
}
