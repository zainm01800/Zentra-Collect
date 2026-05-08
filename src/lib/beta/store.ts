// In-memory store for founding-user beta requests.
//
// IMPORTANT: This resets on every server restart and on every cold start in
// serverless environments (Vercel, Netlify, etc.). It is intentionally
// ephemeral — suitable for early demo capture only.
//
// TODO (before launch): Replace addBetaRequest / getBetaRequests with
//   Supabase inserts/selects on a `beta_requests` table. See the schema
//   stub at the bottom of this file.
//
// TODO: On each new submission, send a notification email to the ops team
//   (e.g. via Resend: https://resend.com/docs/introduction).
//
// TODO: Send a confirmation email to the applicant acknowledging their request.

export type AccountingSoftware =
  | "Xero"
  | "QuickBooks"
  | "FreeAgent"
  | "Sage"
  | "Stripe"
  | "Excel / other";

export type ArPain =
  | "Overdue invoices"
  | "Missed promises"
  | "Disputes"
  | "Remittance matching"
  | "Statement requests"
  | "Messy client files"
  | "Not enough time";

export type WouldPay = "yes" | "no" | "maybe";

export type BetaRequest = {
  id: string;
  submittedAt: string;
  name: string;
  email: string;
  businessName: string;
  isBookkeeper: boolean;
  clientLedgersManaged: string;
  accountingSoftware: AccountingSoftware[];
  approximateInvoicesPerMonth: string;
  biggestArPain: ArPain[];
  wouldUploadSampleFile: boolean;
  wouldPayFoundingPricing: WouldPay;
  message: string;
};

// Module-level array — shared across all requests within the same Node.js
// process. Does not persist across restarts.
const store: BetaRequest[] = [];

export function addBetaRequest(
  data: Omit<BetaRequest, "id" | "submittedAt">,
): BetaRequest {
  const entry: BetaRequest = {
    ...data,
    id: `beta-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    submittedAt: new Date().toISOString(),
  };
  store.push(entry);
  return entry;
}

export function getBetaRequests(): BetaRequest[] {
  return [...store];
}

export function getBetaRequestCount(): number {
  return store.length;
}

/*
──────────────────────────────────────────────────────────────────────────────
Supabase migration stub — run this when wiring up real persistence.
──────────────────────────────────────────────────────────────────────────────

create table beta_requests (
  id           uuid primary key default gen_random_uuid(),
  submitted_at timestamptz not null default now(),
  name         text not null,
  email        text not null,
  business_name text not null,
  is_bookkeeper boolean not null,
  client_ledgers_managed text,
  accounting_software text[] not null default '{}',
  approx_invoices_per_month text,
  biggest_ar_pain text[] not null default '{}',
  would_upload_sample_file boolean,
  would_pay_founding_pricing text check (would_pay_founding_pricing in ('yes','no','maybe')),
  message text,
  reviewed boolean not null default false,
  reviewer_notes text
);

-- No RLS needed — insert-only from anonymous route, reads from admin only.
-- Add an index on submitted_at for the admin view.
create index beta_requests_submitted_at_idx on beta_requests (submitted_at desc);
*/
