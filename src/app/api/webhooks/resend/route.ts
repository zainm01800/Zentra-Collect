/**
 * POST /api/webhooks/resend
 *
 * Receives email lifecycle events from Resend (email.opened, email.clicked).
 * Updates zentra_email_events to surface read receipts in the customer timeline.
 *
 * Resend uses Svix for webhook delivery. Signature is in the svix-* headers.
 * Set RESEND_WEBHOOK_SECRET in Vercel from the Resend dashboard → Webhooks.
 */

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.text();

  // Verify Svix signature if secret is configured
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (secret) {
    const svixId        = req.headers.get("svix-id");
    const svixTimestamp = req.headers.get("svix-timestamp");
    const svixSignature = req.headers.get("svix-signature");

    if (!svixId || !svixTimestamp || !svixSignature) {
      return NextResponse.json({ error: "Missing svix headers" }, { status: 400 });
    }

    try {
      const { Webhook } = await import("svix");
      const wh = new Webhook(secret);
      wh.verify(body, {
        "svix-id":        svixId,
        "svix-timestamp": svixTimestamp,
        "svix-signature": svixSignature,
      });
    } catch {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  let event: { type: string; data: { email_id?: string; created_at?: string } };
  try {
    event = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const emailId = event.data?.email_id;
  if (!emailId) {
    return NextResponse.json({ ok: true, skipped: "no email_id" });
  }

  const supabase = await createSupabaseServerClient();

  if (event.type === "email.opened") {
    await supabase
      .from("zentra_email_events")
      .update({ opened_at: new Date().toISOString() })
      .eq("resend_email_id", emailId)
      .is("opened_at", null); // only set on first open
  } else if (event.type === "email.clicked") {
    // Increment click count using a read-modify-write (Supabase doesn't support atomic increment via REST without RPC)
    const { data: row } = await supabase
      .from("zentra_email_events")
      .select("click_count")
      .eq("resend_email_id", emailId)
      .maybeSingle();

    if (row) {
      await supabase
        .from("zentra_email_events")
        .update({ click_count: (row.click_count ?? 0) + 1 })
        .eq("resend_email_id", emailId);
    }
  }

  return NextResponse.json({ ok: true });
}
