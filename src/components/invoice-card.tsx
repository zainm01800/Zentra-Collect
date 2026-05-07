"use client";

import { ArrowUpRight, Calendar, Mail, Phone, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge, UrgencyBadge } from "@/components/status-badge";
import { formatCurrency, formatDate } from "@/lib/formatters";
import {
  getCustomerProfile,
  getInvoiceUrgency,
  getRiskLabels,
  getSuggestedAction,
} from "@/lib/invoice-logic";
import type { Invoice } from "@/types/cashpilot";

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
    <Card className="rounded-lg transition-colors hover:border-foreground/20">
      <CardContent className="p-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => onOpenCustomer(invoice.customerName)}
                className="truncate text-left text-base font-semibold underline-offset-4 hover:underline"
              >
                {invoice.customerName}
              </button>
              <StatusBadge status={invoice.status} />
              <UrgencyBadge urgency={urgency} />
            </div>
            <div className="mt-3 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2 lg:grid-cols-3">
              <span className="font-mono">{invoice.invoiceNumber}</span>
              <span className="font-medium text-foreground">
                {formatCurrency(invoice.amount)}
              </span>
              <span className="inline-flex items-center gap-1">
                <Calendar className="size-3.5" />
                Due {formatDate(invoice.dueDate)}
              </span>
              <span>
                {invoice.daysOverdue > 0
                  ? `${invoice.daysOverdue} days overdue`
                  : "Not overdue"}
              </span>
              <span>Last chased: {formatDate(invoice.lastChasedAt)}</span>
              {invoice.followUpDate ? (
                <span>Follow up: {formatDate(invoice.followUpDate)}</span>
              ) : null}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {riskLabels.slice(0, 3).map((label) => (
                <Badge key={label} variant="secondary" className="rounded-md">
                  {label}
                </Badge>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-3 xl:w-80">
            <div className="rounded-md bg-muted/60 px-3 py-2 text-sm">
              <div className="flex items-center gap-2 font-medium">
                <ActionIcon className="size-4" />
                {suggestedAction}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {invoice.chaseCount} previous chase
                {invoice.chaseCount === 1 ? "" : "s"}
              </p>
            </div>
            <div className="rounded-md border px-3 py-2 text-xs text-muted-foreground">
              <button
                type="button"
                onClick={() => onOpenCustomer(invoice.customerName)}
                className="mb-1 flex items-center gap-1.5 text-left font-medium text-foreground underline-offset-4 hover:underline"
              >
                <TrendingUp className="size-3.5" />
                Customer pattern
              </button>
              {customerProfile.summary}
            </div>
            <Button onClick={() => onOpen(invoice)} className="h-9 w-full">
              Review invoice
              <ArrowUpRight className="size-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
