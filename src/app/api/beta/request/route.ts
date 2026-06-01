// TODO: Add rate limiting (e.g. 1 submission per email per 24 hours) before
//   public launch. A simple in-memory map keyed on IP/email is enough for
//   early access; use Upstash Redis for distributed rate limiting on Vercel.
//
// TODO: Send a notification email to the ops team on each submission.
// TODO: Send a confirmation email to the applicant.
// TODO: Replace the in-memory store with Supabase (see src/lib/beta/store.ts).

import { NextResponse } from "next/server";
import {
  addBetaRequest,
  type AccountingSoftware,
  type ArPain,
  type BetaRequest,
  type WouldPay,
} from "@/lib/beta/store";
import { getSupabaseAdminClient, hasSupabaseAdminConfig } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/server/rate-limit";

type RequestBody = Omit<BetaRequest, "id" | "submittedAt">;

const ACCOUNTING_SOFTWARE_VALUES: AccountingSoftware[] = [
  "Xero",
  "QuickBooks",
  "FreeAgent",
  "Sage",
  "Stripe",
  "Excel / other",
];

const AR_PAIN_VALUES: ArPain[] = [
  "Overdue invoices",
  "Missed promises",
  "Disputes",
  "Remittance matching",
  "Statement requests",
  "Messy client files",
  "Not enough time",
];

const WOULD_PAY_VALUES: WouldPay[] = ["yes", "no", "maybe"];

const INVOICES_PER_MONTH_VALUES = [
  "Under 20",
  "20–50",
  "50–150",
  "150–500",
  "500+",
];

const LEDGER_VALUES = [
  "Just my own business",
  "2–5 clients",
  "6–10 clients",
  "11–25 clients",
  "26–50 clients",
  "50+ clients",
];

export async function POST(request: Request) {
  // ── IP-based rate limit: 5 requests per hour per IP ──────────────────────
  const ipLimit = checkRateLimit(request, {
    namespace: "beta-request-ip",
    limit: 5,
    windowMs: 60 * 60_000,
  });
  if (!ipLimit.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 },
    );
  }

  let body: RequestBody;

  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON request body." },
      { status: 400 },
    );
  }

  // ── Required field validation ─────────────────────────────────────────────

  if (!body.name?.trim()) {
    return NextResponse.json({ error: "Name is required." }, { status: 400 });
  }
  if (!body.email?.trim()) {
    return NextResponse.json({ error: "Email is required." }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())) {
    return NextResponse.json(
      { error: "Please enter a valid email address." },
      { status: 400 },
    );
  }
  if (!body.businessName?.trim()) {
    return NextResponse.json(
      { error: "Business name is required." },
      { status: 400 },
    );
  }
  if (typeof body.isBookkeeper !== "boolean") {
    return NextResponse.json(
      { error: "Please indicate whether you are a bookkeeper or accountant." },
      { status: 400 },
    );
  }

  // ── Enum validation ───────────────────────────────────────────────────────

  if (
    body.isBookkeeper &&
    body.clientLedgersManaged &&
    !LEDGER_VALUES.includes(body.clientLedgersManaged)
  ) {
    return NextResponse.json(
      { error: "Invalid client ledger value." },
      { status: 400 },
    );
  }

  if (
    Array.isArray(body.accountingSoftware) &&
    body.accountingSoftware.some(
      (s) => !ACCOUNTING_SOFTWARE_VALUES.includes(s),
    )
  ) {
    return NextResponse.json(
      { error: "Invalid accounting software selection." },
      { status: 400 },
    );
  }

  if (
    body.approximateInvoicesPerMonth &&
    !INVOICES_PER_MONTH_VALUES.includes(body.approximateInvoicesPerMonth)
  ) {
    return NextResponse.json(
      { error: "Invalid invoices per month value." },
      { status: 400 },
    );
  }

  if (
    Array.isArray(body.biggestArPain) &&
    body.biggestArPain.some((p) => !AR_PAIN_VALUES.includes(p))
  ) {
    return NextResponse.json(
      { error: "Invalid AR pain selection." },
      { status: 400 },
    );
  }

  if (body.wouldPayFoundingPricing && !WOULD_PAY_VALUES.includes(body.wouldPayFoundingPricing)) {
    return NextResponse.json(
      { error: "Invalid pricing response." },
      { status: 400 },
    );
  }

  // ── Email deduplication (1 submission per email per 24 h) ────────────────

  const normalisedEmail = body.email.trim().toLowerCase();

  // Use the service-role client: zentra_beta_access_requests is a write-only
  // public inbox locked down by RLS (migration 0037), so the public can't read
  // other people's requests. The admin client bypasses RLS for dedup + insert.
  if (hasSupabaseAdminConfig()) {
    try {
      const supabase = getSupabaseAdminClient();
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: existing } = await supabase
        .from("zentra_beta_access_requests")
        .select("id")
        .eq("email", normalisedEmail)
        .gte("created_at", since)
        .limit(1)
        .maybeSingle();

      if (existing) {
        return NextResponse.json(
          { success: true, duplicate: true, message: "We already have your details — we'll be in touch soon." },
          { status: 200 },
        );
      }
    } catch {
      // Non-fatal — proceed without dedup if the check fails
    }
  }

  // ── Store ─────────────────────────────────────────────────────────────────

  let entryId = `beta-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  if (hasSupabaseAdminConfig()) {
    try {
      const supabase = getSupabaseAdminClient();
      const { data, error } = await supabase.from('zentra_beta_access_requests').insert({
        name: body.name.trim(),
        email: body.email.trim().toLowerCase(),
        business_name: body.businessName.trim(),
        is_bookkeeper: body.isBookkeeper,
        client_ledgers_managed: body.clientLedgersManaged ? parseInt(body.clientLedgersManaged.split('-')[0]) : null,
        accounting_software: Array.isArray(body.accountingSoftware) ? body.accountingSoftware.join(', ') : '',
        approximate_invoices_per_month: body.approximateInvoicesPerMonth ?? "",
        biggest_ar_pain: Array.isArray(body.biggestArPain) ? body.biggestArPain.join(', ') : '',
        would_upload_sample_file: Boolean(body.wouldUploadSampleFile),
        would_pay_founding_pricing: body.wouldPayFoundingPricing ?? "maybe",
        optional_message: body.message?.trim() ?? "",
      }).select('id').single();
      
      if (error) throw error;
      entryId = data.id;
    } catch (err) {
      console.error("Failed to insert beta request into Supabase:", err);
      // Fallback to local store if DB fails during early testing
      const localEntry = addBetaRequest({
        name: body.name.trim(),
        email: body.email.trim().toLowerCase(),
        businessName: body.businessName.trim(),
        isBookkeeper: body.isBookkeeper,
        clientLedgersManaged: body.clientLedgersManaged ?? "",
        accountingSoftware: Array.isArray(body.accountingSoftware) ? body.accountingSoftware : [],
        approximateInvoicesPerMonth: body.approximateInvoicesPerMonth ?? "",
        biggestArPain: Array.isArray(body.biggestArPain) ? body.biggestArPain : [],
        wouldUploadSampleFile: Boolean(body.wouldUploadSampleFile),
        wouldPayFoundingPricing: body.wouldPayFoundingPricing ?? "maybe",
        message: body.message?.trim() ?? "",
      });
      entryId = localEntry.id;
    }
  } else {
    // ── Local Mock Store ──────────────────────────────────────────────────────
    const entry = addBetaRequest({
      name: body.name.trim(),
      email: body.email.trim().toLowerCase(),
      businessName: body.businessName.trim(),
      isBookkeeper: body.isBookkeeper,
      clientLedgersManaged: body.clientLedgersManaged ?? "",
      accountingSoftware: Array.isArray(body.accountingSoftware)
        ? body.accountingSoftware
        : [],
      approximateInvoicesPerMonth: body.approximateInvoicesPerMonth ?? "",
      biggestArPain: Array.isArray(body.biggestArPain) ? body.biggestArPain : [],
      wouldUploadSampleFile: Boolean(body.wouldUploadSampleFile),
      wouldPayFoundingPricing: body.wouldPayFoundingPricing ?? "maybe",
      message: body.message?.trim() ?? "",
    });
    entryId = entry.id;
  }

  // ── Ops notification ──────────────────────────────────────────────────────
  // Structured log — easy to intercept with a log drain (Datadog, Axiom, etc.)
  // or replace with a Resend call: https://resend.com/docs/send-email
  console.log(
    JSON.stringify({
      event: "beta_request_submitted",
      id: entryId,
      name: body.name.trim(),
      email: normalisedEmail,
      businessName: body.businessName.trim(),
      isBookkeeper: body.isBookkeeper,
      accountingSoftware: body.accountingSoftware,
      wouldPay: body.wouldPayFoundingPricing,
      // To add Resend notification:
      // await resend.emails.send({
      //   from: "ops@zentracollect.co.uk",
      //   to: "hello@zentracollect.co.uk",
      //   subject: `New beta request: ${body.name} — ${body.businessName}`,
      //   text: `...`,
      // });
    }),
  );

  return NextResponse.json({ success: true, id: entryId }, { status: 201 });
}
