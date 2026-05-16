/**
 * GET /demo/portal
 *
 * Renders the customer-facing payment portal with hard-coded sample
 * data so a Zentra user can preview exactly what their end customers
 * see in chase emails — without needing PAYMENT_TOKEN_SECRET configured
 * or a real signed token.
 *
 * Same visual treatment as /pay/[token], just with the verification +
 * Stripe checkout disabled.
 */

import Link from "next/link";
import {
  Calendar,
  CreditCard,
  Forward,
  MessageSquare,
  ShieldCheck,
  ArrowLeft,
} from "lucide-react";
import {
  calculateStatutoryInterest,
  isInterestMaterial,
} from "@/lib/statutory-interest";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Customer portal preview",
  description: "Preview the payment portal your customers see when you send a chase.",
  robots: { index: false, follow: false },
};

const DAY_MS = 24 * 60 * 60 * 1000;

function fmtGBP(n: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency", currency: "GBP",
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(n);
}

// Sample invoice — chosen to trigger the statutory-interest breakdown
// so the preview shows the full feature surface.
const SAMPLE = {
  invoiceNumber: "INV-2026-0412",
  customerName:  "Northline Creative Ltd",
  amount:        3450.00,
  dueDate:       new Date(Date.now() - 38 * DAY_MS).toISOString().slice(0, 10),
  businessName:  "Acme Studio Ltd",
  businessEmail: "billing@acmestudio.example",
};

export default function DemoPortalPage() {
  const dueDateMs = new Date(SAMPLE.dueDate).getTime();
  const daysOverdue = Math.max(0, Math.floor((Date.now() - dueDateMs) / DAY_MS));
  const fmtDueDate = new Date(SAMPLE.dueDate).toLocaleDateString("en-GB", {
    day: "numeric", month: "long", year: "numeric",
  });

  const showStatutory = isInterestMaterial(SAMPLE.amount, daysOverdue);
  const interestCalc = showStatutory
    ? calculateStatutoryInterest(SAMPLE.amount, daysOverdue)
    : null;

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col items-center px-4 py-8">
      {/* Demo banner */}
      <div className="w-full max-w-md mb-4">
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3">
          <p className="text-[12.5px] text-amber-900 leading-5">
            <strong>Preview mode</strong> — this is exactly what your end customers see when you send a chase with a payment link. The Pay buttons are disabled.
          </p>
          <Link
            href="/demo/chase-plan"
            className="inline-flex items-center gap-1 text-[11.5px] mt-1.5 text-amber-800 underline"
          >
            <ArrowLeft className="size-3" /> Back to demo chase plan
          </Link>
        </div>
      </div>

      <div className="w-full max-w-md">
        {/* Creditor branding */}
        <div className="text-center mb-6">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-400 mb-1">
            Invoice from
          </div>
          <h1 className="text-[20px] font-semibold">{SAMPLE.businessName}</h1>
        </div>

        {/* Invoice card */}
        <div className="rounded-xl border border-neutral-200 bg-white p-5 mb-4">
          <div className="flex items-baseline justify-between mb-3">
            <span className="text-[12px] text-neutral-500">Invoice</span>
            <span className="text-[13px] font-medium font-mono">{SAMPLE.invoiceNumber}</span>
          </div>
          <div className="flex items-baseline justify-between mb-3">
            <span className="text-[12px] text-neutral-500">Customer</span>
            <span className="text-[13px] font-medium">{SAMPLE.customerName}</span>
          </div>
          <div className="flex items-baseline justify-between mb-4">
            <span className="text-[12px] text-neutral-500">Due</span>
            <span className="text-[13px] font-medium">
              {fmtDueDate}
              <span className="ml-1.5 text-red-600 font-semibold">· {daysOverdue}d overdue</span>
            </span>
          </div>

          {showStatutory && interestCalc ? (
            <>
              <div className="border-t border-neutral-200 pt-3 space-y-1.5">
                <div className="flex items-baseline justify-between text-[13px]">
                  <span className="text-neutral-500">Invoice amount</span>
                  <span className="tabular-nums">{fmtGBP(SAMPLE.amount)}</span>
                </div>
                <div className="flex items-baseline justify-between text-[13px]">
                  <span className="text-neutral-500">+ Statutory interest <span className="text-[11px] text-neutral-400">({daysOverdue}d × {interestCalc.annualRate}%)</span></span>
                  <span className="tabular-nums">{fmtGBP(interestCalc.interest)}</span>
                </div>
                <div className="flex items-baseline justify-between text-[13px]">
                  <span className="text-neutral-500">+ Compensation</span>
                  <span className="tabular-nums">{fmtGBP(interestCalc.compensation)}</span>
                </div>
              </div>
              <div className="border-t border-neutral-200 mt-3 pt-3 flex items-baseline justify-between">
                <span className="text-[14px] font-semibold">Total recoverable</span>
                <span className="text-[24px] font-semibold tabular-nums">{fmtGBP(interestCalc.totalRecoverable)}</span>
              </div>
              <p className="text-[10.5px] text-neutral-400 leading-4 mt-2">
                Statutory interest applies under the UK Late Payment of Commercial Debts (Interest) Act 1998.
              </p>
            </>
          ) : (
            <div className="border-t border-neutral-200 pt-3 flex items-baseline justify-between">
              <span className="text-[14px] font-semibold">Amount due</span>
              <span className="text-[24px] font-semibold tabular-nums">{fmtGBP(SAMPLE.amount)}</span>
            </div>
          )}
        </div>

        {/* Pay buttons (disabled in preview) */}
        {showStatutory && interestCalc ? (
          <div className="space-y-2 mb-3">
            <button
              type="button"
              disabled
              className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-neutral-900 text-white px-5 py-3 text-[14px] font-semibold opacity-70 cursor-not-allowed"
            >
              <CreditCard className="size-4" />
              Pay {fmtGBP(interestCalc.totalRecoverable)} (incl. interest)
            </button>
            <button
              type="button"
              disabled
              className="w-full inline-flex items-center justify-center gap-2 rounded-full border border-neutral-300 bg-white px-5 py-3 text-[13.5px] font-medium opacity-70 cursor-not-allowed"
            >
              Pay invoice only ({fmtGBP(SAMPLE.amount)})
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled
            className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-neutral-900 text-white px-5 py-3 text-[14px] font-semibold opacity-70 cursor-not-allowed mb-3"
          >
            <CreditCard className="size-4" />
            Pay {fmtGBP(SAMPLE.amount)} now
          </button>
        )}

        {/* Secondary options */}
        <div className="grid grid-cols-3 gap-2 mb-6">
          <button type="button" disabled className="inline-flex flex-col items-center justify-center gap-1 rounded-lg border border-neutral-300 px-2 py-2.5 text-[11.5px] font-medium opacity-70 cursor-not-allowed text-center">
            <Calendar className="size-3.5" />
            Promise date
          </button>
          <button type="button" disabled className="inline-flex flex-col items-center justify-center gap-1 rounded-lg border border-neutral-300 px-2 py-2.5 text-[11.5px] font-medium opacity-70 cursor-not-allowed text-center">
            <MessageSquare className="size-3.5" />
            Tell us why
          </button>
          <button type="button" disabled className="inline-flex flex-col items-center justify-center gap-1 rounded-lg border border-neutral-300 px-2 py-2.5 text-[11.5px] font-medium opacity-70 cursor-not-allowed text-center">
            <Forward className="size-3.5" />
            Forward to AP
          </button>
        </div>

        {/* Trust footer */}
        <div className="flex items-center justify-center gap-2 text-[11.5px] text-neutral-500">
          <ShieldCheck className="size-3 text-neutral-400" />
          Secure payment via Stripe · Card / Apple Pay / Google Pay
        </div>
        <div className="text-center text-[11px] text-neutral-400 mt-3">
          Questions? Email{" "}
          <a href={`mailto:${SAMPLE.businessEmail}`} className="underline">
            {SAMPLE.businessEmail}
          </a>
        </div>
      </div>
    </div>
  );
}
