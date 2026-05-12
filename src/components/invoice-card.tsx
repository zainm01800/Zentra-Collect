"use client";

import {
  Phone,
  Mail,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/formatters";
import {
  getCustomerProfile,
  getInvoiceUrgency,
  getRiskLabels,
  getSuggestedAction,
} from "@/lib/invoice-logic";
import type { Invoice } from "@/types/cashpilot";

const urgencyColour: Record<string, string> = {
  Critical: "border-rose-200 bg-rose-50 text-rose-700",
  High: "border-amber-200 bg-amber-50 text-amber-700",
  Medium: "border-yellow-200 bg-yellow-50 text-yellow-700",
  Low: "border-[#d4c9ae] dark:border-[#2d2820] bg-[#f3ecd8] dark:bg-[#28231c] text-[#6b6253] dark:text-[#8a7d69]",
};

export function InvoiceCard({
  invoice,
  invoices,
  onOpenCustomer,
  onOpen,
}: {
  invoice: Invoice;
  invoices: Invoice[];
  onOpenCustomer: (customerName: string) => void;
  onOpen: (invoice: Invoice) => void;
}) {
  const urgency = getInvoiceUrgency(invoice);
  const suggestedAction = getSuggestedAction(invoice);
  const ActionIcon = suggestedAction === "Call customer" ? Phone : Mail;
  const riskLabels = getRiskLabels(invoice);
  const customerProfile = getCustomerProfile(invoices, invoice);

  return (
    <button
      type="button"
      onClick={() => onOpen(invoice)}
      className="grid w-full min-w-0 gap-4 rounded-[1.25rem] border border-[#d4c9ae] dark:border-[#2d2820] bg-[#faf5e8] dark:bg-[#211d17] p-4 text-left shadow-[0_1px_0_rgba(0,0,0,0.03)] transition hover:border-[#c0b49c] dark:border-[#3d3628] hover:bg-[#f5eed9] dark:hover:bg-[#2d2820] hover:shadow-md md:grid-cols-[minmax(0,1.15fr)_minmax(0,1.55fr)_auto]"
    >
      {/* Left: customer + amounts */}
      <div className="min-w-0 border-b border-[#d4c9ae] dark:border-[#2d2820] pb-3 md:border-b-0 md:border-r md:pb-0 md:pr-4">
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation();
            onOpenCustomer(invoice.customerName);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.stopPropagation();
              onOpenCustomer(invoice.customerName);
            }
          }}
          className="block truncate text-left text-base font-semibold text-[#1d1813] dark:text-[#f0e8d5] underline-offset-4 hover:underline cursor-pointer"
        >
          {invoice.customerName}
        </span>
        <p className="mt-1 text-sm text-[#8d8472] dark:text-[#6a5f4e]">{invoice.invoiceNumber}</p>

        <div className="mt-4 space-y-2">
          <p className="text-base font-semibold text-[#1d1813] dark:text-[#f0e8d5]">
            {formatCurrency(invoice.amount)}
          </p>
          {invoice.daysOverdue > 0 ? (
            <p className="text-sm font-medium text-rose-600">
              {invoice.daysOverdue}d overdue
              <span className="ml-1.5 font-normal text-[#a09885] dark:text-[#8a7d69]">
                · due {formatDate(invoice.dueDate)}
              </span>
            </p>
          ) : (
            <p className="text-sm text-[#8d8472] dark:text-[#6a5f4e]">
              Due {formatDate(invoice.dueDate)}
            </p>
          )}
        </div>
      </div>

      <div className="min-w-0">
        <p className="text-base font-semibold text-[#1d1813] dark:text-[#f0e8d5]">{suggestedAction}</p>
        <p className="mt-2 text-sm leading-6 text-[#6b6253] dark:text-[#8a7d69]">
          {customerProfile.summary.split(".")[0].trim()}.
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {riskLabels.slice(0, 2).map((label) => (
            <Badge
              key={label}
              variant="outline"
              className="rounded-full border-[#d4c9ae] dark:border-[#2d2820] bg-[#f3ecd8] dark:bg-[#28231c] text-[10px] uppercase tracking-wider text-[#8d8472] dark:text-[#6a5f4e]"
            >
              {label}
            </Badge>
          ))}
        </div>
      </div>

      {/* Right: meta + CTA */}
      <div className="flex min-w-0 flex-wrap items-start gap-2 md:max-w-48 md:justify-end">
        <span
          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${urgencyColour[urgency] ?? urgencyColour.Low}`}
        >
          {urgency}
        </span>
        <span className="mt-1 w-full rounded-full bg-[#1d1813] px-3 py-2 text-center text-xs font-semibold text-[#faf5e8] transition hover:bg-[#3d3428]">
          Review action
        </span>
      </div>
    </button>
  );
}
