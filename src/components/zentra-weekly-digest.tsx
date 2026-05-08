"use client";

import { useEffect } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CalendarCheck,
  CheckCircle2,
  ClipboardList,
  Mail,
  ShieldAlert,
  TrendingUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  demoCustomerBehaviourProfiles,
  demoCustomers,
  demoInvoices,
} from "@/lib/demo-data/zentra-demo-data";
import { formatCurrency, formatDate } from "@/lib/formatters";
import {
  importedInvoicesStorageKey,
  importDiffStorageKey,
  type ImportDiffOutput,
} from "@/lib/import/zentra-import";
import { generateWeeklyDigestBrief } from "@/lib/collections/weekly-digest";
import { buildCustomerBehaviourProfile } from "@/lib/collections/customer-behaviour";
import type { Customer, Invoice } from "@/types/zentra";

export function ZentraWeeklyDigest() {
  const invoices = readImportedInvoices();
  const customers = readCustomersFromInvoices(invoices);
  const isImported = invoices !== demoInvoices;
  const profiles = isImported
    ? customers.map((customer) => buildCustomerBehaviourProfile(customer, invoices))
    : demoCustomerBehaviourProfiles;
  const importDiff = readImportDiff();
  const digest = generateWeeklyDigestBrief({
    invoices,
    customers,
    profiles,
    importDiff,
  });

  // Record digest generation — fire-and-forget, once on mount
  useEffect(() => {
    void fetch("/api/usage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "recordWeeklyDigest" }),
    });
  }, []);

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-5 border-b border-black/10 pb-7 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
            Weekly digest
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-normal text-neutral-950 sm:text-5xl">
            This week&apos;s collections brief
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-neutral-600">
            A Monday-ready summary for owners and bookkeepers. Preview only, no
            emails are sent.
          </p>
        </div>
        <Button asChild className="rounded-full bg-neutral-950 px-5 text-white hover:bg-neutral-800">
          <Link href="/dashboard">
            Open chase plan
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <DigestStat
          label="Cash needing attention"
          value={formatCurrency(digest.totalCashNeedingAttention)}
          detail={`${digest.actionsRecommendedThisWeek} actions this week`}
          icon={ClipboardList}
        />
        <DigestStat
          label="Promises to check"
          value={String(digest.promisesDueThisWeek)}
          detail={`${digest.missedPromises} missed promises`}
          icon={CalendarCheck}
        />
        <DigestStat
          label="Exceptions"
          value={String(digest.unresolvedDisputes)}
          detail={digest.biggestBlocker}
          icon={ShieldAlert}
        />
        <DigestStat
          label="Likely cash"
          value={formatCurrency(digest.cashLikelyToLandThisWeek)}
          detail="Promises due this week"
          icon={CheckCircle2}
        />
        <DigestStat
          label="Customer risks"
          value={String(digest.topCustomersToReview.length)}
          detail="Top accounts to review"
          icon={TrendingUp}
        />
      </section>

      <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-5">
          <BriefSection title="Cash needing attention">
            <p className="text-sm leading-6 text-neutral-600">
              {formatCurrency(digest.totalCashNeedingAttention)} is currently
              tied to invoices that Zentra believes need review or action.
            </p>
          </BriefSection>

          <BriefSection title="Top actions">
            <div className="space-y-2">
              {digest.topActions.map((action) => (
                <Row
                  key={action.label}
                  title={action.label}
                  meta={`${action.count} item${action.count === 1 ? "" : "s"}`}
                  value={formatCurrency(action.amount)}
                />
              ))}
            </div>
          </BriefSection>

          <BriefSection title="Promises to check">
            <div className="space-y-2">
              {digest.promisesToCheck.length ? (
                digest.promisesToCheck.slice(0, 5).map((invoice) => (
                  <Row
                    key={invoice.id}
                    title={`${invoice.customerName} · ${invoice.invoiceNumber}`}
                    meta={`Promised for ${formatDate(invoice.promisedPaymentDate ?? null)}`}
                    value={formatCurrency(invoice.amountOutstanding)}
                  />
                ))
              ) : (
                <EmptyText>No promises due this week.</EmptyText>
              )}
            </div>
          </BriefSection>

          <BriefSection title="Exceptions">
            <div className="space-y-2">
              {digest.exceptions.length ? (
                digest.exceptions.slice(0, 5).map((invoice) => (
                  <Row
                    key={invoice.id}
                    title={`${invoice.customerName} · ${invoice.invoiceNumber}`}
                    meta={humanLabel(invoice.status)}
                    value={formatCurrency(invoice.amountOutstanding)}
                  />
                ))
              ) : (
                <EmptyText>No major exceptions detected.</EmptyText>
              )}
            </div>
          </BriefSection>

          <BriefSection title="Likely cash this week">
            <p className="text-sm leading-6 text-neutral-600">
              {formatCurrency(digest.cashLikelyToLandThisWeek)} is linked to
              promises due this week. Check the bank before following up.
            </p>
          </BriefSection>

          <BriefSection title="Customer risks">
            <div className="space-y-2">
              {digest.topCustomersToReview.map((customer) => (
                <Row
                  key={customer.customerId}
                  title={customer.customerName}
                  meta={`${humanLabel(customer.riskLabel)} · ${customer.reason}`}
                  value={formatCurrency(customer.amountOutstanding)}
                />
              ))}
            </div>
          </BriefSection>

          <BriefSection title="Suggested focus">
            <p className="text-sm leading-6 text-neutral-600">
              {digest.recommendedFocus}
            </p>
            <p className="mt-3 text-sm leading-6 text-neutral-600">
              What changed since last import: {digest.changedSinceLastImport}
            </p>
          </BriefSection>
        </div>

        <aside className="space-y-5">
          <Card className="rounded-3xl border-black/10 bg-white/75 shadow-none ring-0">
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardDescription className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">
                    Email preview
                  </CardDescription>
                  <CardTitle className="mt-2 text-xl">
                    Your weekly Zentra Collect brief
                  </CardTitle>
                </div>
                <Mail className="size-5 text-neutral-500" />
              </div>
            </CardHeader>
            <CardContent>
              <label className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">
                Subject
              </label>
              <div className="mt-2 rounded-2xl border border-black/10 bg-[#fbf8f1] px-3 py-2 text-sm text-neutral-950">
                {digest.emailSubject}
              </div>
              <label className="mt-4 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">
                Body
              </label>
              <Textarea
                readOnly
                value={digest.emailBody}
                className="mt-2 min-h-96 resize-none rounded-2xl border-black/10 bg-[#fbf8f1] text-sm leading-6"
              />
              <p className="mt-3 text-xs leading-5 text-neutral-500">
                Preview only. Zentra does not send weekly emails in this MVP.
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-black/10 bg-white/75 shadow-none ring-0">
            <CardHeader>
              <CardTitle>Digest source</CardTitle>
              <CardDescription>
                Generated from ranked actions, promises, disputes, customer
                behaviour, and latest import comparison.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-neutral-600">
              <InfoLine label="Week starting" value={formatDate(digest.weekStarting)} />
              <InfoLine label="Invoices analysed" value={`${invoices.length}`} />
              <InfoLine
                label="Import comparison"
                value={importDiff ? "Available" : "Not available yet"}
              />
            </CardContent>
          </Card>
        </aside>
      </section>
    </div>
  );
}

function DigestStat({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card className="rounded-2xl border-black/10 bg-white/70 shadow-none ring-0">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardDescription className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">
              {label}
            </CardDescription>
            <CardTitle className="mt-3 text-2xl font-semibold text-neutral-950">
              {value}
            </CardTitle>
          </div>
          <span className="rounded-full border border-black/10 bg-[#f7f2ea] p-2 text-neutral-700">
            <Icon className="size-4" />
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-neutral-500">{detail}</p>
      </CardContent>
    </Card>
  );
}

function BriefSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="rounded-3xl border-black/10 bg-white/75 shadow-none ring-0">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function Row({
  title,
  meta,
  value,
}: {
  title: string;
  meta: string;
  value: string;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-black/10 bg-[#fbf8f1] p-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <p className="text-sm font-medium text-neutral-950">{title}</p>
        <p className="mt-1 text-xs leading-5 text-neutral-600">{meta}</p>
      </div>
      <Badge variant="outline" className="w-fit rounded-full border-black/10 bg-white/70">
        {value}
      </Badge>
    </div>
  );
}

function EmptyText({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-neutral-500">{children}</p>;
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-neutral-400">
        {label}
      </p>
      <p className="mt-1 text-sm font-medium text-neutral-950">{value}</p>
    </div>
  );
}

function readImportedInvoices() {
  if (typeof window === "undefined") return demoInvoices;
  const stored = window.localStorage.getItem(importedInvoicesStorageKey);
  if (!stored) return demoInvoices;

  try {
    const parsed = JSON.parse(stored) as Invoice[];
    return Array.isArray(parsed) && parsed.length ? parsed : demoInvoices;
  } catch {
    return demoInvoices;
  }
}

function readImportDiff() {
  if (typeof window === "undefined") return null;
  const stored = window.localStorage.getItem(importDiffStorageKey);
  if (!stored) return null;

  try {
    return JSON.parse(stored) as ImportDiffOutput;
  } catch {
    return null;
  }
}

function readCustomersFromInvoices(invoices: Invoice[]): Customer[] {
  if (invoices === demoInvoices) return demoCustomers;
  const seen = new Map<string, Customer>();

  for (const invoice of invoices) {
    if (!seen.has(invoice.customerId)) {
      seen.set(invoice.customerId, {
        id: invoice.customerId,
        businessId: invoice.businessId,
        name: invoice.customerName,
        email: invoice.customerEmail,
        relationshipType: invoice.relationshipType,
        customerNotes: invoice.customerNotes,
        createdAt: new Date().toISOString(),
      });
    }
  }

  return Array.from(seen.values());
}

function humanLabel(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
