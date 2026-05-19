/**
 * POST /api/account/cancel-feedback
 *
 * Records why a user is considering cancellation. Three actions are
 * accepted:
 *   - "pause"  — they accepted the save offer (2 months at 50%)
 *   - "cancel" — they proceeded to the Stripe portal
 *   - "kept"   — they backed out before cancelling
 *
 * Used to inform retention work — e.g. if "missing_feature" dominates,
 * surface which feature; if "too_expensive" dominates, revisit pricing.
 *
 * Stored in zentra_cancel_feedback (create the table as part of
 * the next migration if it doesn't exist — the endpoint fails soft
 * when Supabase isn't configured so dev / demo flows still work).
 */

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, hasSupabaseServerConfig } from "@/lib/supabase/server";

type Action = "pause" | "cancel" | "kept";

export async function POST(req: NextRequest) {
  let body: { reason?: string; detail?: string; action?: Action };
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 }); }

  if (!body.reason || !body.action) {
    return NextResponse.json({ ok: false, error: "Missing reason or action" }, { status: 400 });
  }
  if (!["pause", "cancel", "kept"].includes(body.action)) {
    return NextResponse.json({ ok: false, error: "Invalid action" }, { status: 400 });
  }

  if (!hasSupabaseServerConfig()) {
    // Demo / unconfigured deploy — accept silently so the UI flow is unaffected.
    return NextResponse.json({ ok: true, persisted: false });
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });

    const { data: member } = await supabase
      .from("zentra_account_members")
      .select("account_id")
      .eq("user_id", user.id)
      .maybeSingle();
    const accountId = (member?.account_id as string | undefined) ?? null;
    if (!accountId) return NextResponse.json({ ok: false, error: "No account" }, { status: 404 });

    const { error } = await supabase
      .from("zentra_cancel_feedback")
      .insert({
        account_id: accountId,
        user_id:    user.id,
        reason:     body.reason,
        detail:     body.detail ?? null,
        action:     body.action,
      });

    if (error) {
      // Most likely cause: table doesn't exist yet in this deploy. Don't
      // block the user's flow — we just lose the analytics signal.
      console.warn("[cancel-feedback] insert failed:", error.message);
      return NextResponse.json({ ok: true, persisted: false });
    }
    return NextResponse.json({ ok: true, persisted: true });
  } catch (err) {
    console.warn("[cancel-feedback]", err);
    return NextResponse.json({ ok: true, persisted: false });
  }
}
