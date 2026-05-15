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
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError) {
      console.error("[auth/callback] exchangeCodeForSession failed:", exchangeError.message);
      return NextResponse.redirect(
        new URL(`/login?error=link_expired`, request.url),
      );
    }
  }

  // If the caller explicitly asked for a specific page, honour it.
  // e.g. password-reset emails include ?next=/reset-password
  if (next) {
    return NextResponse.redirect(new URL(next, request.url));
  }

  // Otherwise decide based on whether this user already has an account.
  // New users (no account row) → onboarding.
  // Returning users (account exists) → dashboard.
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.redirect(new URL("/login?error=session_missing", request.url));
  }

  const { data: member } = await supabase
    .from("zentra_account_members")
    .select("account_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (member) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.redirect(new URL("/onboarding", request.url));
}
