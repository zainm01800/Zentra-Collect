/**
 * GET /pay/[token]
 *
 * Public, no-auth customer-facing payment portal. Customer arrives via a
 * signed token URL in their chase email. Token contains the invoice
 * payload, validated by HMAC.
 *
 * States rendered:
 *   - bad token / expired / not configured  → friendly error card
 *   - valid token, not yet paid              → invoice details + actions:
 *                                              "Pay now" (with optional
 *                                              statutory interest breakdown),
 *                                              "Promise a date",
 *                                              "Tell us why",
 *                                              "Forward to AP team"
 *   - paid (post-Stripe redirect)            → success card
 */

import Link from "next/link";
import {
  CheckCircle2,
  CreditCard,
  Calendar,
  Forward,
  MessageSquare,
  ShieldCheck,
} from "lucide-react";
import { verifyPaymentToken, quoteEarlyPay } from "@/lib/customer-portal/token";
import {
  calculateStatutoryInterest,
  isInterestMaterial,
} from "@/lib/statutory-interest";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pay invoice",
  description: "Secure payment portal for your invoice.",
};

export const dynamic = "force-dynamic";

const DAY_MS = 24 * 60 * 60 * 1000;

function fmtGBP(n: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

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
          <p className="text-[14px] leading-6 text-neutral-600 dark:text-neutral-300">{errorMessage}</p>
        </div>
      </PortalShell>
    );
  }

  const inv = verified.payload;
  const fmtDueDate = new Date(inv.dueDate).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  // ── Compute statutory interest from token data ────────────────────────────
  const dueDateMs = new Date(inv.dueDate).getTime();
  const daysOverdue = Math.max(
    0,
    Math.floor((Date.now() - dueDateMs) / DAY_MS),
  );
  const showStatutoryBreakdown = isInterestMaterial(inv.amount, daysOverdue);
  const interestCalc = showStatutoryBreakdown
    ? calculateStatutoryInterest(inv.amount, daysOverdue)
    : null;

  // ── Early-pay discount (suppressed once overdue interest applies) ─────────
  const earlyPay = quoteEarlyPay(inv);
  const showEarlyPay = !!earlyPay && earlyPay.active && !showStatutoryBreakdown;
  const earlyPayDeadlineLabel = earlyPay
    ? new Date(earlyPay.deadlineIso).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
      })
    : null;

  // ── Success state ─────────────────────────────────────────────────────────
  if (justPaid) {
    return (
      <PortalShell>
        <div className="text-center max-w-md mx-auto">
          <div className="size-12 rounded-full bg-emerald-100 inline-flex items-center justify-center mb-4">
            <CheckCircle2 className="size-6 text-emerald-600" />
          </div>
          <h1 className="text-[22px] font-semibold mb-2">Payment received</h1>
          <p className="text-[14px] leading-6 text-neutral-600 dark:text-neutral-300 mb-1">
            Thank you. {inv.businessName} has been notified.
          </p>
          <p className="text-[13px] text-neutral-500 dark:text-neutral-400 dark:text-neutral-500">
            Invoice {inv.invoiceNumber}
          </p>
        </div>
      </PortalShell>
    );
  }

  // ── Default state — show pay options ──────────────────────────────────────
  return (
    <PortalShell>
      <div className="max-w-md mx-auto">

        {/* Creditor branding */}
        <div className="text-center mb-6">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-400 dark:text-neutral-500 mb-1">
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
        <div className="rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-5 mb-4">
          <div className="flex items-baseline justify-between mb-3">
            <span className="text-[12px] text-neutral-500 dark:text-neutral-400 dark:text-neutral-500">Invoice</span>
            <span className="text-[13px] font-medium font-mono">{inv.invoiceNumber}</span>
          </div>
          <div className="flex items-baseline justify-between mb-3">
            <span className="text-[12px] text-neutral-500 dark:text-neutral-400 dark:text-neutral-500">Customer</span>
            <span className="text-[13px] font-medium">{inv.customerName}</span>
          </div>
          <div className="flex items-baseline justify-between mb-4">
            <span className="text-[12px] text-neutral-500 dark:text-neutral-400 dark:text-neutral-500">Due</span>
            <span className="text-[13px] font-medium">
              {fmtDueDate}
              {daysOverdue > 0 && (
                <span className="ml-1.5 text-red-600 font-semibold">· {daysOverdue}d overdue</span>
              )}
            </span>
          </div>

          {showStatutoryBreakdown && interestCalc ? (
            // Overdue invoice → show statutory breakdown
            <>
              <div className="border-t border-neutral-200 dark:border-neutral-700 pt-3 space-y-1.5">
                <div className="flex items-baseline justify-between text-[13px]">
                  <span className="text-neutral-500 dark:text-neutral-400 dark:text-neutral-500">Invoice amount</span>
                  <span className="tabular-nums">{fmtGBP(inv.amount)}</span>
                </div>
                <div className="flex items-baseline justify-between text-[13px]">
                  <span className="text-neutral-500 dark:text-neutral-400 dark:text-neutral-500">+ Statutory interest <span className="text-[11px] text-neutral-400 dark:text-neutral-500">({daysOverdue}d × {interestCalc.annualRate}%)</span></span>
                  <span className="tabular-nums">{fmtGBP(interestCalc.interest)}</span>
                </div>
                <div className="flex items-baseline justify-between text-[13px]">
                  <span className="text-neutral-500 dark:text-neutral-400 dark:text-neutral-500">+ Compensation</span>
                  <span className="tabular-nums">{fmtGBP(interestCalc.compensation)}</span>
                </div>
              </div>
              <div className="border-t border-neutral-200 dark:border-neutral-700 mt-3 pt-3 flex items-baseline justify-between">
                <span className="text-[14px] font-semibold">Total recoverable</span>
                <span className="text-[24px] font-semibold tabular-nums">{fmtGBP(interestCalc.totalRecoverable)}</span>
              </div>
              <p className="text-[10.5px] text-neutral-400 dark:text-neutral-500 leading-4 mt-2">
                Statutory interest applies under the UK Late Payment of Commercial Debts (Interest) Act 1998.
              </p>
            </>
          ) : (
            // Not yet overdue (or too small) → simple amount
            <div className="border-t border-neutral-200 dark:border-neutral-700 pt-3 flex items-baseline justify-between">
              <span className="text-[14px] font-semibold">Amount due</span>
              <span className="text-[24px] font-semibold tabular-nums">{fmtGBP(inv.amount)}</span>
            </div>
          )}
        </div>

        {/* Primary CTA(s) — when overdue, give two options */}
        {showStatutoryBreakdown && interestCalc ? (
          <div className="space-y-2 mb-3">
            <form action="/api/customer-portal/checkout" method="POST">
              <input type="hidden" name="token" value={token} />
              <input type="hidden" name="includeFees" value="1" />
              <button
                type="submit"
                className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-neutral-900 text-white px-5 py-3 text-[14px] font-semibold hover:bg-neutral-800 transition-colors"
              >
                <CreditCard className="size-4" />
                Pay {fmtGBP(interestCalc.totalRecoverable)} (incl. interest)
              </button>
            </form>
            <form action="/api/customer-portal/checkout" method="POST">
              <input type="hidden" name="token" value={token} />
              <input type="hidden" name="includeFees" value="0" />
              <button
                type="submit"
                className="w-full inline-flex items-center justify-center gap-2 rounded-full border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-700 dark:text-white px-5 py-3 text-[13.5px] font-medium hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors"
              >
                Pay invoice only ({fmtGBP(inv.amount)})
              </button>
            </form>
          </div>
        ) : showEarlyPay && earlyPay ? (
          <div className="space-y-2 mb-3">
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-[12.5px] text-emerald-800">
              Pay by <strong>{earlyPayDeadlineLabel}</strong> and save{" "}
              <strong>{fmtGBP(earlyPay.discountAmount)}</strong> ({earlyPay.percent}% early-pay discount).
            </div>
            <form action="/api/customer-portal/checkout" method="POST">
              <input type="hidden" name="token" value={token} />
              <input type="hidden" name="applyDiscount" value="1" />
              <button
                type="submit"
                className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-emerald-600 text-white px-5 py-3 text-[14px] font-semibold hover:bg-emerald-700 transition-colors"
              >
                <CreditCard className="size-4" />
                Pay {fmtGBP(earlyPay.discountedTotal)} (save {fmtGBP(earlyPay.discountAmount)})
              </button>
            </form>
            <form action="/api/customer-portal/checkout" method="POST">
              <input type="hidden" name="token" value={token} />
              <input type="hidden" name="applyDiscount" value="0" />
              <button
                type="submit"
                className="w-full inline-flex items-center justify-center gap-2 rounded-full border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-700 dark:text-white px-5 py-3 text-[13.5px] font-medium hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors"
              >
                Pay full amount ({fmtGBP(inv.amount)})
              </button>
            </form>
          </div>
        ) : (
          <form action="/api/customer-portal/checkout" method="POST" className="mb-3">
            <input type="hidden" name="token" value={token} />
            <input type="hidden" name="includeFees" value="0" />
            <button
              type="submit"
              className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-neutral-900 text-white px-5 py-3 text-[14px] font-semibold hover:bg-neutral-800 transition-colors"
            >
              <CreditCard className="size-4" />
              Pay {fmtGBP(inv.amount)} now
            </button>
          </form>
        )}

        {/* Secondary options — promise + reason + forward */}
        <div className="grid grid-cols-3 gap-2 mb-6">
          <Link
            href={`/pay/${token}/promise`}
            className="inline-flex flex-col items-center justify-center gap-1 rounded-lg border border-neutral-300 dark:border-neutral-600 dark:text-neutral-300 px-2 py-2.5 text-[11.5px] font-medium hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors text-center"
          >
            <Calendar className="size-3.5" />
            Promise date
          </Link>
          <Link
            href={`/pay/${token}/reason`}
            className="inline-flex flex-col items-center justify-center gap-1 rounded-lg border border-neutral-300 dark:border-neutral-600 dark:text-neutral-300 px-2 py-2.5 text-[11.5px] font-medium hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors text-center"
          >
            <MessageSquare className="size-3.5" />
            Tell us why
          </Link>
          <ForwardToApLink token={token} inv={inv} />
        </div>

        {/* Invoice PDF download */}
        <div className="text-center mb-4">
          <Link
            href={`/pay/${token}/invoice`}
            className="text-[12px] text-neutral-500 dark:text-neutral-400 dark:text-neutral-500 underline hover:text-neutral-700"
          >
            Download invoice (PDF)
          </Link>
        </div>

        {/* Trust footer */}
        <div className="flex items-center justify-center gap-2 text-[11.5px] text-neutral-500 dark:text-neutral-400 dark:text-neutral-500">
          <ShieldCheck className="size-3 text-neutral-400 dark:text-neutral-500" />
          Secure payment via Stripe · Card / Apple Pay / Google Pay
        </div>
        <div className="text-center text-[11px] text-neutral-400 dark:text-neutral-500 mt-3">
          Questions? Email{" "}
          <a href={`mailto:${inv.businessEmail}`} className="underline">
            {inv.businessEmail}
          </a>
        </div>
      </div>
    </PortalShell>
  );
}

// ── Forward to AP button — opens mail client with templated handoff ──────────

function ForwardToApLink({
  token,
  inv,
}: {
  token: string;
  inv: { invoiceNumber: string; customerName: string; amount: number; businessName: string };
}) {
  const portalUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/pay/${token}`;
  const subject = `Please pay invoice ${inv.invoiceNumber} from ${inv.businessName}`;
  const body =
    `Hi,\n\n` +
    `Please could you settle this invoice for ${inv.customerName}?\n\n` +
    `From:     ${inv.businessName}\n` +
    `Invoice:  ${inv.invoiceNumber}\n` +
    `Amount:   ${fmtGBP(inv.amount)}\n\n` +
    `You can pay directly here (card / Apple Pay / Google Pay):\n${portalUrl}\n\n` +
    `Thanks,\n`;

  const href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  return (
    <a
      href={href}
      className="inline-flex flex-col items-center justify-center gap-1 rounded-lg border border-neutral-300 dark:border-neutral-600 dark:text-neutral-300 px-2 py-2.5 text-[11.5px] font-medium hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors text-center"
    >
      <Forward className="size-3.5" />
      Forward to AP
    </a>
  );
}

// ── Portal shell — minimal, no app chrome, customer-facing only ──────────────

function PortalShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 flex items-center justify-center px-4 py-12">
      <div className="w-full">{children}</div>
    </div>
  );
}
