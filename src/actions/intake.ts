"use server";

/**
 * src/actions/intake.ts
 *
 * Server actions for the client data intake flow.
 * Bookkeepers call createIntakeToken() to get a shareable upload URL
 * for a specific client ledger.
 */

import {
  createSupabaseServerClient,
  hasSupabaseServerConfig,
} from "@/lib/supabase/server";

// ── createIntakeToken ─────────────────────────────────────────────────────────

export interface CreateIntakeTokenResult {
  url?:   string;
  error?: string;
}

/**
 * Creates a 30-day intake token for a client and returns the full URL
 * the bookkeeper can share with their client.
 */
export async function createIntakeToken(
  clientId:   string,
  clientName: string,
): Promise<CreateIntakeTokenResult> {
  if (!hasSupabaseServerConfig()) {
    return { error: "Database not configured" };
  }

  const supabase = await createSupabaseServerClient();

  // Get the authenticated user + their account
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: member } = await supabase
    .from("zentra_account_members")
    .select("account_id")
    .eq("user_id", user.id)
    .single();

  if (!member) return { error: "No account found" };

  // Get bookkeeper name from the user profile (email username as fallback)
  const bookkeeperName = user.user_metadata?.full_name
    ?? user.email?.split("@")[0]
    ?? "Your bookkeeper";

  // Insert the token — Supabase generates a unique `token` via default expression
  const { data: row, error } = await supabase
    .from("zentra_intake_tokens")
    .insert({
      account_id:      member.account_id,
      client_id:       clientId,
      client_name:     clientName,
      bookkeeper_name: bookkeeperName,
    })
    .select("token")
    .single();

  if (error || !row?.token) {
    console.error("[createIntakeToken] insert failed:", error);
    return { error: "Could not generate link. Please try again." };
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://zentracollect.co.uk";
  return { url: `${baseUrl}/intake/${row.token}` };
}
