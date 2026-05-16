/**
 * GET /pay/[token]
 *
 * Public, no-auth customer-facing payment portal. The customer arrives via
 * a link in their chase email. The token in the URL contains the entire
 * invoice payload, signed with PAYMENT_TOKEN_SECRET — no DB lookup needed.
 *
 * States rendered:
 *   - bad token / expired / not configured  → friendly error card
 *   - valid token, not yet paid              → invoice details + 3 actions:
 *                                              "Pay now" / "Promise a date" / "Tell us why"
 *   - paid (post-Stripe redirect)            → success card
 */

import Link from "next/link";
import { CheckCircle2, CreditCard, Calendar, MessageSquare, ShieldCheck } from "lucide-react";
import { verifyPaymentToken } from "@/lib/customer-portal/token";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pay invoice",
  description: "Secure payment portal for your invoice.",
};

// Public route — never authenticated. Customer-only.
export const dynamic = "force-dynamic";

export default async function PayPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { token } = await params;
  const sp = await searchParams;
  const justPaid = sp.success === "1";
  const wasCancelled = sp.cancelled === "1";

  const verified = verifyPaymentToken(token);

  // ── Error states ──────────────────────────────────────────────────────────
  if (!verified.ok) {
    const errorMessage =
      verified.error === "not_configured"
        ? "This payment link isn't active right now. Please contact the sender directly."
        : verified.error === "expired"
          ? "This payment link has expired. Please ask the sender for a new one."
          : "This payment link doesn't look valid. Please ask the sender to resend it.";

    return (
      <PortalShell>
        <div className="text-center max-w-md mx-auto">
          <h1 className="text-[22px] font-semibold mb-3">Payment link unavailable</h1>
          <p className="text-[14px] leading-6 text-neutral-600">{errorMessage}</p>
        </div>
      </PortalShell>
    );
  }

  const inv = verified.payload;
  const fmtAmount = new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(inv.amount);
  const fmtDueDate = new Date(inv.dueDate).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  // ── Success state ─────────────────────────────────────────────────────────
  if (justPaid) {
    return (
      <PortalShell>
        <div className="text-center max-w-md mx-auto">
          <div className="size-12 rounded-full bg-emerald-100 inline-flex items-center justify-center mb-4">
            <CheckCircle2 className="size-6 text-emerald-600" />
          </div>
          <h1 className="text-[22px] font-semibold mb-2">Payment received</h1>
          <p className="text-[14px] leading-6 text-neutral-600 mb-1">
            Thank you. {inv.businessName} has been notified.
          </p>
          <p className="text-[13px] text-neutral-500">
            Invoice {inv.invoiceNumber} · {fmtAmount}
          </p>
        </div>
      </PortalShell>
    );
  }

  // ── Cancelled state — back to default options ────────────────────────────
  // (just don't show success message; show the standard pay-or-promise page)

  // ── Default state — show pay options ──────────────────────────────────────
  return (
    <PortalShell>
      <div className="max-w-md mx-auto">

        {/* Creditor branding */}
        <div className="text-center mb-6">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-400 mb-1">
            Invoice from
          </div>
          <h1 className="text-[20px] font-semibold">{inv.businessName}</h1>
        </div>

        {/* Cancelled note */}
        {wasCancelled && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 mb-4 text-[13px] text-amber-800">
            Payment cancelled. You can try again below — or pick another option.
          </div>
        )}

        {/* Invoice card */}
        <div className="rounded-xl border border-neutral-200 bg-white p-5 mb-4">
          <div className="flex items-baseline justify-between mb-3">
            <span className="text-[12px] text-neutral-500">Invoice</span>
            <span className="text-[13px] font-medium font-mono">{inv.invoiceNumber}</span>
          </div>
          <div className="flex items-baseline justify-between mb-3">
            <span className="text-[12px] text-neutral-500">Customer</span>
            <span className="text-[13px] font-medium">{inv.customerName}</span>
          </div>
          <div className="flex items-baseline justify-between mb-4">
            <span className="text-[12px] text-neutral-500">Due</span>
            <span className="text-[13px] font-medium">{fmtDueDate}</span>
          </div>
          <div className="border-t border-neutral-200 pt-3 flex items-baseline justify-between">
            <span className="text-[14px] font-semibold">Amount due</span>
            <span className="text-[24px] font-semibold tabular-nums">{fmtAmount}</span>
          </div>
        </div>

        {/* Primary CTA */}
        <form action="/api/customer-portal/checkout" method="POST" className="mb-3">
          <input type="hidden" name="token" value={token} />
          <button
            type="submit"
            className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-neutral-900 text-white px-5 py-3 text-[14px] font-semibold hover:bg-neutral-800 transition-colors"
          >
            <CreditCard className="size-4" />
            Pay {fmtAmount} now
          </button>
        </form>

        {/* Secondary options — promise + reason */}
        <div className="grid grid-cols-2 gap-2 mb-6">
          <Link
            href={`/pay/${token}/promise`}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-neutral-300 px-4 py-2.5 text-[13px] font-medium hover:bg-neutral-50 transition-colors"
          >
            <Calendar className="size-3.5" />
            Promise a date
          </Link>
          <Link
            href={`/pay/${token}/reason`}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-neutral-300 px-4 py-2.5 text-[13px] font-medium hover:bg-neutral-50 transition-colors"
          >
            <MessageSquare className="size-3.5" />
            Tell us why
          </Link>
        </div>

        {/* Trust footer */}
        <div className="flex items-center justify-center gap-2 text-[11.5px] text-neutral-500">
          <ShieldCheck className="size-3 text-neutral-400" />
          Secure payment via Stripe · Card / Apple Pay / Google Pay
        </div>
        <div className="text-center text-[11px] text-neutral-400 mt-3">
          Questions? Email{" "}
          <a href={`mailto:${inv.businessEmail}`} className="underline">
            {inv.businessEmail}
          </a>
        </div>
      </div>
    </PortalShell>
  );
}

// ── Portal shell — minimal, no app chrome, customer-facing only ──────────────

function PortalShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center px-4 py-12">
      <div className="w-full">{children}</div>
    </div>
  );
}
