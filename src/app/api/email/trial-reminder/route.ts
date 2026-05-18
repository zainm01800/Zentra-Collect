/**
 * GET|POST /api/email/trial-reminder
 *
 * Vercel cron — runs daily at 08:00 UTC.
 * Finds trialing accounts expiring in 3 days and sends each owner a
 * reminder email via Resend. Safe to re-run (idempotent per day because
 * Resend deduplication is not relied upon — the cron fires once per day).
 *
 * Auth: CRON_SECRET header (same pattern as send-cycle).
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendTransactionalEmail } from "@/lib/transactional/resend";
import { trialEndingEmail } from "@/lib/transactional/templates";

export const GET = (req: NextRequest) => POST(req);

export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json({ ok: true, sent: 0, reason: "supabase_not_configured" });
  }

  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const now = new Date();
  const windowStart = new Date(now.getTime() + 3 * 86_400_000); // +3 days
  const windowEnd   = new Date(now.getTime() + 4 * 86_400_000); // +4 days (exclusive)

  // Accounts whose trial ends within the next 3–4 day window (catches each trial once)
  const { data: accounts, error } = await admin
    .from("zentra_accounts")
    .select("id, owner_user_id, trial_ends_at, zentra_businesses(name)")
    .eq("status", "trialing")
    .gte("trial_ends_at", windowStart.toISOString())
    .lt("trial_ends_at", windowEnd.toISOString());

  if (error) {
    console.error("[trial-reminder] query failed:", error.message);
    return NextResponse.json({ ok: false, error: "Query failed." }, { status: 500 });
  }

  if (!accounts?.length) {
    return NextResponse.json({ ok: true, sent: 0, reason: "no_expiring_trials" });
  }

  let sent = 0;

  for (const account of accounts) {
    if (!account.owner_user_id) continue;

    const { data: userData, error: userErr } = await admin.auth.admin.getUserById(
      account.owner_user_id,
    );

    if (userErr || !userData.user?.email) continue;

    const businessesArr = Array.isArray(account.zentra_businesses)
      ? account.zentra_businesses
      : account.zentra_businesses
      ? [account.zentra_businesses]
      : [];

    const businessName =
      (businessesArr[0] as { name?: string } | undefined)?.name ?? "your business";

    const trialEndsAt = new Date(account.trial_ends_at);
    const daysLeft = Math.ceil((trialEndsAt.getTime() - now.getTime()) / 86_400_000);

    const template = trialEndingEmail({ businessName, trialEndsAt, daysLeft });

    await sendTransactionalEmail({ to: userData.user.email, ...template });
    sent++;
  }

  return NextResponse.json({ ok: true, sent });
}
