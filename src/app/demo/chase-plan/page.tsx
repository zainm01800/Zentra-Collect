"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import {
  Bell,
  BellOff,
  CheckCircle2,
  MessageSquare,
  ArrowRight,
  X,
  Copy,
  Check,
  Lock,
  Sparkles,
  Search,
  ChevronDown,
  ChevronUp,
  FileText,
} from "lucide-react";
import dynamic from "next/dynamic";
const DemoAiDrafter = dynamic(
  () => import("@/components/demo-ai-drafter").then((m) => m.DemoAiDrafter),
  { ssr: false },
);
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
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  });
}

type Urgency = "high" | "medium" | "low" | "blocked";
type ActionMeta = { label: string; reason: string; urgency: Urgency };

function getAction(inv: Invoice): ActionMeta {
  switch (inv.status) {
    case "missed_promise":
      return {
        label: "Follow up missed promise",
        reason: `Payment was promised for ${fmtDate(inv.promisedPaymentDate)} and hasn't arrived. Ask for a revised date.`,
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
      return inv.previousChaseCount >= 2
        ? {
            label: "Send firm reminder",
            reason: `${inv.daysOverdue} days overdue with ${inv.previousChaseCount} prior chases. A firmer tone is appropriate.`,
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
        reason: `Payment promised for ${fmtDate(inv.promisedPaymentDate)}. Chase only if the date passes.`,
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

const URGENCY_STYLE: Record<Urgency, { color: string; bg: string }> = {
  high:    { color: "var(--zn-risk)",  bg: "var(--zn-risk-soft)" },
  medium:  { color: "var(--zn-warn)",  bg: "var(--zn-warn-soft)" },
  low:     { color: "var(--zn-ink-3)", bg: "var(--zn-surface-2)" },
  blocked: { color: "var(--zn-ink-3)", bg: "var(--zn-surface-2)" },
};

const URGENCY_ORDER: Record<Urgency, number> = { high: 0, medium: 1, low: 2, blocked: 3 };

type FilterTab = "all" | "action" | "monitoring" | "blocked";

const FILTER_URGENCY: Record<FilterTab, Urgency[] | null> = {
  all:        null,
  action:     ["high", "medium"],
  monitoring: ["low"],
  blocked:    ["blocked"],
};

function buildDraft(inv: Invoice, sender = demoSingleBusiness.senderName): string {
  const customer = demoCustomers.find((c) => c.id === inv.customerId);
  const contact  = customer?.apContactName ?? customer?.name ?? "there";
  const amount   = fmtGBP(inv.amountOutstanding);
  const due      = fmtDate(inv.dueDate);

  switch (inv.status) {
    case "missed_promise":
      return `Subject: Follow-up: Invoice ${inv.invoiceNumber} — Promised Payment\n\nHi ${contact},\n\nI'm following up on invoice ${inv.invoiceNumber} for ${amount}, due ${due}.\n\nWe had noted a payment commitment${inv.promisedPaymentDate ? ` for ${fmtDate(inv.promisedPaymentDate)}` : " you previously confirmed"}, but we haven't yet received the funds or remittance advice.\n\nCould you let me know if there's been a delay, or share a revised payment date?\n\nMany thanks,\n${sender}\n${demoSingleBusiness.name}`;
    case "overdue":
      if (inv.previousChaseCount >= 2) {
        return `Subject: Invoice ${inv.invoiceNumber} — ${inv.daysOverdue} Days Overdue\n\nHi ${contact},\n\nI'm writing to follow up again on invoice ${inv.invoiceNumber} for ${amount}, which was due on ${due} and is now ${inv.daysOverdue} days overdue.\n\nWe've been in touch a couple of times and haven't yet received payment or a confirmed date. Could you please let me know when we can expect this to be settled?\n\nKind regards,\n${sender}\n${demoSingleBusiness.name}`;
      }
      return `Subject: Invoice ${inv.invoiceNumber} — Payment Reminder\n\nHi ${contact},\n\nI hope you're well. I'm writing to follow up on invoice ${inv.invoiceNumber} for ${amount}, which was due on ${due}.\n\nCould you let me know when we can expect payment, or if there's anything I can help clarify?\n\nMany thanks,\n${sender}\n${demoSingleBusiness.name}`;
    case "awaiting_remittance":
      return `Subject: Invoice ${inv.invoiceNumber} — Remittance Advice Needed\n\nHi ${contact},\n\nThank you — we understand payment has been made for invoice ${inv.invoiceNumber} (${amount}).\n\nWe haven't yet received the funds in our account or a remittance note. Could you forward the payment confirmation or remittance advice so we can match this up?\n\nMany thanks,\n${sender}\n${demoSingleBusiness.name}`;
    case "awaiting_statement":
      return `Subject: Statement of Account — ${demoSingleBusiness.name}\n\nHi ${contact},\n\nAs requested, please find below a summary of your current outstanding balance.\n\nInvoice ${inv.invoiceNumber} | Due: ${due} | Outstanding: ${amount}\n\nPlease let us know if you have any questions.\n\nKind regards,\n${sender}\n${demoSingleBusiness.name}`;
    default:
      return `Subject: Invoice ${inv.invoiceNumber} — Gentle Reminder\n\nHi ${contact},\n\nJust a quick note regarding invoice ${inv.invoiceNumber} for ${amount}, due ${due}.\n\nPlease don't hesitate to get in touch if you have any questions.\n\nKind regards,\n${sender}\n${demoSingleBusiness.name}`;
  }
}

// Pre-sorted list of all open invoices
const open = demoInvoices
  .filter((inv) => inv.status !== "paid" && (inv.amountOutstanding ?? inv.amount) > 0)
  .sort((a, b) => {
    const ou = URGENCY_ORDER[getAction(a).urgency] - URGENCY_ORDER[getAction(b).urgency];
    return ou !== 0 ? ou : b.amountOutstanding - a.amountOutstanding;
  });

type DraftModal = { inv: Invoice; draft: string } | null;

// ── Detail panel content (shared by desktop panel + mobile expand) ────────────

function InvoiceDetail({
  inv,
  isSnoozed,
  isReplied,
  onToggleSnoozed,
  onToggleReplied,
  onOpenDraft,
  onOpenAi,
}: {
  inv: Invoice;
  isSnoozed: boolean;
  isReplied: boolean;
  onToggleSnoozed: () => void;
  onToggleReplied: () => void;
  onOpenDraft: () => void;
  onOpenAi: () => void;
}) {
  const action   = getAction(inv);
  const customer = demoCustomers.find((c) => c.id === inv.customerId);
  const colors   = URGENCY_STYLE[action.urgency];
  const blocked  = inv.status === "disputed" || inv.status === "do_not_chase";

  return (
    <div className="space-y-5">
      {/* Invoice header */}
      <div>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-[17px] font-semibold tracking-[-0.01em]" style={{ color: "var(--zn-ink)" }}>
              {customer?.name ?? inv.customerName}
            </h2>
            <p className="text-[12px] font-mono mt-0.5" style={{ color: "var(--zn-ink-3)" }}>
              {inv.invoiceNumber}
            </p>
          </div>
          <span
            className="shrink-0 inline-block rounded-full px-2.5 py-1 text-[11px] font-semibold"
            style={{ background: colors.bg, color: colors.color }}
          >
            {action.label}
          </span>
        </div>

        {/* Key stats */}
        <div className="grid grid-cols-3 gap-3 mt-4">
          {[
            { label: "Outstanding", value: fmtGBP(inv.amountOutstanding) },
            { label: "Due date",    value: fmtDate(inv.dueDate) },
            { label: "Overdue",     value: inv.daysOverdue > 0 ? `${inv.daysOverdue} days` : "Not yet" },
          ].map(({ label, value }) => (
            <div key={label}
              className="rounded-[8px] px-3 py-2.5"
              style={{ background: "var(--zn-surface-2)", border: "1px solid var(--zn-line-soft)" }}
            >
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.06em] mb-0.5" style={{ color: "var(--zn-ink-3)" }}>{label}</p>
              <p className="text-[13px] font-semibold tabular-nums" style={{ color: "var(--zn-ink)" }}>{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Why this action */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.07em] mb-1.5" style={{ color: "var(--zn-ink-3)" }}>
          Why this action
        </p>
        <p className="text-[13px] leading-relaxed" style={{ color: "var(--zn-ink-2)" }}>
          {action.reason}
        </p>
        {/* Meta chips */}
        <div className="flex flex-wrap gap-2 mt-2.5">
          {inv.previousChaseCount > 0 && (
            <span className="rounded-full px-2.5 py-0.5 text-[11px]"
              style={{ background: "var(--zn-surface-2)", color: "var(--zn-ink-3)", border: "1px solid var(--zn-line-soft)" }}>
              {inv.previousChaseCount} prior chase{inv.previousChaseCount > 1 ? "s" : ""}
            </span>
          )}
          {customer?.apContactName && (
            <span className="rounded-full px-2.5 py-0.5 text-[11px]"
              style={{ background: "var(--zn-surface-2)", color: "var(--zn-ink-3)", border: "1px solid var(--zn-line-soft)" }}>
              {customer.apContactName}
            </span>
          )}
          {customer?.apEmail && (
            <span className="rounded-full px-2.5 py-0.5 text-[11px]"
              style={{ background: "var(--zn-surface-2)", color: "var(--zn-ink-3)", border: "1px solid var(--zn-line-soft)" }}>
              {customer.apEmail}
            </span>
          )}
        </div>
      </div>

      {/* Draft message */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.07em] mb-2" style={{ color: "var(--zn-ink-3)" }}>
          Draft message
        </p>
        {blocked ? (
          <div className="rounded-[8px] px-3 py-2.5 text-[12.5px]"
            style={{ background: "var(--zn-risk-soft)", color: "var(--zn-risk)" }}>
            <strong>Blocked</strong> —{" "}
            {inv.status === "disputed"
              ? "Resolve the dispute before drafting a chase."
              : "This invoice is excluded from chasing."}
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onOpenDraft}
              className="inline-flex items-center gap-1.5 rounded-[9px] px-3.5 py-2 text-[12.5px] font-medium border transition-colors hover:bg-[var(--zn-surface)]"
              style={{ borderColor: "var(--zn-line)", color: "var(--zn-ink-2)" }}
            >
              <MessageSquare className="size-3.5" />
              Template draft
            </button>
            <button
              type="button"
              onClick={onOpenAi}
              className="inline-flex items-center gap-1.5 rounded-[9px] px-3.5 py-2 text-[12.5px] font-medium transition-colors"
              style={{ background: "var(--zn-ink)", color: "var(--zn-bg)" }}
            >
              <Sparkles className="size-3.5" />
              AI draft (demo)
            </button>
          </div>
        )}
        <p className="text-[11px] mt-1.5" style={{ color: "var(--zn-ink-3)" }}>
          AI demo uses sample output — no API call. Real product drafts in your brand voice.
        </p>
      </div>

      {/* Row actions */}
      <div className="flex flex-wrap gap-2 pt-4 border-t" style={{ borderColor: "var(--zn-line-soft)" }}>
        <button
          type="button"
          onClick={onToggleReplied}
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium border transition-colors"
          style={{
            borderColor: isReplied ? "var(--zn-safe)" : "var(--zn-line)",
            color:       isReplied ? "var(--zn-safe)" : "var(--zn-ink-2)",
            background:  isReplied ? "var(--zn-safe-soft)" : "transparent",
          }}
        >
          <CheckCircle2 className="size-3.5" />
          {isReplied ? "Reply received ✓" : "Mark as replied"}
        </button>
        <button
          type="button"
          onClick={onToggleSnoozed}
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium border transition-colors"
          style={{
            borderColor: "var(--zn-line)",
            color: isSnoozed ? "var(--zn-warn)" : "var(--zn-ink-2)",
          }}
        >
          {isSnoozed ? <Bell className="size-3.5" /> : <BellOff className="size-3.5" />}
          {isSnoozed ? "Unsnoozed" : "Snooze 7 days"}
        </button>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DemoChasePlanPage() {
  const [selectedId,     setSelectedId]     = useState<string | null>(null);
  const [mobileExpanded, setMobileExpanded] = useState<string | null>(null);
  const [search,         setSearch]         = useState("");
  const [filterTab,      setFilterTab]      = useState<FilterTab>("all");
  const [modal,          setModal]          = useState<DraftModal>(null);
  const [copied,         setCopied]         = useState(false);
  const [aiInvoice,      setAiInvoice]      = useState<Invoice | null>(null);
  const [snoozed,        setSnoozed]        = useState<Set<string>>(new Set());
  const [replied,        setReplied]        = useState<Set<string>>(new Set());

  // Auto-select the first invoice on desktop on first render
  useEffect(() => {
    if (open.length > 0) setSelectedId(open[0].id);
  }, []);

  const q = search.toLowerCase();
  const filtered = useMemo(() => {
    const urgencyFilter = FILTER_URGENCY[filterTab];
    return open.filter((inv) => {
      const customer = demoCustomers.find((c) => c.id === inv.customerId);
      const name = (customer?.name ?? inv.customerName).toLowerCase();
      if (q && !name.includes(q) && !inv.invoiceNumber.toLowerCase().includes(q)) return false;
      if (urgencyFilter && !urgencyFilter.includes(getAction(inv).urgency)) return false;
      return true;
    });
  }, [q, filterTab]);

  const tabCounts = useMemo(() => ({
    all:        open.length,
    action:     open.filter((i) => { const u = getAction(i).urgency; return u === "high" || u === "medium"; }).length,
    monitoring: open.filter((i) => getAction(i).urgency === "low").length,
    blocked:    open.filter((i) => getAction(i).urgency === "blocked").length,
  }), []);

  // selectedId may point to an invoice not in `filtered` (different filter applied)
  // — always resolve from the full `open` list so the panel stays populated.
  const selectedInv = selectedId ? (open.find((i) => i.id === selectedId) ?? null) : null;

  function toggleSnoozed(id: string) {
    setSnoozed((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function toggleReplied(id: string) {
    setReplied((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function openDraft(inv: Invoice) { setModal({ inv, draft: buildDraft(inv) }); setCopied(false); }
  function copyDraft() {
    if (!modal) return;
    navigator.clipboard.writeText(modal.draft).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  }

  const TABS: { key: FilterTab; label: string }[] = [
    { key: "all",        label: "All" },
    { key: "action",     label: "Needs action" },
    { key: "monitoring", label: "Monitoring" },
    { key: "blocked",    label: "Blocked" },
  ];

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="zn-section-label">Demo chase plan</p>
          <h1 className="text-[28px] font-semibold tracking-[-0.02em] leading-[1.1] mt-1" style={{ color: "var(--zn-ink)" }}>
            Chase plan
          </h1>
          <p className="mt-1 text-[13.5px]" style={{ color: "var(--zn-ink-3)" }}>
            {open.length} open invoices · ranked by recommended action
          </p>
        </div>
        <Link href="/login?mode=signup" className="zn-pill">
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
          <Link href="/login?mode=signup" className="underline underline-offset-2 font-medium">Start a free trial</Link>
          {" "}to upload your own AR ageing file and get a real chase plan.
        </p>
      </div>

      {/* Smart insights */}
      <SmartInsightsCallout />

      {/* Portal preview */}
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
        <ArrowRight className="size-3.5 shrink-0" style={{ color: "var(--zn-ink-3)" }} />
      </Link>

      {/* ── Filter bar ── */}
      <div className="flex flex-col sm:flex-row gap-2.5">
        {/* Search */}
        <div className="relative flex-1 max-w-[320px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 pointer-events-none" style={{ color: "var(--zn-ink-3)" }} />
          <input
            type="text"
            placeholder="Search customer or invoice…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-[12.5px] rounded-[9px] border outline-none transition-colors"
            style={{
              background: "var(--zn-surface)",
              borderColor: "var(--zn-line)",
              color: "var(--zn-ink)",
            }}
          />
        </div>
        {/* Filter tabs */}
        <div
          className="flex gap-1 p-1 rounded-[10px]"
          style={{ background: "var(--zn-surface-2)", border: "1px solid var(--zn-line-soft)" }}
        >
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilterTab(key)}
              className="rounded-[7px] px-3 py-1.5 text-[12px] font-medium transition-colors whitespace-nowrap"
              style={{
                background: filterTab === key ? "var(--zn-surface)"  : "transparent",
                color:      filterTab === key ? "var(--zn-ink)"      : "var(--zn-ink-3)",
                boxShadow:  filterTab === key ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
              }}
            >
              {label}
              <span
                className="ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
                style={{
                  background: filterTab === key ? "var(--zn-surface-2)" : "transparent",
                  color: "var(--zn-ink-3)",
                }}
              >
                {tabCounts[key]}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Two-column layout ── */}
      <div className="lg:grid lg:grid-cols-[380px_1fr] lg:gap-5 lg:items-start">

        {/* ── LEFT: invoice list ── */}
        <div
          className="zn-card overflow-hidden lg:sticky lg:top-6 lg:flex lg:flex-col"
          style={{ maxHeight: "calc(100vh - 200px)" }}
        >
          {/* Table column headers — desktop */}
          <div
            className="hidden sm:grid grid-cols-[1fr_48px_80px_120px] gap-3 px-4 py-2.5 text-[10.5px] font-semibold uppercase tracking-[0.06em] border-b shrink-0"
            style={{ color: "var(--zn-ink-3)", borderColor: "var(--zn-line-soft)", background: "var(--zn-bg-2)" }}
          >
            <span>Customer / Invoice</span>
            <span className="text-right">Overdue</span>
            <span className="text-right">Amount</span>
            <span>Action</span>
          </div>

          {/* No results */}
          {filtered.length === 0 && (
            <div className="px-5 py-10 text-center">
              <FileText className="size-8 mx-auto mb-2 opacity-20" />
              <p className="text-[13px]" style={{ color: "var(--zn-ink-3)" }}>No invoices match this filter.</p>
            </div>
          )}

          {/* Rows */}
          <div className="divide-y overflow-y-auto flex-1" style={{ borderColor: "var(--zn-line-soft)" }}>
            {filtered.map((inv) => {
              const action       = getAction(inv);
              const colors       = URGENCY_STYLE[action.urgency];
              const customer     = demoCustomers.find((c) => c.id === inv.customerId);
              const isSelected   = selectedId === inv.id;
              const isMobExpand  = mobileExpanded === inv.id;
              const isSnoozed    = snoozed.has(inv.id);
              const isReplied    = replied.has(inv.id);

              const badgeLabel = isReplied ? "Reply received ✓" : isSnoozed ? "Snoozed 7d" : action.label;
              const badgeColor = isReplied
                ? { color: "var(--zn-safe)", bg: "var(--zn-safe-soft)" }
                : isSnoozed
                ? { color: "var(--zn-warn)", bg: "var(--zn-warn-soft)" }
                : colors;

              return (
                <div key={inv.id}>
                  <button
                    type="button"
                    onClick={() => {
                      // Desktop: select for right panel. Mobile: toggle inline expand.
                      setSelectedId(isSelected ? null : inv.id);
                      setMobileExpanded(isMobExpand ? null : inv.id);
                    }}
                    className="w-full text-left transition-colors"
                    style={{
                      background: isSelected ? "var(--zn-surface-2)" : "transparent",
                      borderLeft: isSelected ? "2px solid var(--zn-accent)" : "2px solid transparent",
                    }}
                  >
                    {/* Desktop row */}
                    <div className="hidden sm:grid grid-cols-[1fr_48px_80px_120px] gap-3 px-4 py-3 hover:bg-[var(--zn-surface-2)] transition-colors">
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium truncate" style={{ color: "var(--zn-ink)" }}>
                          {customer?.name ?? inv.customerName}
                        </p>
                        <p className="text-[11px] font-mono mt-0.5" style={{ color: "var(--zn-ink-3)" }}>
                          {inv.invoiceNumber}
                        </p>
                      </div>
                      <div className="text-right self-center">
                        {inv.daysOverdue > 0 ? (
                          <span className="text-[12px] font-semibold tabular-nums" style={{ color: action.urgency === "high" ? "var(--zn-risk)" : "var(--zn-warn)" }}>
                            {inv.daysOverdue}d
                          </span>
                        ) : (
                          <span className="text-[12px]" style={{ color: "var(--zn-ink-3)" }}>—</span>
                        )}
                      </div>
                      <div className="text-right self-center text-[12.5px] font-semibold tabular-nums" style={{ color: "var(--zn-ink)" }}>
                        {fmtGBP(inv.amountOutstanding)}
                      </div>
                      <div className="self-center">
                        <span
                          className="inline-block rounded-full px-2 py-0.5 text-[10.5px] font-semibold truncate max-w-full"
                          style={{ background: badgeColor.bg, color: badgeColor.color }}
                        >
                          {badgeLabel}
                        </span>
                      </div>
                    </div>

                    {/* Mobile row */}
                    <div className="flex sm:hidden items-center justify-between gap-3 px-4 py-3 hover:bg-[var(--zn-surface-2)] transition-colors">
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-medium truncate" style={{ color: "var(--zn-ink)" }}>
                          {customer?.name ?? inv.customerName}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <p className="text-[11px] font-mono" style={{ color: "var(--zn-ink-3)" }}>
                            {inv.invoiceNumber}
                          </p>
                          {inv.daysOverdue > 0 && (
                            <span className="text-[11px] font-medium" style={{ color: "var(--zn-risk)" }}>
                              · {inv.daysOverdue}d overdue
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[12.5px] font-semibold tabular-nums" style={{ color: "var(--zn-ink)" }}>
                          {fmtGBP(inv.amountOutstanding)}
                        </p>
                        <span
                          className="inline-block mt-0.5 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                          style={{ background: badgeColor.bg, color: badgeColor.color }}
                        >
                          {badgeLabel}
                        </span>
                      </div>
                      {isMobExpand
                        ? <ChevronUp className="size-4 shrink-0" style={{ color: "var(--zn-ink-3)" }} />
                        : <ChevronDown className="size-4 shrink-0" style={{ color: "var(--zn-ink-3)" }} />
                      }
                    </div>
                  </button>

                  {/* Mobile inline expand */}
                  {isMobExpand && (
                    <div
                      className="sm:hidden px-4 pb-5 pt-2 border-t"
                      style={{ borderColor: "var(--zn-line-soft)", background: "var(--zn-surface-2)" }}
                    >
                      <InvoiceDetail
                        inv={inv}
                        isSnoozed={isSnoozed}
                        isReplied={isReplied}
                        onToggleSnoozed={() => toggleSnoozed(inv.id)}
                        onToggleReplied={() => toggleReplied(inv.id)}
                        onOpenDraft={() => openDraft(inv)}
                        onOpenAi={() => setAiInvoice(inv)}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── RIGHT: detail panel (desktop only) ── */}
        <div className="hidden lg:block lg:sticky lg:top-6">
          {selectedInv ? (
            <div
              className="zn-card p-5 relative"
              style={{ maxHeight: "calc(100vh - 200px)", overflowY: "auto" }}
            >
              {/* Close button */}
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="absolute top-4 right-4 rounded-lg p-1.5 transition-colors hover:bg-[var(--zn-surface-2)]"
                style={{ color: "var(--zn-ink-3)" }}
              >
                <X className="size-4" />
              </button>
              <InvoiceDetail
                inv={selectedInv}
                isSnoozed={snoozed.has(selectedInv.id)}
                isReplied={replied.has(selectedInv.id)}
                onToggleSnoozed={() => toggleSnoozed(selectedInv.id)}
                onToggleReplied={() => toggleReplied(selectedInv.id)}
                onOpenDraft={() => openDraft(selectedInv)}
                onOpenAi={() => setAiInvoice(selectedInv)}
              />
            </div>
          ) : (
            <div
              className="zn-card flex flex-col items-center justify-center py-16 text-center"
              style={{ minHeight: 300 }}
            >
              <FileText className="size-10 mb-3 opacity-20" />
              <p className="text-[14px] font-medium" style={{ color: "var(--zn-ink-2)" }}>Select an invoice</p>
              <p className="text-[12.5px] mt-1" style={{ color: "var(--zn-ink-3)" }}>
                Click any row to see the reason, contact, and draft message.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Draft message modal ── */}
      {modal && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.4)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setModal(null); }}
        >
          <div className="zn-card w-full max-w-[560px] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3.5 border-b" style={{ borderColor: "var(--zn-line-soft)" }}>
              <div>
                <p className="text-[13px] font-semibold" style={{ color: "var(--zn-ink)" }}>Draft message</p>
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
            <div className="px-5 py-4">
              <pre
                className="text-[12.5px] leading-relaxed whitespace-pre-wrap font-sans rounded-[8px] p-4"
                style={{ background: "var(--zn-surface-2)", color: "var(--zn-ink-2)", border: "1px solid var(--zn-line-soft)" }}
              >
                {modal.draft}
              </pre>
            </div>
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
                <Link href="/login?mode=signup" className="zn-pill text-[12px]" style={{ height: 32 }}>
                  Start trial <ArrowRight className="size-3" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI drafter */}
      {aiInvoice && (
        <DemoAiDrafter
          open={true}
          onClose={() => setAiInvoice(null)}
          customerName={aiInvoice.customerName}
          invoiceNumber={aiInvoice.invoiceNumber}
          amount={fmtGBP(aiInvoice.amountOutstanding)}
          daysOverdue={Math.max(0, aiInvoice.daysOverdue)}
        />
      )}
    </div>
  );
}

// ── Smart insights ────────────────────────────────────────────────────────────

function SmartInsightsCallout() {
  const profiles = demoCustomers.map((c) => buildCustomerBehaviourProfile(c, demoInvoices));
  const plan = rankCollectionActions({
    invoices: demoInvoices,
    customers: demoCustomers,
    customerBehaviourProfiles: profiles,
  });
  const insights = plan.filter((i) => i.stopChasingInsight).slice(0, 3);
  if (insights.length === 0) return null;

  return (
    <div className="rounded-[10px] px-4 py-3.5" style={{ background: "var(--zn-safe-soft)", border: "1px solid var(--zn-safe)" }}>
      <div className="flex items-baseline justify-between gap-3 mb-2.5">
        <p className="text-[11.5px] font-bold uppercase tracking-wider" style={{ color: "var(--zn-safe)" }}>
          Smart insights · Don&rsquo;t chase
        </p>
        <p className="text-[11px]" style={{ color: "var(--zn-ink-3)" }}>Live from the decision engine</p>
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
