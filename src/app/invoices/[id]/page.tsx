import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock, Mail, User } from "lucide-react";
import { demoCashpilotInvoices as demoInvoices } from "@/lib/demo-data/zentra-demo-data";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { getInvoiceUrgency, getSuggestedAction } from "@/lib/invoice-logic";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Invoice" };

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtStatus(s: string) {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function statusColor(s: string): { bg: string; text: string } {
  if (s === "Paid") return { bg: "var(--zn-safe-soft)",  text: "var(--zn-safe)" };
  if (s === "Overdue" || s === "Disputed") return { bg: "var(--zn-risk-soft)", text: "var(--zn-risk)" };
  if (s === "Due soon") return { bg: "var(--zn-warn-soft)", text: "var(--zn-warn)" };
  return { bg: "var(--zn-surface-2)", text: "var(--zn-ink-2)" };
}

function urgencyColor(u: string): { bg: string; text: string } {
  if (u === "Critical") return { bg: "var(--zn-risk-soft)", text: "var(--zn-risk)" };
  if (u === "High")     return { bg: "var(--zn-warn-soft)", text: "var(--zn-warn)" };
  if (u === "Medium")   return { bg: "var(--zn-info-soft)", text: "var(--zn-info)" };
  return { bg: "var(--zn-surface-2)", text: "var(--zn-ink-3)" };
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function InvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const invoice = demoInvoices.find((item) => item.id === id);
  if (!invoice) notFound();

  const urgency   = getInvoiceUrgency(invoice);
  const action    = getSuggestedAction(invoice);
  const sColor    = statusColor(invoice.status);
  const uColor    = urgencyColor(urgency);

  return (
    <div className="flex flex-col gap-5 max-w-3xl">

        {/* Back */}
        <Link
          href="/chase-today"
          className="flex items-center gap-1.5 text-[12.5px] font-medium w-fit transition-opacity hover:opacity-70"
          style={{ color: "var(--zn-ink-3)" }}
        >
          <ArrowLeft className="size-3.5" />
          Collections
        </Link>

        {/* Header card */}
        <div className="zn-card px-6 py-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              {/* Badges */}
              <div className="flex flex-wrap gap-2 mb-3">
                <span
                  className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: sColor.bg, color: sColor.text }}
                >
                  {invoice.status}
                </span>
                <span
                  className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: uColor.bg, color: uColor.text }}
                >
                  {urgency} urgency
                </span>
              </div>
              <h1
                className="text-[24px] font-semibold tracking-tight leading-tight"
                style={{ color: "var(--zn-ink)" }}
              >
                {invoice.customerName}
              </h1>
              <p className="mt-1 text-[13.5px]" style={{ color: "var(--zn-ink-3)" }}>
                {invoice.invoiceNumber}
              </p>
            </div>
            {/* Amount */}
            <div className="text-right flex-shrink-0">
              <p
                className="text-[32px] font-bold tabular-nums leading-none"
                style={{ color: invoice.daysOverdue > 0 ? "var(--zn-risk)" : "var(--zn-ink)" }}
              >
                {formatCurrency(invoice.amount)}
              </p>
              {invoice.daysOverdue > 0 && (
                <p className="text-[12px] mt-1 font-medium" style={{ color: "var(--zn-risk)" }}>
                  {invoice.daysOverdue} days overdue
                </p>
              )}
            </div>
          </div>

          {/* Suggested action */}
          {action && (
            <div
              className="mt-4 px-3.5 py-3 rounded-[10px]"
              style={{ background: "var(--zn-warn-soft)", border: "1px solid var(--zn-warn)" }}
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--zn-warn)" }}>
                Suggested action
              </p>
              <p className="text-[13px] font-medium mt-0.5" style={{ color: "var(--zn-warn)" }}>
                {action}
              </p>
            </div>
          )}
        </div>

        {/* Main grid */}
        <div className="grid gap-5 lg:grid-cols-[1fr_300px]">

          {/* Invoice details */}
          <div className="zn-card px-5 py-4 flex flex-col gap-0">
            <span className="zn-label mb-3">Invoice details</span>

            <div className="grid grid-cols-2 gap-y-0 divide-y" style={{ borderColor: "var(--zn-line-soft)" }}>
              {[
                { label: "Invoice number", value: invoice.invoiceNumber },
                { label: "Issue date",     value: formatDate(invoice.issueDate) },
                { label: "Due date",       value: formatDate(invoice.dueDate) },
                { label: "Chase count",    value: `${invoice.chaseCount} chase${invoice.chaseCount === 1 ? "" : "s"}` },
                {
                  label: "Last chased",
                  value: invoice.lastChasedAt ? formatDate(invoice.lastChasedAt) : "Never",
                },
                { label: "Relationship",   value: invoice.relationshipType },
              ].map(({ label, value }) => (
                <div
                  key={label}
                  className="flex flex-col gap-0.5 py-3 first:border-t-0"
                  style={{ borderColor: "var(--zn-line-soft)" }}
                >
                  <span className="text-[10.5px] font-semibold uppercase tracking-[0.07em]" style={{ color: "var(--zn-ink-3)" }}>
                    {label}
                  </span>
                  <span className="text-[13.5px] font-medium" style={{ color: "var(--zn-ink)" }}>
                    {value}
                  </span>
                </div>
              ))}
            </div>

            {/* Contact row */}
            <div
              className="mt-3 pt-3 flex flex-col gap-2"
              style={{ borderTop: "1px solid var(--zn-line-soft)" }}
            >
              <div className="flex items-center gap-2">
                <User className="size-3.5 flex-shrink-0" style={{ color: "var(--zn-ink-3)" }} />
                <span className="text-[13px]" style={{ color: "var(--zn-ink-2)" }}>
                  {invoice.relationshipType}
                </span>
              </div>
              {invoice.customerEmail && (
                <div className="flex items-center gap-2">
                  <Mail className="size-3.5 flex-shrink-0" style={{ color: "var(--zn-ink-3)" }} />
                  <a
                    href={`mailto:${invoice.customerEmail}`}
                    className="text-[13px] hover:underline"
                    style={{ color: "var(--zn-ink-2)" }}
                  >
                    {invoice.customerEmail}
                  </a>
                </div>
              )}
            </div>

            {/* Line items */}
            {invoice.lineItems.length > 0 && (
              <div
                className="mt-4 pt-4"
                style={{ borderTop: "1px solid var(--zn-line-soft)" }}
              >
                <span className="zn-label !p-0 mb-2">Line items</span>
                <div className="flex flex-col gap-0 rounded-[10px] overflow-hidden border" style={{ borderColor: "var(--zn-line-soft)" }}>
                  {invoice.lineItems.map((item, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between px-4 py-2.5"
                      style={{ borderTop: i > 0 ? "1px solid var(--zn-line-soft)" : "none" }}
                    >
                      <span className="text-[13px]" style={{ color: "var(--zn-ink-2)" }}>
                        {item.description}
                      </span>
                      <span className="text-[13px] font-semibold tabular-nums" style={{ color: "var(--zn-ink)" }}>
                        {formatCurrency(item.quantity * item.unitPrice)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Activity */}
          <div className="zn-card px-5 py-4">
            <span className="zn-label mb-3">Activity history</span>
            {invoice.activityHistory.length === 0 ? (
              <p className="text-[13px]" style={{ color: "var(--zn-ink-3)" }}>No activity recorded.</p>
            ) : (
              <div className="flex flex-col gap-0 relative">
                {/* Timeline line */}
                <div
                  className="absolute left-[5px] top-2 bottom-2 w-px"
                  style={{ background: "var(--zn-line-soft)" }}
                />
                {invoice.activityHistory.map((ev, i) => (
                  <div key={ev.id} className={`flex gap-3 ${i > 0 ? "mt-4" : ""}`}>
                    <div
                      className="size-2.5 rounded-full flex-shrink-0 mt-1 relative z-[1]"
                      style={{ background: "var(--zn-accent)", border: "2px solid var(--zn-bg-2)" }}
                    />
                    <div className="min-w-0 pb-1">
                      <p className="text-[12.5px] font-semibold leading-tight" style={{ color: "var(--zn-ink)" }}>
                        {ev.title}
                      </p>
                      {ev.description && (
                        <p className="text-[12px] mt-0.5 leading-snug" style={{ color: "var(--zn-ink-3)" }}>
                          {ev.description}
                        </p>
                      )}
                      <div className="flex items-center gap-1 mt-1">
                        <Clock className="size-3" style={{ color: "var(--zn-ink-3)" }} />
                        <span className="text-[10.5px]" style={{ color: "var(--zn-ink-3)" }}>
                          {formatDate(ev.createdAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Customer link */}
        <div className="flex justify-start">
          <Link
            href={`/customers`}
            className="text-[12.5px] font-medium transition-opacity hover:opacity-70"
            style={{ color: "var(--zn-ink-3)" }}
          >
            View all invoices for {invoice.customerName} →
          </Link>
        </div>
      </div>
  );
}
