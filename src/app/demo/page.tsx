"use client";

/**
 * src/app/demo/page.tsx
 *
 * Zentra Collect — demo dashboard.
 * Standalone: all data hardcoded, no imports from @/lib or @/data.
 * DemoShell is applied by src/app/demo/layout.tsx — not needed here.
 */

import { useState } from "react";
import Link from "next/link";
import { X, ChevronRight, Copy, Mail, Phone } from "lucide-react";
import { DEMO_AR_CUSTOMERS } from "@/lib/demo-data/demo-ar-data";

// ─── Colour tokens ────────────────────────────────────────────────────────────
const C = {
  bg:        "var(--zn-bg)",
  card:      "var(--zn-surface)",
  surface2:  "var(--zn-surface-2)",
  ink:       "var(--zn-ink)",
  ink2:      "var(--zn-ink-2)",
  muted:     "var(--zn-ink-3)",
  border:    "var(--zn-line-soft)",
  green:     "var(--zn-safe)",
  amber:     "var(--zn-warn)",
  red:       "var(--zn-risk)",
  blue:      "var(--zn-info)",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtGBP(n: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

// ─── Data ─────────────────────────────────────────────────────────────────────
// Lookup map derived from the shared AR dataset — keeps drawer in sync with customers page
const CUSTOMERS = Object.fromEntries(
  DEMO_AR_CUSTOMERS.map((c) => [
    c.id,
    {
      name: c.name,
      contact: c.contact,
      email: c.email,
      relationship: `Client since ${c.since} · ${c.paidOnTime + c.paidLate} invoices`,
    },
  ])
) as Record<string, { name: string; contact: string; email: string; relationship: string }>;

interface Action {
  id: string;
  customer: keyof typeof CUSTOMERS;
  invoice: string;
  amount: number;
  daysOverdue: number;
  urgency: "red" | "amber" | "grey";
  suggested: string;
  reason: string;
  subject: string;
  body: string;
}

const ACTIONS: Action[] = [
  {
    id: "a1", customer: "oaktree", invoice: "INV-2026-0142", amount: 8400.00, daysOverdue: 47, urgency: "red",
    suggested: "Send final notice",
    reason: "47 days overdue. Two reminders sent and unanswered. Statutory pre-action protocol allows escalation to final notice with 7-day demand before issuing a county-court claim.",
    subject: "Final notice — Invoice INV-2026-0142, £8,400.00 overdue",
    body: `Dear Priya,\n\nDespite our reminders on 22 April and 6 May, invoice INV-2026-0142 dated 1 April 2026 for £8,400.00 remains unpaid. The invoice is now 47 days overdue.\n\nThis is a formal final notice. Unless full payment is received within 7 days of this letter (by 26 May 2026), we will commence recovery proceedings under the Late Payment of Commercial Debts (Interest) Act 1998. Statutory interest of 8.00% above the Bank of England base rate plus a £100 compensation fee may be added.\n\nPlease settle directly to the bank details on the invoice, or reply to discuss a payment plan.\n\nKind regards,\nHelen Carver\nFinance, Zentra Collect`,
  },
  {
    id: "a2", customer: "bluepeak", invoice: "INV-2026-0138", amount: 12250.00, daysOverdue: 23, urgency: "red",
    suggested: "Chase by email",
    reason: "23 days overdue and largest single exposure. Customer has paid late twice this year — recommend chasing now while still within first reminder cycle.",
    subject: "Reminder — Invoice INV-2026-0138 (£12,250.00)",
    body: `Hi Daniel,\n\nA friendly reminder that invoice INV-2026-0138 for £12,250.00, due on 26 April 2026, is now 23 days overdue.\n\nCould you confirm a payment date, or let me know if there is anything holding things up? Happy to resend the invoice or split it into two instalments if useful.\n\nBank details are on the original invoice or I can resend if helpful.\n\nThanks,\nHelen`,
  },
  {
    id: "a3", customer: "meridian", invoice: "INV-2026-0151", amount: 4800.00, daysOverdue: 14, urgency: "amber",
    suggested: "Log a call",
    reason: "14 days overdue. Customer has perfect payment history (14 on-time invoices). A phone call usually resolves these — likely an oversight.",
    subject: "Quick call about INV-2026-0151",
    body: `Hi Sarah,\n\nHope you're well. Wanted to drop a quick line — invoice INV-2026-0151 for £4,800.00 (due 5 May) is showing as outstanding.\n\nI'll give you a quick ring tomorrow morning if that's OK.\n\nBest,\nHelen`,
  },
  {
    id: "a4", customer: "bluepeak", invoice: "INV-2026-0147", amount: 3200.00, daysOverdue: 8, urgency: "amber",
    suggested: "Chase by email",
    reason: "First-reminder window. Send a polite nudge — most customers settle within 3 days of a first reminder.",
    subject: "Friendly reminder — INV-2026-0147",
    body: `Hi Daniel,\n\nJust a quick nudge on invoice INV-2026-0147 (£3,200.00) — it became due last week. Could you let me know when we can expect payment?\n\nThanks,\nHelen`,
  },
  {
    id: "a5", customer: "oaktree", invoice: "INV-2026-0149", amount: 2900.00, daysOverdue: 4, urgency: "grey",
    suggested: "Monitor",
    reason: "Only 4 days past due. Customer has paid 20 of 21 prior invoices; no action needed yet — recheck in 3 days.",
    subject: "", body: "",
  },
  {
    id: "a6", customer: "meridian", invoice: "INV-2026-0153", amount: 2350.00, daysOverdue: 2, urgency: "grey",
    suggested: "Monitor",
    reason: "Two days past due. Pattern matches Meridian's usual ~3-day delay around month-end payroll. Re-check on Friday.",
    subject: "", body: "",
  },
];

const ACTIVITY = [
  { id: "v1", type: "payment",  ts: "Today, 09:42",      who: "Meridian Studio",    text: "Payment received — £4,200.00 (INV-2026-0140)" },
  { id: "v2", type: "reply",    ts: "Today, 08:55",      who: "BluePeak Ltd",       text: "Daniel replied: \"Will process Friday\"" },
  { id: "v3", type: "promise",  ts: "Yesterday, 16:20",  who: "Oaktree Consulting", text: "Promise to pay logged — INV-2026-0142 by 22 May" },
  { id: "v4", type: "sent",     ts: "Yesterday, 11:08",  who: "BluePeak Ltd",       text: "Reminder sent — INV-2026-0138" },
  { id: "v5", type: "payment",  ts: "16 May, 14:12",     who: "Meridian Studio",    text: "Payment received — £6,750.00 (INV-2026-0136)" },
];

// Active-chase customers: those with open invoices that need follow-up
// (excludes Pemberton — legal escalation track — and Harrow — fully current)
const CHASE_IDS = ["bluepeak", "oaktree", "meridian"] as const;
const OUTSTANDING = CHASE_IDS.map((id) => {
  const c = DEMO_AR_CUSTOMERS.find((x) => x.id === id)!;
  return { cust: id, invoices: c.openInvoices, total: c.outstanding };
});

// KPI values derived from the active-chase set
const CHASE_CUSTOMERS = DEMO_AR_CUSTOMERS.filter((c) => (CHASE_IDS as readonly string[]).includes(c.id));
const DASH_TOTAL_OUTSTANDING = CHASE_CUSTOMERS.reduce((s, c) => s + c.outstanding, 0);
const DASH_OVERDUE_BALANCE   = CHASE_CUSTOMERS.reduce(
  (s, c) => s + c.invoices.filter((i) => i.overdue > 0).reduce((a, i) => a + i.amount, 0),
  0
);
const DASH_INVOICE_COUNT = CHASE_CUSTOMERS.reduce((s, c) => s + c.openInvoices, 0);

// ─── Sparkline ────────────────────────────────────────────────────────────────
const SPARKLINE_PRESETS = [
  [42, 55, 38, 70, 52, 84, 48, 60, 72, 56, 80, 65],
  [60, 45, 70, 35, 80, 55, 40, 75, 50, 85, 60, 72],
  [30, 65, 48, 78, 42, 58, 35, 72, 55, 68, 45, 80],
  [75, 50, 85, 40, 70, 55, 80, 45, 65, 78, 52, 68],
];

function Sparkline({ preset, color }: { preset: number; color: string }) {
  const bars = SPARKLINE_PRESETS[preset] ?? SPARKLINE_PRESETS[0];
  return (
    <div className="flex items-end gap-[1px] mt-3" style={{ height: 24 }}>
      {bars.map((h, i) => (
        <div
          key={i}
          style={{
            width: 2,
            height: `${h}%`,
            background: color,
            opacity: 0.25 + (i / bars.length) * 0.55,
            borderRadius: 1,
          }}
        />
      ))}
    </div>
  );
}

// ─── Urgency dot ──────────────────────────────────────────────────────────────
function UrgencyDot({ urgency, size = 8 }: { urgency: "red" | "amber" | "grey"; size?: number }) {
  const color = urgency === "red" ? C.red : urgency === "amber" ? C.amber : C.muted;
  return (
    <span
      style={{ width: size, height: size, borderRadius: "50%", background: color, display: "inline-block", flexShrink: 0 }}
    />
  );
}

// ─── Action pill ──────────────────────────────────────────────────────────────
function ActionPill({ action }: { action: Action }) {
  const { urgency, suggested } = action;
  const color   = urgency === "red" ? C.red   : urgency === "amber" ? C.amber : C.muted;
  const bgColor = urgency === "red" ? "var(--zn-risk-soft)" : urgency === "amber" ? "var(--zn-warn-soft)" : C.surface2;
  const icon =
    suggested === "Chase by email"    ? <Mail   size={10} /> :
    suggested === "Send final notice" ? <Mail   size={10} /> :
    suggested === "Log a call"        ? <Phone  size={10} /> :
    null;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-[3px] whitespace-nowrap"
      style={{ background: bgColor, color, fontSize: 11, fontWeight: 600 }}
    >
      <UrgencyDot urgency={urgency} size={6} />
      {icon}
      {suggested}
    </span>
  );
}

// ─── Activity dot ─────────────────────────────────────────────────────────────
function ActivityDot({ type }: { type: string }) {
  const color =
    type === "payment" ? C.green :
    type === "reply"   ? C.blue  :
    type === "promise" ? "#7C3AED" : /* purple kept as-is, no token */
    C.muted;
  return (
    <span
      style={{ width: 8, height: 8, borderRadius: "50%", background: color, display: "inline-block", flexShrink: 0, marginTop: 3 }}
    />
  );
}

// ─── Drawer ───────────────────────────────────────────────────────────────────
function ActionDrawer({ action, onClose }: { action: Action; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const cust = CUSTOMERS[action.customer];

  function handleCopy() {
    if (action.body) {
      navigator.clipboard.writeText(action.body).catch(() => {});
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  const urgencyColor = action.urgency === "red" ? C.red : action.urgency === "amber" ? C.amber : C.muted;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        style={{ background: "rgba(0,0,0,0.18)" }}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className="fixed top-0 right-0 bottom-0 z-50 flex flex-col"
        style={{
          width: "min(420px, 100vw)",
          background: C.card,
          borderLeft: `1px solid ${C.border}`,
          boxShadow: "-4px 0 24px rgba(0,0,0,0.08)",
        }}
      >
        {/* Drawer header */}
        <div
          className="flex items-start justify-between gap-3 px-5 pt-5 pb-4"
          style={{ borderBottom: `1px solid ${C.border}` }}
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <UrgencyDot urgency={action.urgency} size={9} />
              <span style={{ fontSize: 11, fontWeight: 700, color: urgencyColor, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {action.suggested}
              </span>
              <span style={{ fontSize: 11, color: C.muted }}>{action.invoice}</span>
            </div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: C.ink, letterSpacing: "-0.01em" }}>
              {cust.name}
            </h2>
            <p style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
              {cust.contact} · <a href={`mailto:${cust.email}`} style={{ color: C.blue, textDecoration: "none" }}>{cust.email}</a>
            </p>
            <p style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{cust.relationship}</p>
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 rounded-full p-1.5 transition-colors hover:bg-gray-100"
            style={{ color: C.muted }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

          {/* Summary grid */}
          <div
            className="grid grid-cols-3 gap-px rounded-xl overflow-hidden"
            style={{ background: C.border }}
          >
            {[
              { label: "Amount",   value: fmtGBP(action.amount),        color: C.ink  },
              { label: "Overdue",  value: `${action.daysOverdue} days`,  color: urgencyColor },
              { label: "Customer", value: cust.name,                     color: C.ink  },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ background: C.card, padding: "12px 14px" }}>
                <p style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4 }}>{label}</p>
                <p style={{ fontSize: 14, fontWeight: 700, color, fontVariantNumeric: "tabular-nums" }}>{value}</p>
              </div>
            ))}
          </div>

          {/* Reasoning */}
          <div>
            <p style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8, fontWeight: 600 }}>
              Reasoning
            </p>
            <div
              className="rounded-xl p-3.5"
              style={{ background: C.surface2, border: `1px solid ${C.border}` }}
            >
              <p style={{ fontSize: 13, color: C.ink2, lineHeight: 1.55 }}>{action.reason}</p>
            </div>
          </div>

          {/* Draft message or monitor notice */}
          {action.body ? (
            <div>
              <p style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8, fontWeight: 600 }}>
                Draft message
              </p>
              <div
                className="rounded-xl overflow-hidden"
                style={{ border: `1px solid ${C.border}` }}
              >
                {/* Meta */}
                <div style={{ padding: "10px 14px", borderBottom: `1px solid ${C.border}`, background: C.surface2 }}>
                  <p style={{ fontSize: 12, color: C.muted }}>
                    <span style={{ fontWeight: 600, color: C.ink }}>To:</span> {cust.contact} &lt;{cust.email}&gt;
                  </p>
                  <p style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>
                    <span style={{ fontWeight: 600, color: C.ink }}>Subject:</span> {action.subject}
                  </p>
                </div>
                {/* Editable body */}
                <textarea
                  defaultValue={action.body}
                  rows={10}
                  className="w-full resize-none focus:outline-none"
                  style={{
                    fontSize: 13,
                    color: C.ink2,
                    lineHeight: 1.6,
                    padding: "12px 14px",
                    background: C.card,
                    fontFamily: "inherit",
                  }}
                />
              </div>
            </div>
          ) : (
            <div
              className="rounded-xl p-4 text-center"
              style={{ background: C.surface2, border: `1px solid ${C.border}` }}
            >
              <p style={{ fontSize: 13, color: C.muted }}>No outreach needed yet.</p>
              <p style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>Check back when the invoice is older.</p>
            </div>
          )}

        </div>

        {/* Footer */}
        <div
          className="flex items-center gap-2 px-5 py-4"
          style={{ borderTop: `1px solid ${C.border}` }}
        >
          <button
            className="flex-1 rounded-full py-2 text-[13px] font-semibold transition-colors hover:bg-gray-50"
            style={{ border: `1px solid ${C.border}`, color: C.ink, fontSize: 13 }}
          >
            Save as draft
          </button>
          {action.body && (
            <>
              <button
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 transition-colors hover:bg-gray-50"
                style={{ border: `1px solid ${C.border}`, color: C.ink, fontSize: 13, fontWeight: 600 }}
              >
                <Copy size={13} />
                {copied ? "Copied!" : "Copy"}
              </button>
              <button
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-full py-2 font-semibold transition-opacity hover:opacity-90"
                style={{ background: C.ink, color: "#fff", fontSize: 13 }}
              >
                <Mail size={13} />
                Copy &amp; send
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function DemoDashboardPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedAction = ACTIONS.find((a) => a.id === selectedId) ?? null;
  const maxOutstanding = Math.max(...OUTSTANDING.map((o) => o.total));

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto" }}>

      {/* Page header */}
      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div>
          <h1
            style={{
              fontSize: 28,
              fontWeight: 600,
              letterSpacing: "-0.01em",
              color: C.ink,
              lineHeight: 1.15,
            }}
          >
            Good morning, Helen
          </h1>
          <p style={{ fontSize: 13.5, color: C.muted, marginTop: 4 }}>
            Monday, 19 May 2026 · 6 invoices need attention today
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="rounded-full px-4 py-2 text-[13px] font-semibold transition-colors hover:bg-black/5"
            style={{ border: `1px solid ${C.border}`, color: C.ink }}
          >
            Import statement
          </button>
          <button
            className="rounded-full px-4 py-2 text-[13px] font-semibold transition-colors hover:bg-black/5"
            style={{ border: `1px solid ${C.border}`, color: C.ink }}
          >
            Run reminders
          </button>
          <button
            className="rounded-full px-4 py-2 text-[13px] font-semibold transition-opacity hover:opacity-90"
            style={{ background: C.ink, color: "#fff" }}
          >
            New invoice
          </button>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {/* Total outstanding */}
        <div className="rounded-2xl p-4" style={{ background: C.card, border: `1px solid ${C.border}` }}>
          <p style={{ fontSize: 9.5, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em" }}>Total outstanding</p>
          <p style={{ fontSize: 24, fontWeight: 700, color: C.ink, fontVariantNumeric: "tabular-nums", marginTop: 6 }}>{fmtGBP(DASH_TOTAL_OUTSTANDING)}</p>
          <p style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{CHASE_CUSTOMERS.length} customers · {DASH_INVOICE_COUNT} invoices</p>
          <Sparkline preset={0} color={C.ink} />
        </div>
        {/* Overdue balance */}
        <div className="rounded-2xl p-4" style={{ background: C.card, border: `1px solid ${C.border}` }}>
          <p style={{ fontSize: 9.5, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em" }}>Overdue balance</p>
          <p style={{ fontSize: 24, fontWeight: 700, color: C.red, fontVariantNumeric: "tabular-nums", marginTop: 6 }}>{fmtGBP(DASH_OVERDUE_BALANCE)}</p>
          <p style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>6 invoices · +£8.4k this week</p>
          <Sparkline preset={1} color={C.red} />
        </div>
        {/* Avg days overdue */}
        <div className="rounded-2xl p-4" style={{ background: C.card, border: `1px solid ${C.border}` }}>
          <p style={{ fontSize: 9.5, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em" }}>Avg days overdue</p>
          <p style={{ fontSize: 24, fontWeight: 700, color: C.amber, fontVariantNumeric: "tabular-nums", marginTop: 6 }}>17 days</p>
          <p style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>Median 13 · Worst 47</p>
          <Sparkline preset={2} color={C.amber} />
        </div>
        {/* Promises kept */}
        <div className="rounded-2xl p-4" style={{ background: C.card, border: `1px solid ${C.border}` }}>
          <p style={{ fontSize: 9.5, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em" }}>Promises kept</p>
          <p style={{ fontSize: 24, fontWeight: 700, color: C.green, fontVariantNumeric: "tabular-nums", marginTop: 6 }}>7 of 9</p>
          <p style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>78% kept · Up 6 pts vs Apr</p>
          <Sparkline preset={3} color={C.green} />
        </div>
      </div>

      {/* Priority actions */}
      <div className="rounded-2xl overflow-hidden mb-5" style={{ background: C.card, border: `1px solid ${C.border}` }}>
        <div
          className="flex items-center justify-between px-5 py-3.5"
          style={{ borderBottom: `1px solid ${C.border}` }}
        >
          <div className="flex items-center gap-2">
            <p style={{ fontSize: 14, fontWeight: 600, color: C.ink }}>Today's priority actions</p>
            <span
              className="rounded-full px-2 py-0.5"
              style={{ fontSize: 11, fontWeight: 700, background: C.red, color: "#fff" }}
            >
              {ACTIONS.length}
            </span>
          </div>
          <button
            style={{ fontSize: 12, color: C.muted, fontWeight: 500 }}
            className="hover:underline underline-offset-2"
          >
            View all →
          </button>
        </div>

        <div>
          {ACTIONS.map((action) => {
            const cust = CUSTOMERS[action.customer];
            const isSelected = selectedId === action.id;
            const urgencyColor = action.urgency === "red" ? C.red : action.urgency === "amber" ? C.amber : C.muted;

            return (
              <button
                key={action.id}
                onClick={() => setSelectedId(isSelected ? null : action.id)}
                className="w-full text-left flex items-center gap-3 px-5 py-3 transition-colors"
                style={{
                  borderBottom: `1px solid ${C.border}`,
                  background: isSelected ? "var(--zn-surface-2)" : "transparent",
                  borderLeft: isSelected ? `2px solid ${C.ink}` : "2px solid transparent",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = "var(--zn-surface-2)"; }}
                onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = "transparent"; }}
              >
                {/* Urgency dot + customer info */}
                <div className="flex items-center gap-2.5 flex-1 min-w-0">
                  <UrgencyDot urgency={action.urgency} />
                  <div className="min-w-0">
                    <p style={{ fontSize: 13, fontWeight: 600, color: C.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {cust.name}
                    </p>
                    <p style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>
                      {action.invoice} · Due {action.daysOverdue} days ago
                    </p>
                  </div>
                </div>

                {/* Action pill — hidden on mobile */}
                <div className="hidden sm:block shrink-0">
                  <ActionPill action={action} />
                </div>

                {/* Days + amount */}
                <div className="shrink-0 text-right">
                  <p style={{ fontSize: 13, fontWeight: 700, color: urgencyColor, fontVariantNumeric: "tabular-nums" }}>
                    {action.daysOverdue}d
                  </p>
                  <p style={{ fontSize: 13, fontWeight: 600, color: C.ink, fontVariantNumeric: "tabular-nums" }}>
                    {fmtGBP(action.amount)}
                  </p>
                </div>

                {/* Chevron */}
                <ChevronRight size={15} style={{ color: C.muted, flexShrink: 0 }} />
              </button>
            );
          })}
        </div>
      </div>

      {/* Two-up row: Activity + Outstanding */}
      <div className="flex gap-4 flex-col lg:flex-row">

        {/* Activity — 60% */}
        <div
          className="rounded-2xl overflow-hidden flex-1"
          style={{ background: C.card, border: `1px solid ${C.border}`, minWidth: 0 }}
        >
          <div
            className="px-5 py-3.5"
            style={{ borderBottom: `1px solid ${C.border}` }}
          >
            <p style={{ fontSize: 14, fontWeight: 600, color: C.ink }}>Recent activity</p>
          </div>
          <div>
            {ACTIVITY.map((item) => (
              <div
                key={item.id}
                className="flex items-start gap-3 px-5 py-3"
                style={{ borderBottom: `1px solid ${C.border}` }}
              >
                <ActivityDot type={item.type} />
                <div className="flex-1 min-w-0">
                  <p style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>{item.who}</p>
                  <p style={{ fontSize: 12, color: C.ink2, marginTop: 1 }}>{item.text}</p>
                </div>
                <p style={{ fontSize: 11, color: C.muted, whiteSpace: "nowrap", flexShrink: 0 }}>{item.ts}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Outstanding by customer — 40% */}
        <div
          className="rounded-2xl overflow-hidden lg:w-[38%]"
          style={{ background: C.card, border: `1px solid ${C.border}` }}
        >
          <div
            className="px-5 py-3.5"
            style={{ borderBottom: `1px solid ${C.border}` }}
          >
            <p style={{ fontSize: 14, fontWeight: 600, color: C.ink }}>Outstanding by customer</p>
          </div>
          <div>
            {OUTSTANDING.map((row) => {
              const cust = CUSTOMERS[row.cust];
              const pct = Math.round((row.total / maxOutstanding) * 100);
              const totalAll = OUTSTANDING.reduce((s, o) => s + o.total, 0);
              const share = Math.round((row.total / totalAll) * 100);
              return (
                <div
                  key={row.cust}
                  className="px-5 py-3.5"
                  style={{ borderBottom: `1px solid ${C.border}` }}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>{cust.name}</p>
                      <p style={{ fontSize: 11, color: C.muted }}>{cust.contact} · {row.invoices} invoices</p>
                    </div>
                    <p style={{ fontSize: 14, fontWeight: 700, color: C.ink, fontVariantNumeric: "tabular-nums" }}>
                      {fmtGBP(row.total)}
                    </p>
                  </div>
                  {/* Bar */}
                  <div className="rounded-full overflow-hidden" style={{ height: 5, background: C.surface2 }}>
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, background: C.ink }}
                    />
                  </div>
                  <p style={{ fontSize: 10.5, color: C.muted, marginTop: 4 }}>{share}% of total</p>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* Action drawer */}
      {selectedAction && (
        <ActionDrawer action={selectedAction} onClose={() => setSelectedId(null)} />
      )}

    </div>
  );
}
