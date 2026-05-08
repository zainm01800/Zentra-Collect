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

  // ── Store ─────────────────────────────────────────────────────────────────

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

  // Server-side log for ops visibility — safe to log (no financial data).
  // TODO: Replace with structured observability logging.
  console.log(
    `[beta-request] #${entry.id} — ${entry.name} <${entry.email}> | ${entry.businessName} | bookkeeper: ${entry.isBookkeeper}`,
  );

  return NextResponse.json({ success: true, id: entry.id }, { status: 201 });
}
