/**
 * /api/email/send-managed
 *
 * Sends a chase email via Resend (Zentra's managed delivery domain).
 * No SMTP credentials required from the user — emails are sent from
 * chase@zentracollect.co.uk with proper SPF/DKIM/DMARC.
 *
 * POST body:
 *   { to: string, subject: string, html: string, text: string, replyTo?: string }
 *
 * Requires: RESEND_API_KEY env var.
 * Falls back to a 501 error when key is not configured so callers can
 * degrade to SMTP.
 */

import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { requireActiveAccount } from "@/lib/server/account-guard";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const FROM_ADDRESS = process.env.RESEND_FROM_ADDRESS ?? "Zentra Collect <chase@zentracollect.co.uk>";

export async function POST(req: NextRequest) {
  // Auth guard — only authenticated active accounts can send managed emails
  const guard = await requireActiveAccount();
  if (guard.error) return guard.error;

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { ok: false, error: "Managed delivery not configured (RESEND_API_KEY missing)" },
      { status: 501 },
    );
  }

  let body: {
    to: string;
    subject: string;
    html: string;
    text?: string;
    replyTo?: string;
    /** Optional — stored in email_events for open tracking */
    invoiceId?: string;
    invoiceNumber?: string;
    customerName?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const { to, subject, html, text, replyTo: bodyReplyTo, invoiceId, invoiceNumber, customerName } = body;
  if (!to || !subject || !html) {
    return NextResponse.json({ ok: false, error: "Missing required fields: to, subject, html" }, { status: 400 });
  }

  // Look up the user's business reply-to email so replies land in their inbox
  // Priority: caller-supplied replyTo → business reply_to_email → contact_email → none
  let resolvedReplyTo = bodyReplyTo;
  if (!resolvedReplyTo && guard.user?.id) {
    const supabase = await createSupabaseServerClient();
    const { data: memberRow } = await supabase
      .from("zentra_account_members")
      .select("account_id")
      .eq("user_id", guard.user.id)
      .maybeSingle();
    if (memberRow?.account_id) {
      const { data: biz } = await supabase
        .from("zentra_businesses")
        .select("reply_to_email, contact_email")
        .eq("account_id", memberRow.account_id)
        .maybeSingle();
      resolvedReplyTo = biz?.reply_to_email || biz?.contact_email || undefined;
    }
  }

  try {
    const resend = new Resend(apiKey);
    const result = await resend.emails.send({
      from: FROM_ADDRESS,
      to: [to],
      subject,
      html,
      text: text ?? "",
      replyTo: resolvedReplyTo ? [resolvedReplyTo] : undefined,
    });

    if (result.error) {
      return NextResponse.json({ ok: false, error: result.error.message }, { status: 500 });
    }

    // Log email event for open/click tracking (fire-and-forget)
    // Re-use the memberRow already fetched above for reply-to lookup
    if (result.data?.id) {
      (async () => {
        try {
          const supabase = await createSupabaseServerClient();
          let accountId: string | undefined;
          if (guard.user?.id) {
            const { data: m } = await supabase
              .from("zentra_account_members")
              .select("account_id")
              .eq("user_id", guard.user.id)
              .maybeSingle();
            accountId = m?.account_id;
          }
          if (accountId) {
            await supabase.from("zentra_email_events").insert({
              account_id:      accountId,
              resend_email_id: result.data!.id,
              invoice_id:      invoiceId ?? null,
              invoice_number:  invoiceNumber ?? null,
              customer_name:   customerName ?? null,
              sent_at:         new Date().toISOString(),
            });
          }
        } catch { /* tracking is non-critical */ }
      })();
    }

    return NextResponse.json({ ok: true, messageId: result.data?.id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

/** Check whether managed delivery is available (key is configured). */
export async function GET() {
  const configured = Boolean(process.env.RESEND_API_KEY);
  return NextResponse.json({
    configured,
    fromAddress: configured ? FROM_ADDRESS : null,
  });
}
