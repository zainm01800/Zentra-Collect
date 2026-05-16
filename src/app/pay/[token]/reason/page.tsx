/**
 * GET /pay/[token]/reason
 *
 * Six-button "why is this overdue?" feedback page. One click → reason flows
 * back to the user's dashboard and chasing pauses until they review.
 */

import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  Clock,
  FileText,
  HelpCircle,
  MessageSquare,
  Users,
  Wrench,
} from "lucide-react";
import { verifyPaymentToken } from "@/lib/customer-portal/token";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tell us what's happening",
  description: "Quick reason capture for an overdue invoice.",
};

export const dynamic = "force-dynamic";

interface ReasonOption {
  id:    string;
  label: string;
  sub:   string;
  Icon:  React.ComponentType<{ className?: string }>;
}

const REASONS: ReasonOption[] = [
  { id: "awaiting_po",        label: "Awaiting PO",          sub: "We need a purchase order first.",       Icon: FileText },
  { id: "in_ap_queue",        label: "In our AP queue",      sub: "It's queued for the next pay run.",     Icon: ClipboardList },
  { id: "awaiting_remittance", label: "Awaiting remittance", sub: "We've paid — sending you proof.",       Icon: Clock },
  { id: "querying_invoice",   label: "Querying the invoice", sub: "Something needs checking before we pay.", Icon: MessageSquare },
  { id: "wrong_contact",      label: "Wrong contact",        sub: "Send this to someone else here.",       Icon: Users },
  { id: "other",              label: "Something else",       sub: "We'll write you back directly.",        Icon: HelpCircle },
];

export default async function ReasonPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { token } = await params;
  const sp = await searchParams;
  const justSubmitted = sp.submitted === "1";
  const submittedReason = sp.reason;

  const verified = verifyPaymentToken(token);

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
  if (justSubmitted && submittedReason) {
    const reason = REASONS.find((r) => r.id === submittedReason);
    return (
      <PortalShell>
        <div className="text-center max-w-md mx-auto">
          <div className="size-12 rounded-full bg-emerald-100 inline-flex items-center justify-center mb-4">
            <CheckCircle2 className="size-6 text-emerald-600" />
          </div>
          <h1 className="text-[22px] font-semibold mb-2">Thanks for letting us know</h1>
          <p className="text-[14px] leading-6 text-neutral-600 mb-2">
            {inv.businessName} now knows: <strong>{reason?.label ?? submittedReason}</strong>.
          </p>
          <p className="text-[13px] text-neutral-500">
            They&apos;ll pause further chasing and reach out if they need anything from you.
          </p>
          <Link
            href={`/pay/${token}`}
            className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-neutral-500 hover:text-neutral-800 mt-6"
          >
            Or pay now anyway →
          </Link>
        </div>
      </PortalShell>
    );
  }

  // ── Reason picker ────────────────────────────────────────────────────────
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
            <Wrench className="size-5 text-neutral-600" />
          </div>
          <h1 className="text-[20px] font-semibold mb-1">What&apos;s holding things up?</h1>
          <p className="text-[13.5px] text-neutral-600">
            Pick one — it stops the reminders and tells {inv.businessName} what&apos;s happening.
          </p>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-4 mb-4">
          <div className="flex items-baseline justify-between">
            <span className="text-[13px] font-mono">{inv.invoiceNumber}</span>
            <span className="text-[14px] font-semibold tabular-nums">
              £{inv.amount.toLocaleString("en-GB", { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="text-[12px] text-neutral-500 mt-1">{inv.customerName}</div>
        </div>

        <form action="/api/customer-portal/reason" method="POST">
          <input type="hidden" name="token" value={token} />
          <div className="grid grid-cols-1 gap-2">
            {REASONS.map((r) => (
              <button
                key={r.id}
                type="submit"
                name="reason"
                value={r.id}
                className="flex items-start gap-3 rounded-lg border border-neutral-300 bg-white p-4 text-left hover:bg-neutral-50 transition-colors"
              >
                <div className="size-8 rounded-lg bg-neutral-100 flex items-center justify-center shrink-0">
                  <r.Icon className="size-4 text-neutral-600" />
                </div>
                <div>
                  <div className="text-[13.5px] font-semibold">{r.label}</div>
                  <div className="text-[11.5px] text-neutral-500 mt-0.5">{r.sub}</div>
                </div>
              </button>
            ))}
          </div>
        </form>
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
