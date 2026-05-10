import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ActivityTimeline } from "@/components/activity-timeline";
import { StatusBadge, UrgencyBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { demoCashpilotInvoices as demoInvoices } from "@/lib/demo-data/zentra-demo-data";
import { formatCurrency, formatDate } from "@/lib/formatters";
import {
  getInvoiceUrgency,
  getSuggestedAction,
} from "@/lib/invoice-logic";

export default async function InvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const invoice = demoInvoices.find((item) => item.id === id);
  if (!invoice) notFound();

  return (
    <AppShell>
      <div className="space-y-6">
        <Button asChild variant="ghost">
          <Link href="/dashboard">
            <ArrowLeft className="size-4" />
            Back to dashboard
          </Link>
        </Button>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="mb-3 flex flex-wrap gap-2">
              <StatusBadge status={invoice.status} />
              <UrgencyBadge urgency={getInvoiceUrgency(invoice)} />
            </div>
            <h1 className="text-3xl font-semibold tracking-tight">
              {invoice.customerName}
            </h1>
            <p className="mt-2 text-muted-foreground">
              {invoice.invoiceNumber} · {formatCurrency(invoice.amount)}
            </p>
          </div>
          <Button asChild>
            <a href={invoice.paymentLink} target="_blank" rel="noreferrer">
              Payment link
              <ExternalLink className="size-4" />
            </a>
          </Button>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
          <Card className="rounded-lg">
            <CardHeader>
              <CardTitle>Invoice details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Info label="Customer email" value={invoice.customerEmail} />
                <Info label="Relationship" value={invoice.relationshipType} />
                <Info label="Issue date" value={formatDate(invoice.issueDate)} />
                <Info label="Due date" value={formatDate(invoice.dueDate)} />
                <Info
                  label="Days overdue"
                  value={
                    invoice.daysOverdue > 0
                      ? `${invoice.daysOverdue} days`
                      : "Not overdue"
                  }
                />
                <Info label="Last chased" value={formatDate(invoice.lastChasedAt)} />
              </div>
              <Separator />
              <div>
                <p className="text-sm font-medium">Suggested action</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {getSuggestedAction(invoice)}
                </p>
              </div>
              <Separator />
              <div className="rounded-lg border">
                {invoice.lineItems.map((item) => (
                  <div
                    key={item.description}
                    className="flex items-center justify-between border-b px-4 py-3 last:border-0"
                  >
                    <span className="text-sm">{item.description}</span>
                    <span className="font-mono text-sm">
                      {formatCurrency(item.quantity * item.unitPrice)}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-lg">
            <CardHeader>
              <CardTitle>Activity history</CardTitle>
            </CardHeader>
            <CardContent>
              <ActivityTimeline items={invoice.activityHistory} />
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
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
