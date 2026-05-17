"use client";

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
import { LockedFeatureCard, UsageLimitBanner } from "@/components/billing-gates";
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
import { readLocalAccount } from "@/lib/demo-auth";
import { generateWeeklyDigestBrief } from "@/lib/collections/weekly-digest";
import { buildCustomerBehaviourProfile } from "@/lib/collections/customer-behaviour";
import { canUseFeature } from "@/lib/billing/plans";
import { useLocalAccount } from "@/lib/billing/use-local-account";
import { AiDigestNarration } from "@/components/ai-digest-narration";
import type { Customer, Invoice } from "@/types/zentra";

export function ZentraWeeklyDigest() {
  const { account, user } = useLocalAccount();
  const invoices = readImportedInvoices();
  const customers = readCustomersFromInvoices(invoices);
  const isImported = invoices !== demoInvoices;
  const profiles = isImported
    ? customers.map((customer) => buildCustomerBehaviourProfile(customer, invoices))
    : demoCustomerBehaviourProfiles;
  const importDiff =
    account && canUseFeature(account.planId, "reimportComparison")
      ? readImportDiff()
      : null;
  const digest = generateWeeklyDigestBrief({
    invoices,
    customers,
    profiles,
    importDiff,
  });

  return (
    <div className="space-y-8">
      {account?.planId === "demo" ? (
        <UsageLimitBanner
          title="This is a demo digest preview."
          description="Demo accounts can preview the weekly brief with sample data. Start a trial to generate briefs from your own invoice exports."
          actionLabel="Start trial"
        />
      ) : account && !canUseFeature(account.planId, "weeklyDigest") ? (
        <LockedFeatureCard
          title="Advanced weekly reports are locked on this plan."
          description="You can view this preview, but saved weekly summaries and report history are available on paid plans."
          feature="weeklyDigest"
        />
      ) : null}
      <section className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="zn-label mb-1.5">Weekly digest</div>
          <h1 className="zn-page-h1">This week&apos;s collections brief</h1>
          <p className="mt-1.5 max-w-[580px] text-[13.5px] text-[#6b6253] dark:text-[#8a7d69]">
            A Monday-ready summary for owners and bookkeepers — plus an
            AI-narrated Sunday brief you can email to yourself.
          </p>
        </div>
        <Link href="/chase-today" className="zn-pill">
          Open chase plan
          <ArrowRight className="size-3.5" />
        </Link>
      </section>

      {/* AI Sunday brief — generate + email yourself the narrated version */}
      <AiDigestNarration brief={digest} recipientName={user?.businessName ?? "there"} />

      <section className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
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
            <p className="text-sm leading-6 text-[#6b6253] dark:text-[#8a7d69]">
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
            <p className="text-sm leading-6 text-[#6b6253] dark:text-[#8a7d69]">
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
            <p className="text-sm leading-6 text-[#6b6253] dark:text-[#8a7d69]">
              {digest.recommendedFocus}
            </p>
            <p className="mt-3 text-sm leading-6 text-[#6b6253] dark:text-[#8a7d69]">
              What changed since last import: {digest.changedSinceLastImport}
            </p>
          </BriefSection>
        </div>

        <aside className="space-y-5">
          <Card className="rounded-3xl border-[#d4c9ae] dark:border-[#2d2820] bg-[#faf5e8] dark:bg-[#211d17] shadow-none ring-0">
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardDescription className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8d8472] dark:text-[#6a5f4e]">
                    Email preview
                  </CardDescription>
                  <CardTitle className="mt-2 text-xl">
                    Your weekly Zentra Collect brief
                  </CardTitle>
                </div>
                <Mail className="size-5 text-[#8d8472] dark:text-[#6a5f4e]" />
              </div>
            </CardHeader>
            <CardContent>
              <label className="text-xs font-semibold uppercase tracking-[0.14em] text-[#8d8472] dark:text-[#6a5f4e]">
                Subject
              </label>
              <div className="mt-2 rounded-2xl border border-[#d4c9ae] dark:border-[#2d2820] bg-[#faf5e8] dark:bg-[#211d17] px-3 py-2 text-sm text-[#1d1813] dark:text-[#f0e8d5]">
                {digest.emailSubject}
              </div>
              <label className="mt-4 block text-xs font-semibold uppercase tracking-[0.14em] text-[#8d8472] dark:text-[#6a5f4e]">
                Body
              </label>
              <Textarea
                readOnly
                value={digest.emailBody}
                className="mt-2 min-h-96 resize-none rounded-2xl border-[#d4c9ae] dark:border-[#2d2820] bg-white dark:bg-[#211d17] text-sm leading-6"
              />
              <p className="mt-3 text-xs leading-5 text-[#8d8472] dark:text-[#6a5f4e]">
                Preview only. Zentra does not send weekly emails in this MVP.
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-[#d4c9ae] dark:border-[#2d2820] bg-[#faf5e8] dark:bg-[#211d17] shadow-none ring-0">
            <CardHeader>
              <CardTitle>Digest source</CardTitle>
              <CardDescription>
                Generated from ranked actions, promises, disputes, customer
                behaviour, and latest import comparison.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-[#6b6253] dark:text-[#8a7d69]">
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
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
}) {
  return (
    <div className="zn-stat">
      <div className="flex items-center justify-between mb-2.5">
        <span className="zn-label">{label}</span>
        <Icon className="size-3.5" style={{ color: "var(--zn-ink-3)" }} />
      </div>
      <div className="zn-stat-num">{value}</div>
      <p className="text-[12px] mt-1" style={{ color: "var(--zn-ink-3)" }}>
        {detail}
      </p>
    </div>
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
    <Card className="rounded-3xl border-[#d4c9ae] dark:border-[#2d2820] bg-[#faf5e8] dark:bg-[#211d17] shadow-none ring-0">
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
    <div className="flex flex-col gap-2 rounded-2xl border border-[#d4c9ae] dark:border-[#2d2820] bg-[#faf5e8] dark:bg-[#211d17] p-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <p className="text-sm font-medium text-[#1d1813] dark:text-[#f0e8d5]">{title}</p>
        <p className="mt-1 text-xs leading-5 text-[#6b6253] dark:text-[#8a7d69]">{meta}</p>
      </div>
      <Badge variant="outline" className="w-fit rounded-full border-[#d4c9ae] dark:border-[#2d2820] bg-[#faf5e8] dark:bg-[#211d17]">
        {value}
      </Badge>
    </div>
  );
}

function EmptyText({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-[#8d8472] dark:text-[#6a5f4e]">{children}</p>;
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-[#a09885] dark:text-[#8a7d69]">
        {label}
      </p>
      <p className="mt-1 text-sm font-medium text-[#1d1813] dark:text-[#f0e8d5]">{value}</p>
    </div>
  );
}

const demoInvoiceStateStorageKey = "zentra.demoInvoiceState.v1";

function readImportedInvoices() {
  if (typeof window === "undefined") return [];
  const localAccount = readLocalAccount();
  const isDemo = localAccount?.planId === "demo";
  const storageKey = isDemo ? demoInvoiceStateStorageKey : importedInvoicesStorageKey;
  const stored = window.localStorage.getItem(storageKey);
  if (!stored) return isDemo ? demoInvoices : [];

  try {
    const parsed = JSON.parse(stored) as Invoice[];
    return Array.isArray(parsed) && parsed.length ? parsed : isDemo ? demoInvoices : [];
  } catch {
    return isDemo ? demoInvoices : [];
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
