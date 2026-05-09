"use client";

import { 
  ChevronRight, 
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency, formatDate } from "@/lib/formatters";
import {
  getCustomerProfile,
  getInvoiceUrgency,
  getRiskLabels,
  getSuggestedAction,
} from "@/lib/invoice-logic";
import type { Invoice } from "@/types/cashpilot";
import {
  StatusBadge,
  SafetyBadge,
} from "./zentra-ui";

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
  const riskLabels = getRiskLabels(invoice);
  const customerProfile = getCustomerProfile(invoices, invoice);

  return (
    <button
      type="button"
      onClick={() => onOpen(invoice)}
      className={cn(
        "group relative flex flex-col w-full gap-6 p-6 text-left transition-all duration-300",
        "hover:bg-neutral-50/80 rounded-2xl border border-black/5 bg-white mb-3 shadow-sm",
        "md:flex-row md:items-start"
      )}
    >
      {/* Customer & Amount Section */}
      <div className="min-w-0 shrink-0 space-y-4 md:w-1/3">
        <div>
          <p className="truncate text-lg font-black tracking-tight text-neutral-950">
            {invoice.customerName}
          </p>
          <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-400">
            {invoice.invoiceNumber}
          </p>
        </div>
        
        <div className="flex items-baseline gap-3">
          <span className="text-xl font-black tracking-tight text-neutral-950">
            {formatCurrency(invoice.amount)}
          </span>
          {invoice.daysOverdue > 0 ? (
            <span className="text-xs font-black uppercase tracking-wider text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-100">
              {invoice.daysOverdue}d overdue
            </span>
          ) : (
            <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400">
              Due {formatDate(invoice.dueDate)}
            </span>
          )}
        </div>
      </div>

      {/* Action Section */}
      <div className="min-w-0 flex-1 space-y-2 md:border-l md:border-black/5 md:pl-8">
        <div className="flex items-center gap-3">
          <p className="text-base font-black text-neutral-950">{suggestedAction}</p>
          <div className="hidden sm:flex gap-2">
            <StatusBadge 
              status={urgency.toLowerCase()} 
              variant={urgency === "Critical" || urgency === "High" ? "danger" : urgency === "Medium" ? "warning" : "success"} 
            />
            {riskLabels.length > 0 && <SafetyBadge level="caution" />}
          </div>
        </div>
        <p className="text-sm font-medium leading-relaxed text-neutral-500 line-clamp-2">
          {customerProfile.summary.split(".")[0].trim()}.
        </p>
      </div>

      {/* Meta & CTA */}
      <div className="flex items-center justify-between gap-4 md:flex-col md:items-end md:justify-center">
        <div className="flex sm:hidden gap-2">
           <StatusBadge 
              status={urgency.toLowerCase()} 
              variant={urgency === "Critical" || urgency === "High" ? "danger" : urgency === "Medium" ? "warning" : "success"} 
            />
        </div>
        <span className="hidden md:inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-neutral-400 group-hover:text-neutral-950 transition-colors">
          Review <ChevronRight className="size-3 transition-transform group-hover:translate-x-1" />
        </span>
        <div className="md:hidden flex h-10 items-center justify-center rounded-full bg-neutral-950 px-6 text-xs font-black uppercase tracking-widest text-white">
          Review
        </div>
      </div>
    </button>
  );
}
