"use client";

import { AlertTriangle, ExternalLink, ShieldCheck, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ActivityTimeline } from "@/components/activity-timeline";
import { ReminderGenerator } from "@/components/reminder-generator";
import { StatusBadge, UrgencyBadge } from "@/components/status-badge";
import { formatCurrency, formatDate } from "@/lib/formatters";
import {
  getCustomerProfile,
  getInvoiceUrgency,
  getRiskLabels,
  getSuggestedAction,
} from "@/lib/invoice-logic";
import type { ActivityItem, Invoice, InvoiceStatus } from "@/types/cashpilot";

export function InvoiceDetailDrawer({
  invoice,
  invoices,
  open,
  onOpenChange,
  onUpdateInvoice,
}: {
  invoice: Invoice | null;
  invoices: Invoice[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdateInvoice: (invoice: Invoice) => void;
}) {
  const [promiseDate, setPromiseDate] = useState("2026-05-09");

  if (!invoice || !open) return null;

  const customerProfile = getCustomerProfile(invoices, invoice);
  const riskLabels = getRiskLabels(invoice);

  function updateStatus(
    status: InvoiceStatus,
    title: string,
    description: string,
    overrides: Partial<Invoice> = {},
  ) {
    if (!invoice) return;

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
    <>
      {/* Header */}
      <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[#d4c9ae] px-5 py-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={invoice.status} />
            <UrgencyBadge urgency={getInvoiceUrgency(invoice)} />
          </div>
          <p className="mt-2 text-base font-semibold text-[#1d1813]">
            {invoice.customerName}
          </p>
          <p className="mt-0.5 text-sm text-[#8d8472]">
            {invoice.invoiceNumber} &middot; {formatCurrency(invoice.amount)} &middot; due{" "}
            {formatDate(invoice.dueDate)}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="flex size-7 shrink-0 items-center justify-center rounded-full text-[#a09885] transition-colors hover:bg-[#f3ecd8] hover:text-[#3d3428]"
          aria-label="Close"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-4 p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <Info label="Customer email" value={invoice.customerEmail} />
            <Info label="Relationship" value={invoice.relationshipType} />
            <Info
              label="Customer pattern"
              value={`${customerProfile.invoiceCount} invoices, ${formatCurrency(customerProfile.totalOutstanding)} outstanding`}
            />
            <Info
              label="Days overdue"
              value={invoice.daysOverdue > 0 ? `${invoice.daysOverdue} days` : "Not overdue"}
            />
            <Info label="Last chased" value={formatDate(invoice.lastChasedAt)} />
            <Info label="Follow-up" value={formatDate(invoice.followUpDate ?? null)} />
          </div>

          <div className="rounded-lg border bg-muted/30 p-4">
            <p className="text-sm font-medium">Customer context</p>
            <p className="mt-1 text-sm text-muted-foreground">{customerProfile.summary}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {riskLabels.length ? (
                riskLabels.map((label) => (
                  <span key={label} className="rounded-md border bg-background px-2 py-1 text-xs">
                    {label}
                  </span>
                ))
              ) : (
                <span className="text-sm text-muted-foreground">No risk labels.</span>
              )}
            </div>
          </div>

          <div className="rounded-lg border bg-zinc-950 p-4 text-white">
            <div className="flex items-center gap-2 text-sm font-medium">
              <ShieldCheck className="size-4 text-emerald-300" />
              Suggested next action
            </div>
            <p className="mt-2 text-lg font-semibold">{getSuggestedAction(invoice)}</p>
            <p className="mt-2 text-sm text-zinc-300">
              Keep the wording professional. Do not add late fees, statutory interest, or legal
              language unless you have checked the contract and policy.
            </p>
          </div>

          <div className="grid gap-3 rounded-lg border p-4 sm:grid-cols-[1fr_auto] sm:items-end">
            <div className="space-y-2">
              <Label htmlFor="promise-date">Promised payment or follow-up date</Label>
              <Input
                id="promise-date"
                type="date"
                value={promiseDate}
                onChange={(event) => setPromiseDate(event.target.value)}
              />
            </div>
            <Button
              variant="outline"
              onClick={() =>
                updateStatus(
                  "Promised payment",
                  "Payment promised",
                  `Customer promised payment for ${formatDate(promiseDate)}.`,
                  { promisedPaymentDate: promiseDate, followUpDate: promiseDate },
                )
              }
            >
              Save promise
            </Button>
          </div>

          <div className="grid gap-2 sm:grid-cols-5">
            <Button
              className="sm:col-span-1"
              onClick={() => updateStatus("Reminder sent", "Reminder marked as sent", "User marked the reviewed reminder as sent.")}
            >
              Mark sent
            </Button>
            <Button variant="outline" onClick={() => updateStatus("Promised payment", "Payment promised", "Customer has promised payment.", { promisedPaymentDate: promiseDate, followUpDate: promiseDate })}>
              Promised
            </Button>
            <Button variant="outline" onClick={() => updateStatus("Disputed", "Dispute logged", "Invoice marked as disputed.")}>
              Disputed
            </Button>
            <Button variant="outline" onClick={() => updateStatus("Needs call", "Call required", "Invoice needs a direct customer call.")}>
              Call
            </Button>
            <Button variant="outline" onClick={() => updateStatus("Paid", "Invoice paid", "Invoice marked as paid.")}>
              Paid
            </Button>
          </div>

          <Separator />

          <section className="space-y-3">
            <div>
              <h3 className="font-semibold">Reminder draft</h3>
              <p className="text-sm text-muted-foreground">
                Generate a draft, review it, then copy or mark as sent.
              </p>
            </div>
            {invoice.status === "Disputed" ? (
              <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                This invoice is disputed. Ask what needs resolving, not demand payment.
              </div>
            ) : null}
            <ReminderGenerator key={invoice.id} invoice={invoice} onStatusChange={updateStatus} />
          </section>

          <Separator />

          <section className="space-y-3">
            <h3 className="font-semibold">Invoice details</h3>
            <div className="rounded-lg border">
              {invoice.lineItems.map((item) => (
                <div
                  key={item.description}
                  className="flex items-center justify-between gap-4 border-b px-4 py-3 last:border-0"
                >
                  <span className="text-sm">{item.description}</span>
                  <span className="font-mono text-sm">
                    {formatCurrency(item.quantity * item.unitPrice)}
                  </span>
                </div>
              ))}
            </div>
            <Button asChild variant="outline">
              <a href={invoice.paymentLink} target="_blank" rel="noreferrer">
                Open payment link
                <ExternalLink className="size-4" />
              </a>
            </Button>
          </section>

          <Separator />

          <section className="space-y-3 pb-4">
            <h3 className="font-semibold">Activity history</h3>
            <ActivityTimeline items={invoice.activityHistory} />
          </section>
        </div>
      </div>
    </>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 break-words text-sm font-medium">{value}</p>
    </div>
  );
}
