/**
 * POST /api/email/poll-inbox
 *
 * Called by cron-job.org every 5 minutes.
 * Loads all accounts with IMAP enabled, polls each inbox,
 * classifies any new replies, and stores results.
 *
 * Bearer token auth via CRON_SECRET env var.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { pollImapInbox } from "@/lib/inbound-email/imap-poller";
import { matchSenderToInvoice } from "@/lib/inbound-email/matcher";
import {
  classifyReplyWithRules,
  buildReplyClassificationPrompt,
} from "@/lib/ai/reply-classifier";

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  const secret = process.env.CRON_SECRET;
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  }

  const admin = getAdmin();
  if (!admin) {
    return NextResponse.json({ ok: true, skipped: "no_db" });
  }

  // Load all accounts with IMAP enabled
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: configs, error: configErr } = await (admin as any)
    .from("zentra_inbound_settings")
    .select("account_id, imap_email, imap_host, imap_port, imap_tls, imap_password_enc, imap_last_uid")
    .eq("imap_enabled", true);

  if (configErr || !configs?.length) {
    return NextResponse.json({ ok: true, processed: 0 });
  }

  let totalProcessed = 0;
  const errors: string[] = [];

  for (const cfg of configs) {
    try {
      const result = await pollImapInbox({
        email: cfg.imap_email,
        passwordEnc: cfg.imap_password_enc,
        host: cfg.imap_host,
        port: cfg.imap_port ?? 993,
        tls: cfg.imap_tls ?? true,
        lastUid: cfg.imap_last_uid ?? 0,
      });

      if (result.emails.length === 0) {
        // Update last_polled_at even when nothing new arrived
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (admin as any)
          .from("zentra_inbound_settings")
          .update({ imap_last_polled_at: new Date().toISOString() })
          .eq("account_id", cfg.account_id);
        continue;
      }

      // Load invoices for this account to attempt matching
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: invoices } = await (admin as any)
        .from("zentra_invoices")
        .select("id, customer_name, customer_email, invoice_number")
        .eq("account_id", cfg.account_id)
        .neq("status", "paid");

      const matchableInvoices = (invoices ?? []).map((inv: {
        id: string; customer_name: string; customer_email?: string; invoice_number?: string;
      }) => ({
        id: inv.id,
        customerName: inv.customer_name,
        customerEmail: inv.customer_email,
        invoiceNumber: inv.invoice_number,
      }));

      const replyRows = [];

      for (const email of result.emails) {
        // Classify with rules first (free, instant)
        const rulesResult = classifyReplyWithRules({ replyText: email.bodyText });

        // Try AI if unclear and keys are available
        let classification = rulesResult;
        if (rulesResult.classification === "unclear") {
          classification = await classifyWithAI(email.bodyText, cfg.account_id);
        }

        const match = matchSenderToInvoice(email.fromEmail, email.subject, matchableInvoices);

        replyRows.push({
          account_id: cfg.account_id,
          from_email: email.fromEmail,
          from_name: email.fromName,
          subject: email.subject,
          received_at: email.receivedAt.toISOString(),
          source: "imap",
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
      }

      if (replyRows.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (admin as any).from("zentra_inbound_replies").insert(replyRows);
      }

      // Update last polled UID
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (admin as any)
        .from("zentra_inbound_settings")
        .update({
          imap_last_uid: result.highestUid,
          imap_last_polled_at: new Date().toISOString(),
        })
        .eq("account_id", cfg.account_id);

      totalProcessed += replyRows.length;
    } catch (err) {
      console.error(`[poll-inbox] account ${cfg.account_id} failed:`, err);
      errors.push(cfg.account_id);
    }
  }

  return NextResponse.json({ ok: true, processed: totalProcessed, errors });
}

async function classifyWithAI(
  replyText: string,
  _accountId: string,
) {
  const prompt = buildReplyClassificationPrompt({ replyText });

  // Try Gemini first
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
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.1, responseMimeType: "application/json" },
          }),
        },
      );
      if (res.ok) {
        const json = await res.json();
        const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) return JSON.parse(text);
      }
    } catch { /* fall through */ }
  }

  // Fall back to rules
  return classifyReplyWithRules({ replyText });
}
