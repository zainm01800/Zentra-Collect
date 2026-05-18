/**
 * POST /api/webhooks/inbound-email
 *
 * Receives forwarded/inbound emails from Resend or Postmark inbound parse.
 * The user sets up a Gmail filter to forward replies to their unique
 * reply-{token}@in.zentracollect.co.uk address. Resend delivers the parsed
 * email here as a JSON POST.
 *
 * Resend inbound format: https://resend.com/docs/api-reference/inbound/overview
 * Postmark inbound format: https://postmarkapp.com/developer/webhooks/inbound-webhook
 *
 * Both providers are handled — the route detects which one sent the payload.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { extractTokenFromAddress, verifyWebhookSignature } from "@/lib/inbound-email/address";
import { matchSenderToInvoice } from "@/lib/inbound-email/matcher";
import { classifyReplyWithRules, buildReplyClassificationPrompt } from "@/lib/ai/reply-classifier";

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  // Verify webhook signature if configured
  const sig = req.headers.get("x-webhook-signature") ?? req.headers.get("x-postmark-signature") ?? "";
  if (!verifyWebhookSignature(rawBody, sig)) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  // ── Parse payload — handle Resend and Postmark formats ─────────────────────

  let fromEmail = "";
  let fromName = "";
  let toAddress = "";
  let subject = "";
  let bodyText = "";

  // Resend inbound format
  if (payload.from && typeof payload.from === "object") {
    const from = payload.from as { email?: string; name?: string };
    fromEmail = from.email ?? "";
    fromName = from.name ?? from.email ?? "";
    const to = (payload.to as Array<{ email?: string }>)?.[0];
    toAddress = to?.email ?? "";
    subject = (payload.subject as string) ?? "";
    bodyText = ((payload.text as string) ?? (payload.html as string) ?? "").slice(0, 2000);
  }
  // Postmark inbound format
  else if (payload.FromFull) {
    const from = payload.FromFull as { Email?: string; Name?: string };
    fromEmail = from.Email ?? "";
    fromName = from.Name ?? from.Email ?? "";
    const to = (payload.ToFull as Array<{ Email?: string }>)?.[0];
    toAddress = to?.Email ?? "";
    subject = (payload.Subject as string) ?? "";
    bodyText = ((payload.TextBody as string) ?? (payload.HtmlBody as string) ?? "").slice(0, 2000);
  }

  if (!fromEmail || !toAddress) {
    return NextResponse.json({ error: "Missing from/to." }, { status: 400 });
  }

  // ── Resolve account from inbound token ────────────────────────────────────

  const token = extractTokenFromAddress(toAddress);
  if (!token) {
    return NextResponse.json({ error: "Unrecognised destination address." }, { status: 400 });
  }

  const admin = getAdmin();
  if (!admin) {
    return NextResponse.json({ ok: true, note: "No DB — cannot store reply." });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: settings } = await (admin as any)
    .from("zentra_inbound_settings")
    .select("account_id, forward_enabled")
    .eq("inbound_token", token)
    .maybeSingle();

  if (!settings || !settings.forward_enabled) {
    return NextResponse.json({ error: "Unknown or disabled inbound address." }, { status: 404 });
  }

  const accountId = settings.account_id;

  // ── Classify the reply ─────────────────────────────────────────────────────

  let classification = classifyReplyWithRules({ replyText: bodyText });

  if (classification.classification === "unclear") {
    const geminiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (geminiKey) {
      try {
        const model = process.env.GEMINI_MODEL ?? "gemini-1.5-flash";
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ role: "user", parts: [{ text: buildReplyClassificationPrompt({ replyText: bodyText }) }] }],
              generationConfig: { temperature: 0.1, responseMimeType: "application/json" },
            }),
          },
        );
        if (res.ok) {
          const json = await res.json();
          const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) classification = JSON.parse(text);
        }
      } catch { /* fall through to rules result */ }
    }
  }

  // ── Match to invoice ───────────────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: invoices } = await (admin as any)
    .from("zentra_invoices")
    .select("id, customer_name, customer_email, invoice_number")
    .eq("account_id", accountId)
    .neq("status", "paid");

  const matchableInvoices = (invoices ?? []).map((inv: {
    id: string; customer_name: string; customer_email?: string; invoice_number?: string;
  }) => ({
    id: inv.id,
    customerName: inv.customer_name,
    customerEmail: inv.customer_email,
    invoiceNumber: inv.invoice_number,
  }));

  const match = matchSenderToInvoice(fromEmail, subject, matchableInvoices);

  // ── Store result ───────────────────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin as any).from("zentra_inbound_replies").insert({
    account_id: accountId,
    from_email: fromEmail,
    from_name: fromName,
    subject,
    source: "webhook",
    matched_invoice_id:    match.method !== "unmatched" ? match.invoiceId    : null,
    matched_customer_name: match.method !== "unmatched" ? match.customerName : null,
    match_method: match.method,
    classification: classification.classification,
    confidence: classification.confidence,
    reason: classification.reason,
    suggested_next_action: classification.suggestedNextAction,
    suggested_status_update: classification.suggestedStatusUpdate,
    extracted_promise_date:   classification.extractedPromiseDate   ?? null,
    extracted_promise_amount: classification.extractedPromiseAmount ?? null,
    extracted_dispute_reason: classification.extractedDisputeReason ?? null,
    requires_manual_review: classification.requiresManualReview,
    classifier_source: classification.source,
  });

  return NextResponse.json({ ok: true });
}
