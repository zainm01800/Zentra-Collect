/**
 * GET /pay/[token]/promise
 *
 * One-tap "When will you pay?" date picker for the customer. Records a
 * promise back to the user's system without requiring login.
 *
 * Differentiator vs every other UK AR tool — most require a back-and-forth
 * email. This is a single click for the customer.
 */

import Link from "next/link";
import { ArrowLeft, Calendar, CheckCircle2 } from "lucide-react";
import { verifyPaymentToken } from "@/lib/customer-portal/token";
import { PromiseDatePicker } from "@/components/customer-portal/promise-date-picker";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Promise a payment date",
  description: "Tell us when payment will land.",
};

export const dynamic = "force-dynamic";

export default async function PromisePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { token } = await params;
  const sp = await searchParams;
  const justSubmitted = sp.submitted === "1";
  const submittedDate = sp.date;

  const verified = verifyPaymentToken(token);

  // ── Error states ──────────────────────────────────────────────────────────
  if (!verified.ok) {
    return (
      <PortalShell>
        <div className="text-center max-w-md mx-auto">
          <h1 className="text-[22px] font-semibold mb-3">Link unavailable</h1>
          <p className="text-[14px] leading-6 text-neutral-600">
            This link doesn&apos;t look valid. Please ask the sender to resend it.
          </p>
        </div>
      </PortalShell>
    );
  }

  const inv = verified.payload;

  // ── Submitted confirmation ───────────────────────────────────────────────
  if (justSubmitted && submittedDate) {
    const fmtDate = new Date(submittedDate).toLocaleDateString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    return (
      <PortalShell>
        <div className="text-center max-w-md mx-auto">
          <div className="size-12 rounded-full bg-emerald-100 inline-flex items-center justify-center mb-4">
            <CheckCircle2 className="size-6 text-emerald-600" />
          </div>
          <h1 className="text-[22px] font-semibold mb-2">Thanks — we&apos;ll expect it</h1>
          <p className="text-[14px] leading-6 text-neutral-600 mb-1">
            {inv.businessName} now expects payment on {fmtDate}.
          </p>
          <p className="text-[13px] text-neutral-500 mt-2">
            Invoice {inv.invoiceNumber} · £{inv.amount.toLocaleString("en-GB", { minimumFractionDigits: 2 })}
          </p>
          <Link
            href={`/pay/${token}`}
            className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-neutral-500 hover:text-neutral-800 mt-6"
          >
            Or pay now instead →
          </Link>
        </div>
      </PortalShell>
    );
  }

  // ── Date picker UI ───────────────────────────────────────────────────────
  return (
    <PortalShell>
      <div className="max-w-md mx-auto">
        <Link
          href={`/pay/${token}`}
          className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-neutral-500 hover:text-neutral-800 mb-4"
        >
          <ArrowLeft className="size-3.5" />
          Back
        </Link>

        <div className="text-center mb-6">
          <div className="size-10 rounded-full bg-neutral-100 inline-flex items-center justify-center mb-3">
            <Calendar className="size-5 text-neutral-600" />
          </div>
          <h1 className="text-[20px] font-semibold mb-1">When will you pay?</h1>
          <p className="text-[13.5px] text-neutral-600">
            Just pick a date — we&apos;ll let {inv.businessName} know to expect it.
          </p>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-5 mb-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-400 mb-2">
            Invoice
          </div>
          <div className="flex items-baseline justify-between mb-2">
            <span className="text-[13px] font-mono">{inv.invoiceNumber}</span>
            <span className="text-[16px] font-semibold tabular-nums">
              £{inv.amount.toLocaleString("en-GB", { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="text-[12px] text-neutral-500">{inv.customerName}</div>
        </div>

        <PromiseDatePicker token={token} />
      </div>
    </PortalShell>
  );
}

function PortalShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center px-4 py-12">
      <div className="w-full">{children}</div>
    </div>
  );
}
