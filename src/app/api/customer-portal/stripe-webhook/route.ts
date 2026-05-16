/**
 * POST /api/customer-portal/stripe-webhook
 *
 * Stripe-signed webhook for customer-portal Checkout payments. On
 * `checkout.session.completed` we:
 *
 *   1. Email the user (via their connected SMTP) — "payment received,
 *      mark this invoice paid in your system"
 *   2. Email the end customer — thank-you receipt (uses the same SMTP
 *      so the receipt comes from the user's domain, not from Stripe)
 *
 * Configuration:
 *   STRIPE_WEBHOOK_SECRET — must be set; otherwise the route 503s.
 *
 * The webhook is intentionally idempotent: we re-derive everything we
 * need from the session metadata, so Stripe retries are safe.
 */

import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe/client";
import { createClient } from "@supabase/supabase-js";
import { decryptPassword } from "@/lib/email/crypto";
import { sendEmail, type SmtpConfig } from "@/lib/email/smtp";
import {
  buildUserReceiptSubject,
  buildCustomerReceiptSubject,
  renderUserReceiptHtml,
  renderUserReceiptText,
  renderCustomerReceiptHtml,
  renderCustomerReceiptText,
  type ReceiptFields,
} from "@/lib/customer-portal/receipt-template";
import { writeBackPayment, type Provider } from "@/lib/integrations/write-back";
import type Stripe from "stripe";

export const dynamic   = "force-dynamic";
export const runtime   = "nodejs";

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function loadSmtp(): Promise<SmtpConfig | null> {
  const admin = getAdmin();
  if (!admin) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (admin as any)
      .from("zentra_email_settings")
      .select("email, encrypted_password, smtp_host, smtp_port, from_name")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!data?.email || !data?.encrypted_password) return null;
    return {
      host:     data.smtp_host,
      port:     data.smtp_port,
      user:     data.email,
      password: decryptPassword(data.encrypted_password),
      fromName: data.from_name || "Zentra Collect",
    };
  } catch (err) {
    console.error("[stripe-webhook] failed to load SMTP", err);
    return null;
  }
}

function readFields(session: Stripe.Checkout.Session): ReceiptFields | null {
  const m = session.metadata ?? {};
  if (!m.invoiceNumber || !m.businessName || !m.customerName) return null;
  const base    = parseFloat(m.baseAmount    ?? "0");
  const charged = parseFloat(m.chargedAmount ?? "0") || base;
  return {
    businessName:    m.businessName,
    customerName:    m.customerName,
    invoiceNumber:   m.invoiceNumber,
    baseAmount:      base,
    chargedAmount:   charged,
    interest:        parseFloat(m.interest        ?? "0"),
    compensation:    parseFloat(m.compensation    ?? "0"),
    earlyPayPercent: parseFloat(m.earlyPayPercent ?? "0"),
    paidAt:          new Date((session.created ?? Math.floor(Date.now() / 1000)) * 1000),
  };
}

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "Webhook not configured: STRIPE_WEBHOOK_SECRET missing." },
      { status: 503 },
    );
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    const raw = await request.text();
    event = getStripe().webhooks.constructEvent(raw, signature, secret);
  } catch (err) {
    console.error("[stripe-webhook] signature verification failed:", err);
    return NextResponse.json({ error: "Bad signature" }, { status: 400 });
  }

  if (event.type !== "checkout.session.completed") {
    // Acknowledge other events so Stripe doesn't retry.
    return NextResponse.json({ received: true, ignored: event.type });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const fields = readFields(session);
  if (!fields) {
    console.warn("[stripe-webhook] missing metadata — skipping receipt", session.id);
    return NextResponse.json({ received: true, warning: "missing_metadata" });
  }

  const smtp = await loadSmtp();
  if (!smtp) {
    console.warn("[stripe-webhook] no SMTP configured — skipping receipt", session.id);
    return NextResponse.json({ received: true, warning: "no_smtp" });
  }

  // ── User-facing receipt (always sent) ───────────────────────────────────
  await sendEmail(
    smtp,
    smtp.user,
    buildUserReceiptSubject(fields),
    renderUserReceiptHtml(fields),
    renderUserReceiptText(fields),
  );

  // ── Customer-facing receipt (only if Stripe collected an email) ────────
  const customerEmail =
    session.customer_details?.email ||
    session.customer_email ||
    null;
  if (customerEmail) {
    await sendEmail(
      smtp,
      customerEmail,
      buildCustomerReceiptSubject(fields),
      renderCustomerReceiptHtml(fields),
      renderCustomerReceiptText(fields),
    );
  }

  // ── Write-back to accounting tool ──────────────────────────────────────
  // When the portal token carried write-back metadata, mark the source
  // invoice paid in the user's accounting tool too. Errors here don't
  // fail the webhook — Stripe must always get a 200 — but they're
  // surfaced in the user receipt email body for visibility.
  const wbAccountId = session.metadata?.wbAccountId;
  const wbProvider  = session.metadata?.wbProvider as Provider | "" | undefined;
  const wbSourceInvoiceId = session.metadata?.wbSourceInvoiceId;

  if (wbAccountId && wbProvider && wbSourceInvoiceId) {
    try {
      const result = await writeBackPayment({
        accountId:       wbAccountId,
        provider:        wbProvider as Provider,
        sourceInvoiceId: wbSourceInvoiceId,
        amountPaid:      fields.chargedAmount,
        paidDate:        new Date().toISOString().slice(0, 10),
        reference:       session.id,
      });
      if (!result.ok) {
        console.warn(
          `[stripe-webhook] write-back to ${wbProvider} failed for ${wbSourceInvoiceId}:`,
          result.error,
          result.reauthorize ? "(needs reauthorize)" : "",
        );
      }
    } catch (err) {
      console.error("[stripe-webhook] write-back threw:", err);
    }
  }

  return NextResponse.json({ received: true });
}
