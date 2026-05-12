"use client";

import { AlertTriangle, ExternalLink, ShieldCheck, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ActivityTimeline } from "@/components/activity-timeline";
import { ReminderGenerator } from "@/components/reminder-generator";
import { formatCurrency, formatDate } from "@/lib/formatters";
import {
  getCustomerProfile,
  getInvoiceUrgency,
  getRiskLabels,
  getSuggestedAction,
} from "@/lib/invoice-logic";
import type { ActivityItem, Invoice, InvoiceStatus } from "@/types/cashpilot";
import { cn } from "@/lib/utils";
import {
  StatusBadge,
  SafetyBadge,
  SectionCard,
} from "./zentra-ui";

export function InvoiceDetailContent({
  invoice,
  invoices,
  onUpdateInvoice,
  onClose,
  className,
}: {
  invoice: Invoice;
  invoices: Invoice[];
  onUpdateInvoice: (invoice: Invoice) => void;
  onClose?: () => void;
  className?: string;
}) {
  const [promiseDate, setPromiseDate] = useState(new Date().toISOString().split("T")[0]);

  const customerProfile = getCustomerProfile(invoices, invoice);
  const riskLabels = getRiskLabels(invoice);
  const urgency = getInvoiceUrgency(invoice);

  function updateStatus(
    status: InvoiceStatus,
    title: string,
    description: string,
    overrides: Partial<Invoice> = {},
  ) {
    const activity: ActivityItem = {
      id: `act-${invoice.id}-${Date.now()}`,
      type:
        status === "Paid"
          ? "paid"
          : status === "Disputed"
            ? "dispute_logged"
            : status === "Promised payment"
              ? "promised_payment"
              : status === "Needs call"
                ? "call_needed"
                : status === "Reminder sent"
                  ? "reminder_sent"
                  : "reminder_drafted",
      title,
      description,
      createdAt: new Date().toISOString(),
    };

    onUpdateInvoice({
      ...invoice,
      status,
      ...overrides,
      lastChasedAt:
        status === "Reminder sent" ? new Date().toISOString() : invoice.lastChasedAt,
      chaseCount:
        status === "Reminder sent" ? invoice.chaseCount + 1 : invoice.chaseCount,
      activityHistory: [activity, ...invoice.activityHistory],
    });
  }

  return (
    <div className={cn("flex flex-col h-full bg-[#fdfcf9] dark:bg-[#1a1612]", className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-black/5 dark:border-white/5 bg-white/50 dark:bg-[#1a1612]/80 backdrop-blur sticky top-0 z-20">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <StatusBadge 
              status={urgency.toLowerCase()} 
              variant={urgency === "Critical" || urgency === "High" ? "danger" : urgency === "Medium" ? "warning" : "success"} 
            />
            {riskLabels.length > 0 && <SafetyBadge level="caution" />}
          </div>
          <h2 className="text-2xl font-black tracking-tight text-neutral-950 dark:text-[#f0e8d5]">{invoice.customerName}</h2>
          <p className="text-sm font-bold text-neutral-400 uppercase tracking-widest">
            {invoice.invoiceNumber} · {formatCurrency(invoice.amount)}
          </p>
        </div>
        {onClose && (
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full hover:bg-neutral-100 dark:hover:bg-[#28231c] transition-colors">
            <X className="size-6 text-neutral-400" />
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-10">
        {/* Suggested Action - The "Hero" of the drawer */}
        <div className="rounded-[2.5rem] bg-neutral-950 p-8 text-white shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
            <ShieldCheck className="size-32" />
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">
              <Wand2 className="size-4 text-emerald-400" />
              Recommended action
            </div>
            <h3 className="mt-4 text-3xl font-black tracking-tight leading-none">
              {getSuggestedAction(invoice)}
            </h3>
            <p className="mt-4 text-sm font-medium leading-relaxed text-neutral-400">
              {customerProfile.summary.split(".")[0].trim()}. Review the draft below before sending.
            </p>
          </div>
        </div>

        {/* Info Grid */}
        <div className="grid gap-4 grid-cols-2">
          <InfoCard label="Email" value={invoice.customerEmail} />
          <InfoCard label="Pattern" value={`${customerProfile.invoiceCount} invoices`} />
          <InfoCard label="Overdue" value={invoice.daysOverdue > 0 ? `${invoice.daysOverdue} days` : "Current"} />
          <InfoCard label="Last Chased" value={invoice.lastChasedAt ? formatDate(invoice.lastChasedAt) : "Never"} />
        </div>

        {/* Action Controls */}
        <SectionCard title="Update status" description="Log payment promises or disputes.">
          <div className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
              <div className="flex-1 space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Log promise date</Label>
                <Input
                  type="date"
                  value={promiseDate}
                  onChange={(event) => setPromiseDate(event.target.value)}
                  className="h-11 rounded-full border-black/5 bg-neutral-50 dark:bg-[#211d17] px-5 text-sm font-bold shadow-none transition-all focus-visible:bg-white dark:bg-[#211d17] focus-visible:shadow-xl"
                />
              </div>
              <Button
                className="h-11 rounded-full bg-neutral-950 px-8 text-xs font-black uppercase tracking-widest text-white shadow-lg transition-all hover:scale-105 active:scale-95"
                onClick={() =>
                  updateStatus(
                    "Promised payment",
                    "Payment promised",
                    `Customer promised payment for ${formatDate(promiseDate)}.`,
                    {
                      promisedPaymentDate: promiseDate,
                      followUpDate: promiseDate,
                    },
                  )
                }
              >
                Log promise
              </Button>
            </div>

            <div className="flex flex-wrap gap-3 border-t border-black/5 pt-6">
              <QuickAction 
                label="Paid" 
                onClick={() => updateStatus("Paid", "Invoice paid", "Marked as paid.")} 
              />
              <QuickAction 
                label="Disputed" 
                onClick={() => updateStatus("Disputed", "Dispute logged", "Marked as disputed.")} 
              />
              <QuickAction 
                label="Needs Call" 
                onClick={() => updateStatus("Needs call", "Call required", "Marked for direct call.")} 
              />
            </div>
          </div>
        </SectionCard>

        {/* Reminder Generator */}
        <SectionCard title="Message draft" description="Zentra never sends reminders automatically.">
          <ReminderGenerator
            key={invoice.id}
            invoice={invoice}
            onStatusChange={updateStatus}
          />
        </SectionCard>

        {/* Activity & Details */}
        <div className="space-y-6 pb-12">
           <h3 className="text-sm font-black uppercase tracking-[0.2em] text-neutral-400 px-2">Activity History</h3>
           <div className="rounded-[2rem] border border-black/5 bg-white dark:bg-[#211d17] p-6 shadow-sm">
             <ActivityTimeline items={invoice.activityHistory} />
           </div>
           
           <div className="flex items-center justify-between px-2">
             <h3 className="text-sm font-black uppercase tracking-[0.2em] text-neutral-400">Invoice Items</h3>
             <Button asChild variant="link" className="text-[10px] font-black uppercase tracking-widest text-neutral-400 hover:text-neutral-950 dark:text-[#f0e8d5] p-0 h-auto">
                <a href={invoice.paymentLink} target="_blank" rel="noreferrer">
                  Payment link <ExternalLink className="ml-1 size-3" />
                </a>
              </Button>
           </div>
           <div className="rounded-[2rem] border border-black/5 bg-white dark:bg-[#211d17] overflow-hidden shadow-sm">
            {invoice.lineItems.map((item) => (
              <div
                key={item.description}
                className="flex items-center justify-between gap-4 border-b border-black/5 bg-white dark:bg-[#211d17] px-6 py-4 last:border-0"
              >
                <span className="text-sm font-medium text-neutral-600 dark:text-[#8a7d69]">{item.description}</span>
                <span className="text-sm font-black text-neutral-950 dark:text-[#f0e8d5]">
                  {formatCurrency(item.quantity * item.unitPrice)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-3xl border border-black/5 bg-white dark:bg-[#211d17] p-5 shadow-sm transition-all hover:shadow-md">
      <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400">{label}</p>
      <p className="truncate text-sm font-black tracking-tight text-neutral-950 dark:text-[#f0e8d5]">{value || "—"}</p>
    </div>
  );
}

function QuickAction({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button
      variant="outline"
      className="h-10 rounded-full border-black/5 bg-white dark:bg-[#211d17] px-5 text-[10px] font-black uppercase tracking-widest text-neutral-500 dark:text-[#8a7d69] transition-all hover:bg-neutral-50 dark:bg-[#211d17] hover:text-neutral-950 dark:text-[#f0e8d5]"
      onClick={onClick}
    >
      {label}
    </Button>
  );
}

import { Wand2 } from "lucide-react";
