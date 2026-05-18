/**
 * GET|POST /api/billing/expire-trials
 *
 * Vercel cron — runs daily at 02:00 UTC.
 * Finds accounts still marked 'trialing' whose trial_ends_at has passed
 * and flips their status to 'expired'. Without this job, trials would
 * never actually expire — users would keep full trial access indefinitely.
 *
 * Auth: CRON_SECRET header (same pattern as send-cycle).
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const GET = (req: NextRequest) => POST(req);

export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json({ ok: true, expired: 0, reason: "supabase_not_configured" });
  }

  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const now = new Date().toISOString();

  const { data, error } = await admin
    .from("zentra_accounts")
    .update({ status: "expired" })
    .eq("status", "trialing")
    .lt("trial_ends_at", now)
    .select("id");

  if (error) {
    console.error("[expire-trials]", error.message);
    return NextResponse.json({ ok: false, error: "Update failed." }, { status: 500 });
  }

  const count = data?.length ?? 0;
  if (count > 0) {
    console.log(`[expire-trials] Expired ${count} trial account(s)`);
  }

  return NextResponse.json({ ok: true, expired: count });
}
