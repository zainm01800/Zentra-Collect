"use server";

/**
 * Read email open/click events for the current account.
 *
 * Wired into the chase queue so the user can see "X opens / Y clicks
 * today" without leaving the page. The events themselves are written
 * by /api/track/open and /api/track/click — both already shipped.
 *
 * Returns null when Supabase isn't configured or the user isn't
 * signed in (demo path) — the caller treats null as "no data".
 */

import { createSupabaseServerClient, hasSupabaseServerConfig } from "@/lib/supabase/server";

export interface EmailEventSummary {
  /** Total open events in the last N hours. */
  opens:   number;
  /** Total click events in the last N hours. */
  clicks:  number;
  /** Distinct messageIds that had at least one open. */
  distinctMessages: number;
  /** The window used, in hours, for context in the UI. */
  windowHours: number;
}

export async function recentEmailEventSummary(
  windowHours = 24,
): Promise<EmailEventSummary | null> {
  if (!hasSupabaseServerConfig()) return null;

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Resolve the account_id from membership
  const { data: member } = await supabase
    .from("zentra_account_members")
    .select("account_id")
    .eq("user_id", user.id)
    .maybeSingle();
  const accountId = member?.account_id as string | undefined;
  if (!accountId) return null;

  const sinceIso = new Date(Date.now() - windowHours * 60 * 60 * 1000).toISOString();

  // Read events. zentra_email_events is RLS-protected: only members
  // of the account can SELECT their own rows.
  const { data, error } = await supabase
    .from("zentra_email_events")
    .select("event_type, message_id")
    .eq("account_id", accountId)
    .gte("created_at", sinceIso);

  if (error) {
    // Most likely cause: table doesn't exist yet in this deploy. Fail
    // soft so the chase queue still renders.
    console.warn("[recentEmailEventSummary] read failed:", error.message);
    return { opens: 0, clicks: 0, distinctMessages: 0, windowHours };
  }

  const rows = data ?? [];
  let opens = 0;
  let clicks = 0;
  const messageIds = new Set<string>();
  for (const r of rows) {
    if (r.event_type === "open")  { opens++;  messageIds.add(r.message_id as string); }
    if (r.event_type === "click") { clicks++; }
  }

  return {
    opens,
    clicks,
    distinctMessages: messageIds.size,
    windowHours,
  };
}
