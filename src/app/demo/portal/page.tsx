"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Calendar,
  CreditCard,
  Forward,
  MessageSquare,
  ShieldCheck,
  ArrowLeft,
  Check,
  X,
} from "lucide-react";
import {
  calculateStatutoryInterest,
  isInterestMaterial,
} from "@/lib/statutory-interest";

const DAY_MS = 24 * 60 * 60 * 1000;

function fmtGBP(n: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency", currency: "GBP",
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(n);
}

const SAMPLE = {
  invoiceNumber: "INV-2026-0412",
  customerName:  "Northline Creative Ltd",
  amount:        3450.00,
  dueDate:       new Date(Date.now() - 38 * DAY_MS).toISOString().slice(0, 10),
  businessName:  "Acme Studio Ltd",
  businessEmail: "billing@acmestudio.example",
};

type OpenForm = "promise" | "reason" | "forward" | null;

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

  const [openForm, setOpenForm] = useState<OpenForm>(null);
  const [promiseDate, setPromiseDate] = useState("");
  const [reasonText, setReasonText] = useState("");
  const [forwardEmail, setForwardEmail] = useState("");
  const [submitted, setSubmitted] = useState<{ type: OpenForm; value: string } | null>(null);
  const [payClicked, setPayClicked] = useState(false);

  function submitForm(type: OpenForm, value: string) {
    setSubmitted({ type, value });
    setOpenForm(null);
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col items-center px-4 py-8">
      {/* Demo banner */}
      <div className="w-full max-w-md mb-4">
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3">
          <p className="text-[12.5px] text-amber-900 leading-5">
            <strong>Preview mode</strong> — this is exactly what your end customers see when you send a chase with a payment link. The portal forms are interactive in this preview.
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
          <h1 className="text-[20px] font-semibold text-neutral-900">{SAMPLE.businessName}</h1>
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
                  <span className="text-neutral-500">
                    + Statutory interest{" "}
                    <span className="text-[11px] text-neutral-400">
                      ({daysOverdue}d × {interestCalc.annualRate}%)
                    </span>
                  </span>
                  <span className="tabular-nums">{fmtGBP(interestCalc.interest)}</span>
                </div>
                <div className="flex items-baseline justify-between text-[13px]">
                  <span className="text-neutral-500">+ Compensation</span>
                  <span className="tabular-nums">{fmtGBP(interestCalc.compensation)}</span>
                </div>
              </div>
              <div className="border-t border-neutral-200 mt-3 pt-3 flex items-baseline justify-between">
                <span className="text-[14px] font-semibold">Total recoverable</span>
                <span className="text-[24px] font-semibold tabular-nums">
                  {fmtGBP(interestCalc.totalRecoverable)}
                </span>
              </div>
              <p className="text-[10.5px] text-neutral-400 leading-4 mt-2">
                Statutory interest under the UK Late Payment of Commercial Debts (Interest) Act 1998.
              </p>
            </>
          ) : (
            <div className="border-t border-neutral-200 pt-3 flex items-baseline justify-between">
              <span className="text-[14px] font-semibold">Amount due</span>
              <span className="text-[24px] font-semibold tabular-nums">{fmtGBP(SAMPLE.amount)}</span>
            </div>
          )}
        </div>

        {/* Pay buttons */}
        {payClicked ? (
          <div className="rounded-xl border border-green-200 bg-green-50 px-5 py-4 mb-3 text-center">
            <div className="flex items-center justify-center gap-2 text-green-700 font-semibold text-[14px] mb-1">
              <Check className="size-4" />
              Payment initiated
            </div>
            <p className="text-[12px] text-green-600">
              This is a preview — in production this would open Stripe checkout.
            </p>
          </div>
        ) : showStatutory && interestCalc ? (
          <div className="space-y-2 mb-3">
            <button
              type="button"
              onClick={() => setPayClicked(true)}
              className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-neutral-900 text-white px-5 py-3 text-[14px] font-semibold hover:bg-neutral-700 transition-colors cursor-pointer"
            >
              <CreditCard className="size-4" />
              Pay {fmtGBP(interestCalc.totalRecoverable)} (incl. interest)
            </button>
            <button
              type="button"
              onClick={() => setPayClicked(true)}
              className="w-full inline-flex items-center justify-center gap-2 rounded-full border border-neutral-300 bg-white px-5 py-3 text-[13.5px] font-medium hover:bg-neutral-50 transition-colors cursor-pointer"
            >
              Pay invoice only ({fmtGBP(SAMPLE.amount)})
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setPayClicked(true)}
            className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-neutral-900 text-white px-5 py-3 text-[14px] font-semibold hover:bg-neutral-700 transition-colors cursor-pointer mb-3"
          >
            <CreditCard className="size-4" />
            Pay {fmtGBP(SAMPLE.amount)} now
          </button>
        )}

        {/* Submission confirmations */}
        {submitted && (
          <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 mb-3 flex items-start gap-3">
            <Check className="size-4 text-green-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              {submitted.type === "promise" && (
                <>
                  <p className="text-[13px] font-semibold text-green-800">Payment date logged</p>
                  <p className="text-[12px] text-green-700 mt-0.5">
                    Thank you — we have noted your payment date of{" "}
                    <strong>
                      {new Date(submitted.value).toLocaleDateString("en-GB", {
                        day: "numeric", month: "long", year: "numeric",
                      })}
                    </strong>
                    . We will follow up if payment is not received by then.
                  </p>
                </>
              )}
              {submitted.type === "reason" && (
                <>
                  <p className="text-[13px] font-semibold text-green-800">Message received</p>
                  <p className="text-[12px] text-green-700 mt-0.5">
                    Thank you for letting us know. {SAMPLE.businessName} will review your note and be in touch shortly.
                  </p>
                </>
              )}
              {submitted.type === "forward" && (
                <>
                  <p className="text-[13px] font-semibold text-green-800">Forwarded to AP team</p>
                  <p className="text-[12px] text-green-700 mt-0.5">
                    A copy of this invoice has been sent to <strong>{submitted.value}</strong>.
                  </p>
                </>
              )}
            </div>
            <button
              type="button"
              onClick={() => setSubmitted(null)}
              className="text-green-500 hover:text-green-700"
            >
              <X className="size-3.5" />
            </button>
          </div>
        )}

        {/* Secondary options */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {(["promise", "reason", "forward"] as const).map((form) => {
            const Icon = form === "promise" ? Calendar : form === "reason" ? MessageSquare : Forward;
            const label = form === "promise" ? "Promise date" : form === "reason" ? "Tell us why" : "Forward to AP";
            const done = submitted?.type === form;
            return (
              <button
                key={form}
                type="button"
                onClick={() => setOpenForm(openForm === form ? null : form)}
                className={`inline-flex flex-col items-center justify-center gap-1 rounded-lg border px-2 py-2.5 text-[11.5px] font-medium text-center transition-colors cursor-pointer ${
                  done
                    ? "border-green-300 bg-green-50 text-green-700"
                    : openForm === form
                    ? "border-neutral-900 bg-neutral-900 text-white"
                    : "border-neutral-300 text-neutral-700 hover:border-neutral-400"
                }`}
              >
                {done ? <Check className="size-3.5" /> : <Icon className="size-3.5" />}
                {done && form === "promise" ? "Date set" : done ? "Sent" : label}
              </button>
            );
          })}
        </div>

        {/* Inline forms */}
        {openForm === "promise" && (
          <div className="rounded-xl border border-neutral-200 bg-white p-4 mb-4">
            <p className="text-[13px] font-semibold text-neutral-800 mb-1">When do you expect to pay?</p>
            <p className="text-[11.5px] text-neutral-500 mb-3">
              We&apos;ll pause automated reminders until this date and follow up if payment hasn&apos;t arrived.
            </p>
            <input
              type="date"
              min={today}
              value={promiseDate}
              onChange={(e) => setPromiseDate(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-[13px] mb-3 outline-none focus:border-neutral-500"
            />
            <div className="flex gap-2">
              <button
                type="button"
                disabled={!promiseDate}
                onClick={() => submitForm("promise", promiseDate)}
                className="flex-1 rounded-full bg-neutral-900 text-white px-4 py-2 text-[13px] font-semibold disabled:opacity-40 hover:bg-neutral-700 transition-colors cursor-pointer"
              >
                Confirm date
              </button>
              <button
                type="button"
                onClick={() => setOpenForm(null)}
                className="rounded-full border border-neutral-300 px-4 py-2 text-[13px] hover:bg-neutral-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {openForm === "reason" && (
          <div className="rounded-xl border border-neutral-200 bg-white p-4 mb-4">
            <p className="text-[13px] font-semibold text-neutral-800 mb-1">What&apos;s holding up payment?</p>
            <p className="text-[11.5px] text-neutral-500 mb-3">
              Let {SAMPLE.businessName} know — disputes, missing PO numbers, or cash-flow issues are all fine to mention.
            </p>
            <textarea
              rows={4}
              placeholder="e.g. Awaiting PO approval from our finance team — expecting sign-off by end of week."
              value={reasonText}
              onChange={(e) => setReasonText(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-[13px] mb-3 resize-none outline-none focus:border-neutral-500 placeholder:text-neutral-400"
            />
            <div className="flex gap-2">
              <button
                type="button"
                disabled={!reasonText.trim()}
                onClick={() => submitForm("reason", reasonText.trim())}
                className="flex-1 rounded-full bg-neutral-900 text-white px-4 py-2 text-[13px] font-semibold disabled:opacity-40 hover:bg-neutral-700 transition-colors cursor-pointer"
              >
                Send message
              </button>
              <button
                type="button"
                onClick={() => setOpenForm(null)}
                className="rounded-full border border-neutral-300 px-4 py-2 text-[13px] hover:bg-neutral-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {openForm === "forward" && (
          <div className="rounded-xl border border-neutral-200 bg-white p-4 mb-4">
            <p className="text-[13px] font-semibold text-neutral-800 mb-1">Forward to your AP team</p>
            <p className="text-[11.5px] text-neutral-500 mb-3">
              Enter your accounts payable email — we&apos;ll send them this invoice directly.
            </p>
            <input
              type="email"
              placeholder="ap@yourcompany.com"
              value={forwardEmail}
              onChange={(e) => setForwardEmail(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-[13px] mb-3 outline-none focus:border-neutral-500 placeholder:text-neutral-400"
            />
            <div className="flex gap-2">
              <button
                type="button"
                disabled={!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(forwardEmail)}
                onClick={() => submitForm("forward", forwardEmail)}
                className="flex-1 rounded-full bg-neutral-900 text-white px-4 py-2 text-[13px] font-semibold disabled:opacity-40 hover:bg-neutral-700 transition-colors cursor-pointer"
              >
                Forward invoice
              </button>
              <button
                type="button"
                onClick={() => setOpenForm(null)}
                className="rounded-full border border-neutral-300 px-4 py-2 text-[13px] hover:bg-neutral-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

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
