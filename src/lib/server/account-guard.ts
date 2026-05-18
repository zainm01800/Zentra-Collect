/**
 * Shared auth + account status guard for AI API routes.
 * Returns { user, error } — if error is set, return it immediately.
 */

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const BLOCKED_STATUSES = new Set(["expired", "cancelled"]);

export async function requireActiveAccount(): Promise<
  | { user: { id: string }; error: null }
  | { user: null; error: ReturnType<typeof NextResponse.json> }
> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return {
      user: null,
      error: NextResponse.json({ error: "Unauthorised" }, { status: 401 }),
    };
  }

  // Check account status — block expired/cancelled accounts from consuming AI quota
  const { data: member } = await supabase
    .from("zentra_account_members")
    .select("zentra_accounts(status)")
    .eq("user_id", user.id)
    .maybeSingle();

  const raw = member?.zentra_accounts;
  const account = (Array.isArray(raw) ? raw[0] : raw) as { status?: string } | null;
  const status = account?.status ?? "active";

  if (BLOCKED_STATUSES.has(status)) {
    return {
      user: null,
      error: NextResponse.json(
        { error: "Your account has expired. Upgrade to continue using AI features." },
        { status: 403 },
      ),
    };
  }

  return { user, error: null };
}
