import { NextResponse, type NextRequest } from "next/server";
import {
  createSupabaseServerClient,
  hasSupabaseServerConfig,
} from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next");

  if (!hasSupabaseServerConfig()) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const supabase = await createSupabaseServerClient();

  if (code) {
    await supabase.auth.exchangeCodeForSession(code);
  }

  // If the caller explicitly asked for a specific page, honour it.
  if (next) {
    return NextResponse.redirect(new URL(next, request.url));
  }

  // Otherwise decide based on whether this user already has an account.
  // New users (no account row) → onboarding.
  // Returning users (account exists) → dashboard.
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    const { data: member } = await supabase
      .from("zentra_account_members")
      .select("account_id")
      .eq("user_id", user.id)
      .limit(1)
      .single();

    if (member) {
      // Returning user — check whether they've completed financial setup.
      // If the settings row doesn't exist yet, send them to onboarding so
      // Safe to Spend can be initialised before they hit the dashboard.
      const { data: settings } = await supabase
        .from("zentra_financial_settings")
        .select("id")
        .eq("account_id", member.account_id)
        .maybeSingle();

      if (settings) {
        return NextResponse.redirect(new URL("/dashboard", request.url));
      }

      // Has an account but no financial settings → run them through setup.
      return NextResponse.redirect(new URL("/onboarding", request.url));
    }
  }

  // No account found — send to onboarding (will prompt them to set up).
  return NextResponse.redirect(new URL("/onboarding", request.url));
}
