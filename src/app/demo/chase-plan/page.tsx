"use client";

/**
 * src/app/demo/chase-plan/page.tsx
 *
 * Interactive demo chase plan. No auth, no uploads, no personal data.
 * Users can click through invoices, see draft messages, and change
 * statuses (resets on refresh — session only).
 */

import { useState } from "react";
import Link from "next/link";
import {
  ChevronDown,
  ChevronUp,
  MessageSquare,
  ArrowRight,
  X,
  Copy,
  Check,
  Lock,
} from "lucide-react";
import {
  demoInvoices,
  demoCustomers,
  demoSingleBusiness,
} from "@/lib/demo-data/zentra-demo-data";
import type { Invoice } from "@/types/zentra";
import { rankCollectionActions } from "@/lib/collections/decision-engine";
import { buildCustomerBehaviourProfile } from "@/lib/collections/customer-behaviour";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtGBP(n: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency", currency: "GBP",
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(n);
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

type ActionMeta = {
  label: string;
  reason: string;
  urgency: "high" | "medium" | "low" | "blocked";
};

function getAction(inv: Invoice): ActionMeta {
  switch (inv.status) {
    case "missed_promise":
      return {
        label: "Follow up missed promise",
        reason: `Payment was promised for ${fmtDate(inv.promisedDate)} and hasn't arrived. Ask for a revised date.`,
        urgency: "high",
      };
    case "disputed":
      return {
        label: "Resolve dispute first",
        reason: inv.disputeReason
          ? `Active dispute: "${inv.disputeReason}". Do not demand payment until resolved.`
          : "Active dispute on this invoice. Address the query before chasing payment.",
        urgency: "blocked",
      };
    case "needs_ap_contact":
      return {
        label: "Find AP contact",
        reason: "No email address in your records for this customer. Locate the right contact before drafting.",
        urgency: "high",
      };
    case "overdue":
      return inv.chaseCount >= 2
        ? {
            label: "Send firm reminder",
            reason: `${inv.daysOverdue} days overdue with ${inv.chaseCount} prior chases. A firmer tone is appropriate.`,
            urgency: "high",
          }
        : {
            label: "Send first reminder",
            reason: `${inv.daysOverdue} days overdue. No prior chases — start with a polite prompt.`,
            urgency: "medium",
          };
    case "awaiting_remittance":
      return {
        label: "Request remittance advice",
        reason: "Customer says they've paid but no remittance has been received. Confirm and match to bank statement.",
        urgency: "medium",
      };
    case "awaiting_statement":
      return {
        label: "Send statement of account",
        reason: "Customer has requested a statement. Sending one often speeds up payment approval.",
        urgency: "medium",
      };
    case "promised":
      return {
        label: "Monitor — promise pending",
        reason: `Payment promised for ${fmtDate(inv.promisedDate)}. Chase only if the date passes.`,
        urgency: "low",
      };
    case "due_soon":
      return {
        label: "No action yet",
        reason: `Invoice due ${fmtDate(inv.dueDate)}. Monitor and chase if it becomes overdue.`,
        urgency: "low",
      };
    case "do_not_chase":
      return {
        label: "Excluded from chasing",
        reason: "This invoice has been manually excluded. No action required.",
        urgency: "blocked",
      };
    default:
      return {
        label: "No action",
        reason: "No collection action needed at this time.",
        urgency: "low",
      };
  }
}

const URGENCY_COLORS: Record<ActionMeta["urgency"], { color: string; bg: string }> = {
  high:    { color: "var(--zn-risk)",   bg: "var(--zn-risk-soft)" },
  medium:  { color: "var(--zn-warn)",   bg: "var(--zn-warn-soft)" },
  low:     { color: "var(--zn-ink-3)",  bg: "var(--zn-surface-2)" },
  blocked: { color: "var(--zn-ink-3)",  bg: "var(--zn-surface-2)" },
};

const URGENCY_ORDER: Record<ActionMeta["urgency"], number> = {
  high: 0, medium: 1, low: 2, blocked: 3,
};

function buildDraft(inv: Invoice, sender = demoSingleBusiness.senderName): string {
  const customer = demoCustomers.find((c) => c.id === inv.customerId);
  const contact = customer?.apContactName ?? customer?.name ?? "there";
  const amount = fmtGBP(inv.amountOutstanding);
  const due = fmtDate(inv.dueDate);

  switch (inv.status) {
    case "missed_promise":
      return `Subject: Follow-up: Invoice ${inv.invoiceNumber} — Promised Payment

Hi ${contact},

I'm following up on invoice ${inv.invoiceNumber} for ${amount}, due ${due}.

We had noted a payment commitment for ${fmtDate(inv.promisedDate)}, but we haven't yet received the funds or remittance advice.

Could you let me know if there's been a delay, or share a revised payment date? I want to make sure we can get this resolved promptly.

Many thanks,
${sender}
${demoSingleBusiness.name}`;

    case "overdue":
      if (inv.chaseCount >= 2) {
        return `Subject: Invoice ${inv.invoiceNumber} — ${inv.daysOverdue} Days Overdue

Hi ${contact},

I'm writing to follow up again on invoice ${inv.invoiceNumber} for ${amount}, which was due on ${due} and is now ${inv.daysOverdue} days overdue.

We've been in touch a couple of times and haven't yet received payment or a confirmed date. Could you please let me know when we can expect this to be settled?

If there's a query or issue I can help resolve, I'm happy to discuss.

Kind regards,
${sender}
${demoSingleBusiness.name}`;
      }
      return `Subject: Invoice ${inv.invoiceNumber} — Payment Reminder

Hi ${contact},

I hope you're well. I'm writing to follow up on invoice ${inv.invoiceNumber} for ${amount}, which was due on ${due}.

Could you let me know when we can expect payment, or if there's anything I can help clarify?

Many thanks,
${sender}
${demoSingleBusiness.name}`;

    case "missed_promise":
    case "awaiting_remittance":
      return `Subject: Invoice ${inv.invoiceNumber} — Remittance Advice Needed

Hi ${contact},

Thank you — we understand payment has been made for invoice ${inv.invoiceNumber} (${amount}).

We haven't yet received the funds in our account or a remittance note. Could you forward the payment confirmation or remittance advice so we can match this up?

Many thanks,
${sender}
${demoSingleBusiness.name}`;

    case "awaiting_statement":
      return `Subject: Statement of Account — ${demoSingleBusiness.name}

Hi ${contact},

As requested, please find below a summary of your current outstanding balance with ${demoSingleBusiness.name}.

Invoice ${inv.invoiceNumber} | Due: ${due} | Outstanding: ${amount}

Please let us know if you have any questions or if you'd like a formal PDF statement.

Kind regards,
${sender}
${demoSingleBusiness.name}`;

    default:
      return `Subject: Invoice ${inv.invoiceNumber} — Gentle Reminder

Hi ${contact},

Just a quick note regarding invoice ${inv.invoiceNumber} for ${amount}, due ${due}.

Please don't hesitate to get in touch if you have any questions.

Kind regards,
${sender}
${demoSingleBusiness.name}`;
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

const open = demoInvoices
  .filter((inv) => inv.status !== "paid" && (inv.amountOutstanding ?? inv.amount) > 0)
  .sort((a, b) => {
    const ua = getAction(a);
    const ub = getAction(b);
    const ou = URGENCY_ORDER[ua.urgency] - URGENCY_ORDER[ub.urgency];
    if (ou !== 0) return ou;
    return b.amountOutstanding - a.amountOutstanding;
  });

type DraftModal = { inv: Invoice; draft: string } | null;

export default function DemoChasePlanPage() {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [modal, setModal] = useState<DraftModal>(null);
  const [copied, setCopied] = useState(false);

  function toggleRow(id: string) {
    setExpanded((prev) => (prev === id ? null : id));
  }

  function openDraft(inv: Invoice) {
    setModal({ inv, draft: buildDraft(inv) });
    setCopied(false);
  }

  function copyDraft() {
    if (!modal) return;
    navigator.clipboard.writeText(modal.draft).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="zn-section-label">Demo · Working queue</p>
          <h1
            className="text-[28px] font-semibold tracking-[-0.02em] leading-[1.1] mt-1"
            style={{ color: "var(--zn-ink)" }}
          >
            Chase plan
          </h1>
          <p className="mt-1 text-[13.5px]" style={{ color: "var(--zn-ink-3)" }}>
            {open.length} open invoices · ranked by recommended action
          </p>
        </div>
        <Link
          href="/login?mode=signup"
          className="zn-pill"
        >
          Import your invoices <ArrowRight className="size-3.5" />
        </Link>
      </div>

      {/* Upload blocker notice */}
      <div
        className="flex items-center gap-3 rounded-[10px] px-4 py-3"
        style={{ background: "var(--zn-surface-2)", border: "1px solid var(--zn-line)" }}
      >
        <Lock className="size-4 shrink-0" style={{ color: "var(--zn-ink-3)" }} />
        <p className="text-[13px]" style={{ color: "var(--zn-ink-2)" }}>
          <strong>Demo only</strong> — you&apos;re viewing sample invoices.{" "}
          <Link href="/login?mode=signup" className="underline underline-offset-2 font-medium">
            Start a free trial
          </Link>{" "}
          to upload your own AR ageing file and get a real chase plan.
        </p>
      </div>

      {/* Smart insights — runs the live decision engine over the demo data */}
      <SmartInsightsCallout />

      {/* See what your customers see */}
      <Link
        href="/demo/portal"
        className="flex items-center justify-between gap-3 rounded-[10px] px-4 py-3 transition-colors hover:bg-[var(--zn-surface-2)]"
        style={{ background: "var(--zn-surface)", border: "1px solid var(--zn-line-soft)" }}
      >
        <div className="flex items-center gap-3">
          <MessageSquare className="size-4 shrink-0" style={{ color: "var(--zn-ink-3)" }} />
          <p className="text-[13px]" style={{ color: "var(--zn-ink-2)" }}>
            <strong>See what your customers see</strong> — preview the signed payment portal that ships with every chase.
          </p>
        </div>
        <ArrowRight className="size-3.5" style={{ color: "var(--zn-ink-3)" }} />
      </Link>

      {/* Table */}
      <div className="zn-card overflow-hidden">
        {/* Table header */}
        <div
          className="hidden sm:grid grid-cols-[1fr_auto_auto_140px_80px] gap-4 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.06em] border-b"
          style={{ color: "var(--zn-ink-3)", borderColor: "var(--zn-line-soft)", background: "var(--zn-bg-2)" }}
        >
          <span>Customer / Invoice</span>
          <span>Due</span>
          <span className="text-right">Amount</span>
          <span>Action</span>
          <span></span>
        </div>

        <div className="divide-y" style={{ borderColor: "var(--zn-line-soft)" }}>
          {open.map((inv) => {
            const action = getAction(inv);
            const colors = URGENCY_COLORS[action.urgency];
            const customer = demoCustomers.find((c) => c.id === inv.customerId);
            const isExpanded = expanded === inv.id;
            const canDraft = !["blocked"].includes(action.urgency) ||
              inv.status === "disputed"; // show "view draft" for disputes too, just as example

            return (
              <div key={inv.id}>
                {/* Row */}
                <button
                  type="button"
                  onClick={() => toggleRow(inv.id)}
                  className="w-full text-left grid grid-cols-1 sm:grid-cols-[1fr_auto_auto_140px_80px] gap-2 sm:gap-4 px-5 py-3.5 hover:bg-[var(--zn-surface-2)] transition-colors"
                >
                  {/* Customer + invoice */}
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium truncate" style={{ color: "var(--zn-ink)" }}>
                      {customer?.name ?? inv.customerName}
                    </p>
                    <p className="text-[11.5px] font-mono mt-0.5" style={{ color: "var(--zn-ink-3)" }}>
                      {inv.invoiceNumber}
                    </p>
                  </div>
                  {/* Due date */}
                  <div className="hidden sm:block text-[12.5px] self-center whitespace-nowrap" style={{ color: "var(--zn-ink-2)" }}>
                    {fmtDate(inv.dueDate)}
                  </div>
                  {/* Amount */}
                  <div className="hidden sm:block text-[13px] font-semibold tabular-nums text-right self-center" style={{ color: "var(--zn-ink)" }}>
                    {fmtGBP(inv.amountOutstanding)}
                  </div>
                  {/* Action badge */}
                  <div className="self-center">
                    <span
                      className="inline-block rounded-full px-2.5 py-0.5 text-[10.5px] font-semibold"
                      style={{ background: colors.bg, color: colors.color }}
                    >
                      {action.label}
                    </span>
                  </div>
                  {/* Expand */}
                  <div className="hidden sm:flex items-center justify-end self-center">
                    {isExpanded
                      ? <ChevronUp className="size-4" style={{ color: "var(--zn-ink-3)" }} />
                      : <ChevronDown className="size-4" style={{ color: "var(--zn-ink-3)" }} />
                    }
                  </div>
                </button>

                {/* Expanded detail */}
                {isExpanded && (
                  <div
                    className="px-5 pb-4 pt-1 border-t"
                    style={{ borderColor: "var(--zn-line-soft)", background: "var(--zn-surface-2)" }}
                  >
                    <div className="grid gap-4 sm:grid-cols-2">
                      {/* Reason */}
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.07em] mb-1.5" style={{ color: "var(--zn-ink-3)" }}>
                          Why this action
                        </p>
                        <p className="text-[13px] leading-relaxed" style={{ color: "var(--zn-ink-2)" }}>
                          {action.reason}
                        </p>
                        <div className="flex flex-wrap gap-3 mt-3 text-[11.5px]" style={{ color: "var(--zn-ink-3)" }}>
                          {inv.chaseCount > 0 && (
                            <span>{inv.chaseCount} prior chase{inv.chaseCount > 1 ? "s" : ""}</span>
                          )}
                          {inv.daysOverdue > 0 && (
                            <span>{inv.daysOverdue} days overdue</span>
                          )}
                          {customer?.apContactName && (
                            <span>Contact: {customer.apContactName}</span>
                          )}
                          {customer?.apContactEmail && (
                            <span>{customer.apContactEmail}</span>
                          )}
                        </div>
                      </div>

                      {/* Draft CTA */}
                      <div className="flex flex-col gap-2">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.07em] mb-1.5" style={{ color: "var(--zn-ink-3)" }}>
                          Draft message
                        </p>
                        {inv.status === "disputed" || inv.status === "do_not_chase" ? (
                          <div
                            className="rounded-[8px] px-3 py-2.5 text-[12.5px]"
                            style={{ background: "var(--zn-risk-soft)", color: "var(--zn-risk)" }}
                          >
                            <strong>Blocked:</strong>{" "}
                            {inv.status === "disputed"
                              ? "Resolve the dispute before drafting a chase message."
                              : "This invoice is excluded from chasing."}
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => openDraft(inv)}
                            className="inline-flex items-center gap-1.5 rounded-[9px] px-3.5 py-2 text-[12.5px] font-medium border transition-colors hover:bg-[var(--zn-surface)]"
                            style={{ borderColor: "var(--zn-line)", color: "var(--zn-ink-2)" }}
                          >
                            <MessageSquare className="size-3.5" />
                            View draft message
                          </button>
                        )}
                        <p className="text-[11px]" style={{ color: "var(--zn-ink-3)" }}>
                          In a real account, Zentra drafts this using AI and your brand voice.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Draft message modal */}
      {modal && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.4)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setModal(null); }}
        >
          <div
            className="zn-card w-full max-w-[560px] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div
              className="flex items-center justify-between px-5 py-3.5 border-b"
              style={{ borderColor: "var(--zn-line-soft)" }}
            >
              <div>
                <p className="text-[13px] font-semibold" style={{ color: "var(--zn-ink)" }}>
                  Draft message
                </p>
                <p className="text-[11.5px]" style={{ color: "var(--zn-ink-3)" }}>
                  {modal.inv.invoiceNumber} · {fmtGBP(modal.inv.amountOutstanding)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModal(null)}
                className="rounded-lg p-1.5 transition-colors hover:bg-[var(--zn-surface-2)]"
                style={{ color: "var(--zn-ink-3)" }}
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Draft text */}
            <div className="px-5 py-4">
              <pre
                className="text-[12.5px] leading-relaxed whitespace-pre-wrap font-sans rounded-[8px] p-4"
                style={{
                  background: "var(--zn-surface-2)",
                  color: "var(--zn-ink-2)",
                  border: "1px solid var(--zn-line-soft)",
                }}
              >
                {modal.draft}
              </pre>
            </div>

            {/* Actions */}
            <div
              className="flex items-center justify-between gap-3 px-5 py-3.5 border-t"
              style={{ borderColor: "var(--zn-line-soft)", background: "var(--zn-surface-2)" }}
            >
              <p className="text-[11.5px]" style={{ color: "var(--zn-ink-3)" }}>
                In your account, AI tailors this to your brand voice and customer history.
              </p>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={copyDraft}
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium border transition-colors hover:bg-[var(--zn-surface)]"
                  style={{ borderColor: "var(--zn-line)", color: "var(--zn-ink-2)" }}
                >
                  {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                  {copied ? "Copied!" : "Copy"}
                </button>
                <Link
                  href="/login?mode=signup"
                  className="zn-pill text-[12px]"
                  style={{ height: 32 }}
                >
                  Start trial <ArrowRight className="size-3" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Smart insights — live engine output on demo data ─────────────────────────

function SmartInsightsCallout() {
  // Build customer-behaviour profiles so the engine has full context
  const profiles = demoCustomers.map((c) => buildCustomerBehaviourProfile(c, demoInvoices));
  const plan = rankCollectionActions({
    invoices: demoInvoices,
    customers: demoCustomers,
    customerBehaviourProfiles: profiles,
  });
  const insights = plan
    .filter((item) => item.stopChasingInsight)
    .slice(0, 3);

  if (insights.length === 0) return null;

  return (
    <div
      className="rounded-[10px] px-4 py-3.5"
      style={{ background: "var(--zn-safe-soft)", border: "1px solid var(--zn-safe)" }}
    >
      <div className="flex items-baseline justify-between gap-3 mb-2.5">
        <p className="text-[11.5px] font-bold uppercase tracking-wider"
           style={{ color: "var(--zn-safe)" }}>
          Smart insights · Don&rsquo;t chase
        </p>
        <p className="text-[11px]" style={{ color: "var(--zn-ink-3)" }}>
          Live from the decision engine
        </p>
      </div>
      <ul className="space-y-1.5">
        {insights.map((item) => (
          <li key={item.id} className="text-[12.5px] leading-snug" style={{ color: "var(--zn-ink-2)" }}>
            <span className="font-medium" style={{ color: "var(--zn-ink)" }}>
              {item.customerName} ({item.invoiceNumber})
            </span>{" "}
            — {item.stopChasingInsight!.message}
          </li>
        ))}
      </ul>
    </div>
  );
}
