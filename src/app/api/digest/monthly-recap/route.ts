/**
 * GET|POST /api/digest/monthly-recap
 *
 * Vercel cron — runs on the 1st of each month at 09:00 UK time.
 * Sends a one-screen monthly recap email to each active account that
 * has monthly_recap_emails = true (default true on signup).
 *
 * Computes stats for the previous calendar month from:
 *   - zentra_chase_outcomes (sent count, recovered total)
 *   - zentra_email_events (opens, clicks)
 *   - zentra_invoices (invoices added)
 *   - zentra_mileage_trips (miles, allowance)
 *
 * Auth: CRON_SECRET header (fail-closed — see comment in expire-trials).
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendTransactionalEmail } from "@/lib/transactional/resend";
import { monthlyRecapEmail, type MonthlyRecapStats } from "@/lib/transactional/templates";
import { calcMileageAllowance } from "@/lib/mileage";

export const GET = (req: NextRequest) => POST(req);

export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ ok: false, error: "Not configured" }, { status: 500 });
  }
  if (req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
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

  // Last month boundaries
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const monthEnd   = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(),     1));
  const monthLabel = monthStart.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  const startIso = monthStart.toISOString();
  const endIso   = monthEnd.toISOString();

  // Active accounts with recap opted in
  const { data: accounts, error: accErr } = await admin
    .from("zentra_accounts")
    .select("id, business_name, owner_email, monthly_recap_emails")
    .in("status", ["active", "trialing"])
    .neq("monthly_recap_emails", false);

  if (accErr) {
    console.error("[monthly-recap] account fetch failed:", accErr.message);
    return NextResponse.json({ ok: false, error: accErr.message }, { status: 500 });
  }

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const acc of accounts ?? []) {
    if (!acc.owner_email) { skipped++; continue; }
    try {
      const stats = await computeRecapStats(admin, acc.id as string, startIso, endIso, monthLabel);
      // Skip if there's literally nothing to report — don't spam empty accounts.
      const hasActivity = stats.chasesSent + stats.opens + stats.clicks + stats.invoicesAdded + stats.mileageMiles > 0;
      if (!hasActivity) { skipped++; continue; }

      const { subject, html, text } = monthlyRecapEmail({
        businessName: (acc.business_name as string) ?? "your business",
        stats,
      });
      await sendTransactionalEmail({
        to:      acc.owner_email as string,
        subject,
        html,
        text,
      });
      sent++;
    } catch (err) {
      console.error("[monthly-recap] account", acc.id, "failed:", err);
      failed++;
    }
  }

  return NextResponse.json({ ok: true, sent, skipped, failed, monthLabel });
}

interface AdminClient {
  from: (table: string) => {
    select: (cols: string) => {
      eq:  (col: string, val: string) => { gte: (col: string, val: string) => { lt: (col: string, val: string) => Promise<{ data: unknown[] | null }> } };
    };
  };
}

async function computeRecapStats(
  admin: ReturnType<typeof createClient>,
  accountId: string,
  startIso: string,
  endIso: string,
  monthLabel: string,
): Promise<MonthlyRecapStats> {
  // Chase outcomes — every send + recovered amount.
  const { data: outcomes } = await admin
    .from("zentra_chase_outcomes")
    .select("outcome, amount_recovered, created_at")
    .eq("account_id", accountId)
    .gte("created_at", startIso)
    .lt("created_at", endIso);

  const chasesSent = (outcomes ?? []).filter((o) => o.outcome === "sent" || o.outcome === "chased").length;
  const recovered  = (outcomes ?? []).reduce((s, o) => s + (Number(o.amount_recovered) || 0), 0);

  // Email events
  const { data: events } = await admin
    .from("zentra_email_events")
    .select("event_type, created_at")
    .eq("account_id", accountId)
    .gte("created_at", startIso)
    .lt("created_at", endIso);

  const opens  = (events ?? []).filter((e) => e.event_type === "open").length;
  const clicks = (events ?? []).filter((e) => e.event_type === "click").length;

  // Invoices added (by created_at)
  const { data: invs } = await admin
    .from("zentra_invoices")
    .select("id, created_at")
    .eq("account_id", accountId)
    .gte("created_at", startIso)
    .lt("created_at", endIso);
  const invoicesAdded = (invs ?? []).length;

  // Mileage
  const { data: trips } = await admin
    .from("zentra_mileage_trips")
    .select("miles, trip_date")
    .eq("account_id", accountId)
    .gte("trip_date", startIso.slice(0, 10))
    .lt("trip_date", endIso.slice(0, 10));
  const mileageMiles     = (trips ?? []).reduce((s, t) => s + Number(t.miles || 0), 0);
  const mileageAllowance = calcMileageAllowance(mileageMiles).allowance;

  return {
    monthLabel,
    chasesSent,
    recovered,
    opens,
    clicks,
    invoicesAdded,
    mileageMiles,
    mileageAllowance,
  };
}
