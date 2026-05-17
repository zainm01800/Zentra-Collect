"use client";

import { Info, Mail, Phone, WalletCards } from "lucide-react";
import type { ElementType } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { StatusBadge } from "@/components/status-badge";
import { ActivityTimeline } from "@/components/activity-timeline";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getCustomerProfile, getRiskLabels, getSuggestedAction } from "@/lib/invoice-logic";
import { formatCurrency, formatDate } from "@/lib/formatters";
import type { Invoice } from "@/types/cashpilot";

export function CustomerProfileDrawer({
  customerName,
  invoices,
  open,
  onOpenChange,
  onOpenInvoice,
}: {
  customerName: string | null;
  invoices: Invoice[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenInvoice: (invoice: Invoice) => void;
}) {
  const customerInvoices = invoices.filter(
    (invoice) => invoice.customerName === customerName,
  );
  const anchorInvoice = customerInvoices[0];

  if (!customerName || !anchorInvoice) return null;

  const profile = getCustomerProfile(invoices, anchorInvoice);
  const openInvoices = customerInvoices.filter((invoice) => invoice.status !== "Paid");
  const activity = customerInvoices
    .flatMap((invoice) =>
      invoice.activityHistory.map((item) => ({
        ...item,
        title: `${invoice.invoiceNumber}: ${item.title}`,
      })),
    )
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const riskLabels = Array.from(
    new Set(customerInvoices.flatMap((invoice) => getRiskLabels(invoice))),
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto p-0 sm:max-w-2xl">
        <div className="p-6">
          <SheetHeader>
            <SheetTitle className="text-2xl">{customerName}</SheetTitle>
            <SheetDescription>{anchorInvoice.customerEmail}</SheetDescription>
          </SheetHeader>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <Metric
              icon={WalletCards}
              label="Outstanding"
              value={formatCurrency(profile.totalOutstanding)}
            />
            <Metric label="Avg days late" value={String(profile.averageDaysLate)} />
            <Metric label="Disputes" value={String(profile.disputes)} />
          </div>

          <div className="mt-4 rounded-lg border bg-muted/30 p-4">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-medium">Payment behaviour</p>
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" className="inline-flex" aria-label="How risk is scored">
                      <Info className="size-3.5 text-muted-foreground hover:text-foreground transition-colors" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-[260px] text-[12px] leading-relaxed">
                    Risk score is based on: days overdue, outstanding amount, number of previous chases, customer payment history, and open invoice count. Invoices with active disputes are automatically blocked.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{profile.summary}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {riskLabels.length ? (
                riskLabels.map((label) => (
                  <span key={label} className="rounded-md border bg-background px-2 py-1 text-xs">
                    {label}
                  </span>
                ))
              ) : (
                <span className="text-sm text-muted-foreground">No risk labels yet.</span>
              )}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="outline">
              <Mail className="size-4" />
              Email customer
            </Button>
            <Button variant="outline">
              <Phone className="size-4" />
              Mark needs call
            </Button>
          </div>

          <Separator className="my-6" />

          <section className="space-y-3">
            <h3 className="font-semibold">Open invoices</h3>
            <div className="space-y-2">
              {openInvoices.map((invoice) => (
                <button
                  key={invoice.id}
                  type="button"
                  onClick={() => onOpenInvoice(invoice)}
                  className="w-full rounded-lg border bg-background p-3 text-left transition-colors hover:bg-muted/50"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm">{invoice.invoiceNumber}</span>
                      <StatusBadge status={invoice.status} />
                    </div>
                    <span className="font-medium">{formatCurrency(invoice.amount)}</span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Due {formatDate(invoice.dueDate)} - {getSuggestedAction(invoice)}
                  </p>
                </button>
              ))}
            </div>
          </section>

          <Separator className="my-6" />

          <section className="space-y-3">
            <h3 className="font-semibold">Recent activity</h3>
            <ActivityTimeline items={activity.slice(0, 8)} />
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon?: ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        {label}
        {Icon ? <Icon className="size-3.5" /> : null}
      </div>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}
