/**
 * GET /pay/[token]/invoice
 *
 * Print-optimised invoice rendering from the same signed token used by
 * the payment portal. The customer hits "Download invoice", their
 * browser auto-opens the print dialog, they "Save as PDF". No server
 * PDF library, no extra Stripe call — token already carries the data.
 */

import Link from "next/link";
import { verifyPaymentToken } from "@/lib/customer-portal/token";
import { PrintTrigger } from "./print-trigger";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Invoice",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

function fmtGBP(n: number): string {
  return new Intl.NumberFormat("en-GB", {
    style:    "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
  }).format(n);
}

export default async function InvoicePdfPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const verified = verifyPaymentToken(token);

  if (!verified.ok) {
    return (
      <div className="min-h-screen bg-white dark:bg-neutral-900 flex items-center justify-center p-8">
        <div className="text-center">
          <h1 className="text-xl font-semibold">Invoice unavailable</h1>
          <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">
            This link isn&rsquo;t valid. Please ask the sender to resend it.
          </p>
        </div>
      </div>
    );
  }

  const inv = verified.payload;
  const issueDate = new Date(inv.iat * 1000).toLocaleDateString("en-GB", {
    day: "numeric", month: "long", year: "numeric",
  });
  const dueDate = new Date(inv.dueDate).toLocaleDateString("en-GB", {
    day: "numeric", month: "long", year: "numeric",
  });

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 print:bg-white">
      <PrintTrigger />

      <div className="max-w-[720px] mx-auto p-10 print:p-0">
        {/* Toolbar (hidden in print) */}
        <div className="flex justify-between items-center mb-8 print:hidden">
          <Link
            href={`/pay/${token}`}
            className="text-[12.5px] text-neutral-500 dark:text-neutral-400 dark:text-neutral-500 underline hover:text-neutral-800"
          >
            ← Back to payment
          </Link>
          <button
            type="button"
            onClick={() => { if (typeof window !== "undefined") window.print(); }}
            className="rounded-full bg-neutral-900 text-white text-[13px] font-medium px-4 py-2 hover:bg-neutral-800"
          >
            Save as PDF
          </button>
        </div>

        {/* Invoice */}
        <div className="border border-neutral-200 dark:border-neutral-700 rounded-xl p-10 print:border-0 print:rounded-none print:p-0">
          <div className="flex justify-between items-start mb-10">
            <div>
              <h1 className="text-[28px] font-semibold leading-tight">INVOICE</h1>
              <p className="text-[13px] text-neutral-500 dark:text-neutral-400 dark:text-neutral-500 mt-1 font-mono">{inv.invoiceNumber}</p>
            </div>
            <div className="text-right">
              <p className="text-[15px] font-semibold">{inv.businessName}</p>
              <p className="text-[12px] text-neutral-500 dark:text-neutral-400 dark:text-neutral-500">{inv.businessEmail}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 mb-10 text-[13px]">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-1">Bill to</p>
              <p className="font-medium">{inv.customerName}</p>
            </div>
            <div className="text-right">
              <p className="text-[11px] uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-1">Invoice date</p>
              <p>{issueDate}</p>
              <p className="text-[11px] uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mt-3 mb-1">Due date</p>
              <p>{dueDate}</p>
            </div>
          </div>

          <table className="w-full text-[13px] mb-10">
            <thead>
              <tr className="border-b border-neutral-300 dark:border-neutral-600">
                <th className="text-left font-medium text-neutral-500 dark:text-neutral-400 dark:text-neutral-500 pb-2">Description</th>
                <th className="text-right font-medium text-neutral-500 dark:text-neutral-400 dark:text-neutral-500 pb-2">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-neutral-200 dark:border-neutral-700">
                <td className="py-3">Invoice {inv.invoiceNumber}</td>
                <td className="py-3 text-right tabular-nums">{fmtGBP(inv.amount)}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <td className="pt-4 text-right font-semibold">Total due</td>
                <td className="pt-4 text-right font-semibold tabular-nums text-[16px]">{fmtGBP(inv.amount)}</td>
              </tr>
            </tfoot>
          </table>

          <div className="border-t border-neutral-200 dark:border-neutral-700 pt-6 text-[11.5px] text-neutral-500 dark:text-neutral-400 dark:text-neutral-500">
            Questions about this invoice? Email{" "}
            <a href={`mailto:${inv.businessEmail}`} className="underline">
              {inv.businessEmail}
            </a>
            . Pay online securely at{" "}
            <span className="font-mono">/pay/{inv.invoiceNumber}</span>.
          </div>
        </div>
      </div>
    </div>
  );
}
