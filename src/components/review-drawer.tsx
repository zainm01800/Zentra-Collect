"use client";

/**
 * ReviewDrawer — the core product moment.
 * Action + reason + evidence + message + outcome.
 *
 * Behaviour: pinned to the right edge of the main content area.
 * The page content shifts left (via AppShell margin-right) to make room
 * rather than overlaying — so both are visible at once.
 */

import { useEffect, useMemo, useState } from "react";
import {
  Check,
  Copy,
  ExternalLink,
  Flag,
  Link2,
  Mail,
  Maximize2,
  Minimize2,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { PaymentLinkButton } from "@/components/payment-link-button";
import { checkAndCelebrate } from "@/components/celebration";
import { playSuccess, playTick } from "@/lib/sounds";
import { recordPayment } from "@/lib/invoice-store";
import type { PaymentRecord } from "@/lib/invoice-store";
import { useReview } from "@/components/review-context";
import { formatCurrency, formatDate } from "@/lib/formatters";
import {
  getCustomerProfile,
  getRecommendedTone,
  getRiskLabels,
  getSuggestedAction,
} from "@/lib/invoice-logic";
import {
  calculateStatutoryInterest,
  interestPhraseForChase,
  isInterestMaterial,
} from "@/lib/statutory-interest";
import type { Invoice, ReminderTone } from "@/types/cashpilot";

type Scenario =
  | "reminder"
  | "ask_date"
  | "promise"
  | "remit"
  | "statement"
  | "dispute"
  | "ap_contact"
  | "pre_action"
  | "escalate"
  | "hold";

const SCENARIOS: { key: Scenario; label: string }[] = [
  { key: "reminder",   label: "Send payment reminder" },
  { key: "ask_date",   label: "Ask for payment date" },
  { key: "promise",    label: "Follow up promise to pay" },
  { key: "remit",      label: "Request remittance advice" },
  { key: "statement",  label: "Send statement of account" },
  { key: "dispute",    label: "Respond to dispute" },
  { key: "ap_contact", label: "Ask for AP contact" },
  { key: "pre_action", label: "Pre-action notice" },
  { key: "escalate",   label: "Internal escalation" },
  { key: "hold",       label: "Do not chase" },
];

const TONES: ReminderTone[] = ["Friendly", "Neutral", "Firm", "Final notice"];

type Outcome = "sent" | "promised" | "paid" | "dispute" | "snooze";

const OUTCOMES: { k: Outcome; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { k: "sent",     label: "Sent",         Icon: Mail },
  { k: "promised", label: "Promised",     Icon: Flag },
  { k: "paid",     label: "Marked paid",  Icon: Check },
  { k: "dispute",  label: "Dispute",      Icon: X },
  { k: "snooze",   label: "Snooze",       Icon: Minimize2 },
];

// Tone shapes the greeting, body verbs, and signoff. Same scenario, four
// distinct messages — so changing the tone toggle visibly changes the draft.
const TONE_GREETING: Record<ReminderTone, string> = {
  Friendly:       "Hi there,",
  Neutral:        "Hi,",
  Firm:           "Hello,",
  "Final notice": "Hello,",
};

const TONE_SIGNOFF: Record<ReminderTone, string> = {
  Friendly:       "Thanks so much,",
  Neutral:        "Thanks,",
  Firm:           "Regards,",
  "Final notice": "Regards,",
};

// Subject prefix per tone — sets the customer's expectation in the inbox preview
const TONE_SUBJECT_PREFIX: Record<ReminderTone, string> = {
  Friendly:       "Quick reminder",
  Neutral:        "Payment reminder",
  Firm:           "Action required",
  "Final notice": "Final notice",
};

// A short closing line that varies by tone — added before the signoff for
// reminder-style scenarios to make the urgency feel right.
const TONE_CLOSER: Record<ReminderTone, string> = {
  Friendly:       "Appreciate it — let me know if I can help in any way.",
  Neutral:        "Please let me know when we can expect payment.",
  Firm:           "Please prioritise this and confirm a payment date.",
  "Final notice": "Please treat this as a final notice and confirm urgent settlement.",
};

function templateFor(
  scenario: Scenario,
  inv: Invoice,
  tone: ReminderTone,
): { subject: string; body: string; reason: string } {
  const ref = inv.invoiceNumber;
  const amount = formatCurrency(inv.amount);
  const due = formatDate(inv.dueDate);
  const days = inv.daysOverdue || 0;
  const customer = inv.customerName;
  const greet = TONE_GREETING[tone];
  const signoff = TONE_SIGNOFF[tone];

  switch (scenario) {
    case "reminder": {
      // Body opening adapts per tone
      const opener =
        tone === "Friendly" ? `Just a quick nudge — invoice ${ref} for ${amount} was due on ${due} and is now ${days} day${days === 1 ? "" : "s"} overdue.` :
        tone === "Neutral"  ? `I'm writing to follow up on invoice ${ref} (${amount}), which was due on ${due} and is now ${days} day${days === 1 ? "" : "s"} overdue.` :
        tone === "Firm"     ? `Invoice ${ref} for ${amount} was due on ${due} and is now ${days} day${days === 1 ? "" : "s"} overdue. We've yet to receive payment.` :
                              `Invoice ${ref} for ${amount} was due on ${due} and is now ${days} day${days === 1 ? "" : "s"} overdue. This invoice has not been settled despite earlier follow-ups.`;

      // Auto-include UK statutory interest phrase in Firm + Final-notice messages
      // for B2B invoices that are 14+ days overdue and have material interest accrued.
      // For Friendly/Neutral tones we keep the message lighter — interest is in the
      // collapsible panel for the user to add if they want.
      const includeInterest = (tone === "Firm" || tone === "Final notice") && days >= 14;
      const interestLine = includeInterest
        ? interestPhraseForChase(inv.amount, days)
        : null;
      const bodyParts = [greet, "", opener];
      if (interestLine) bodyParts.push("", interestLine);
      bodyParts.push("", TONE_CLOSER[tone], "", signoff);

      return {
        subject: `${TONE_SUBJECT_PREFIX[tone]}: invoice ${ref}`,
        body:    bodyParts.join("\n"),
        reason:  interestLine
          ? `${days}d overdue · firm cadence · statutory interest auto-included`
          : `${days}d overdue · no recent reply · standard reminder cadence`,
      };
    }
    case "ask_date": {
      const opener =
        tone === "Friendly" ? `Whenever you get a moment — could you share a likely date for payment of invoice ${ref} (${amount})? It's just easier on both sides than the back-and-forth.` :
        tone === "Neutral"  ? `Could you confirm a payment date for invoice ${ref} (${amount})? A clear date helps us plan and saves you repeated reminders.` :
        tone === "Firm"     ? `Please confirm a firm payment date for invoice ${ref} (${amount}). We'd prefer a clear date over further reminders.` :
                              `Please confirm an immediate payment date for invoice ${ref} (${amount}) so we can close this out.`;
      return {
        subject: tone === "Friendly" ? `Quick question on ${ref}` : `Payment date for ${ref}`,
        body:    `${greet}\n\n${opener}\n\n${signoff}`,
        reason:  `Customer typically late · asking for a date prevents repeated chases`,
      };
    }
    case "promise": {
      const opener =
        tone === "Friendly" ? `Thanks for confirming you'd settle ${ref} (${amount}). Just checking the payment's still on track for the date you mentioned — no rush, just want to keep our end tidy.` :
        tone === "Neutral"  ? `Following up on the payment of ${ref} (${amount}) which you'd confirmed for the date noted. Could you confirm whether it's been issued?` :
        tone === "Firm"     ? `Following up on your commitment to settle ${ref} (${amount}). Please confirm payment has been issued or share an updated date.` :
                              `${ref} for ${amount} was committed for payment but remains outstanding. Please confirm immediate settlement or this will need to be escalated.`;
      return {
        subject: tone === "Friendly" ? `Following up on payment for ${ref}` : `Promise to pay — ${ref}`,
        body:    `${greet}\n\n${opener}\n\n${signoff}`,
        reason:  `Promise on file · approaching the agreed date · soft check-in is safest`,
      };
    }
    case "remit": {
      const opener =
        tone === "Friendly" ? `It looks like ${ref} (${amount}) may have been paid on your end. Could you send the remittance advice so we can match it up?` :
        tone === "Neutral"  ? `Invoice ${ref} (${amount}) appears to have been paid but isn't showing matched on our side. Please send the remittance advice so we can reconcile.` :
        tone === "Firm"     ? `${ref} (${amount}) is recorded as paid on your side but unmatched on ours. Please send remittance advice promptly so we can confirm.` :
                              `${ref} (${amount}) is unaccounted for on our side. Please send the remittance advice immediately so this can be reconciled.`;
      return {
        subject: `Remittance advice — ${ref}`,
        body:    `${greet}\n\n${opener}\n\n${signoff}`,
        reason:  `Customer claims payment made · need remittance to reconcile`,
      };
    }
    case "statement": {
      const opener =
        tone === "Friendly" ? `Thought it'd be useful to share a statement of your account — currently showing ${amount} outstanding across open invoices.` :
        tone === "Neutral"  ? `Please find attached a statement of account for ${customer} showing ${amount} outstanding.` :
        tone === "Firm"     ? `Attached is the statement of account showing ${amount} outstanding. Please review and confirm payment plans for each open item.` :
                              `Attached is the statement of account showing ${amount} outstanding. Please confirm immediate payment for all overdue items.`;
      return {
        subject: `Statement of account — ${customer}`,
        body:    `${greet}\n\n${opener}\n\nLet me know if anything looks unexpected.\n\n${signoff}`,
        reason:  `Multiple open invoices · statement summarises the position cleanly`,
      };
    }
    case "dispute": {
      // Disputes should always lean diplomatic — even at "firm" we don't escalate
      const opener =
        tone === "Friendly" || tone === "Neutral"
          ? `Thanks for flagging the query on ${ref}. We'd like to get this resolved quickly — could you share the specific lines or amounts you'd like reviewed?`
          : `Thanks for raising the dispute on ${ref}. To resolve this, please share the specific lines or amounts in question and any supporting detail.`;
      return {
        subject: `Re: dispute on invoice ${ref}`,
        body:    `${greet}\n\n${opener}\n\nWe'll pause further reminders on this invoice until the query is resolved.\n\n${signoff}`,
        reason:  `Active dispute · acknowledge first, gather detail before any chase`,
      };
    }
    case "ap_contact": {
      const opener =
        tone === "Friendly" ? `Trying to make sure invoice ${ref} (${amount}) reaches the right team — could you point me to your accounts payable contact?` :
        tone === "Neutral"  ? `Could you confirm the best accounts payable contact for invoice ${ref} (${amount}) so we can route correspondence correctly?` :
        tone === "Firm"     ? `Please confirm the accounts payable contact for invoice ${ref} (${amount}). Routing this to the right person should help speed resolution.` :
                              `Please immediately confirm the accounts payable contact for invoice ${ref} (${amount}) so this can be settled without further delay.`;
      return {
        subject: `Best AP contact for ${ref}`,
        body:    `${greet}\n\n${opener}\n\n${signoff}`,
        reason:  `Contact unresponsive · routing to AP improves the reply rate`,
      };
    }
    case "pre_action": {
      // Formal pre-action notice — used after multiple chases when the user
      // wants the customer to engage before any further steps.
      //
      // Wording aligns with the UK Pre-Action Protocol for Debt Claims (2017):
      //   - References the invoice and amount clearly
      //   - States a 14-day response window
      //   - Invites the customer to engage / pay / dispute via a clear route
      //   - Avoids "we will sue you" language — uses "further steps" instead
      //
      // Always firm in tone regardless of the tone toggle. The disclaimer
      // reminds the user this is a template, not legal advice.
      const interestNote = days >= 14
        ? `\n\nStatutory interest and reasonable recovery costs may continue to accrue on the outstanding balance under the Late Payment of Commercial Debts (Interest) Act 1998 while it remains unpaid.`
        : "";
      const body =
        `${greet}\n\n` +
        `This is a formal pre-action notice regarding invoice ${ref} for ${amount}, originally due on ${due} and now ${days} day${days === 1 ? "" : "s"} overdue. The amount remains outstanding despite previous reminders.${interestNote}\n\n` +
        `Please arrange payment in full within 14 days of receipt of this notice. ` +
        `If you wish to dispute any element of the invoice, please reply with the specific items in dispute and any supporting evidence so we can resolve it. ` +
        `If you would like to propose a payment plan, please reply with proposed dates and amounts.\n\n` +
        `If we do not receive payment, a substantive response, or a reasonable payment proposal within 14 days, we will consider what further steps are available to recover the debt.\n\n` +
        `We would much prefer to resolve this directly with you. Please do reply.\n\n${signoff}`;
      return {
        subject: `Pre-action notice — invoice ${ref}`,
        body,
        reason: `Multiple chases without resolution · formal pre-action notice with 14-day response window (UK Pre-Action Protocol for Debt Claims)`,
      };
    }
    case "escalate":
      // Internal note — tone affects the urgency framing
      return {
        subject: `Internal: escalation on ${customer} / ${ref}`,
        body:
          tone === "Final notice"
            ? `${customer} has ${amount} outstanding on ${ref}, ${days}d overdue, no engagement and prior chases unanswered. Recommend immediate relationship-owner intervention before any further outbound.`
            : `${customer} has ${amount} outstanding on ${ref}, ${days}d overdue with no engagement. Suggest escalating to the relationship owner before the next outbound reminder.`,
        reason: `Multiple chases without response · escalate before tone hardens further`,
      };
    case "hold":
      return {
        subject: "",
        body: "",
        reason: `Marked do-not-chase: customer in resolution / executive freeze / sensitive context`,
      };
  }
}

const TONE_DEFAULT: Record<Scenario, ReminderTone> = {
  reminder: "Friendly",
  ask_date: "Neutral",
  promise: "Friendly",
  remit: "Neutral",
  statement: "Neutral",
  dispute: "Firm",
  ap_contact: "Neutral",
  pre_action: "Firm",
  escalate: "Firm",
  hold: "Neutral",
};

function safetyChecks(inv: Invoice) {
  const checks: { label: string; state: "safe" | "warn" | "block"; value: string }[] = [];
  checks.push({
    label: "Payment status",
    state: inv.status === "Paid" ? "block" : "safe",
    value: inv.status === "Paid" ? "Already paid" : "Not paid",
  });
  checks.push({
    label: "Active dispute",
    state: inv.status === "Disputed" ? "block" : "safe",
    value: inv.status === "Disputed" ? "Disputed" : "None",
  });
  checks.push({
    label: "Last chase",
    state: inv.lastChasedAt ? "warn" : "safe",
    value: inv.lastChasedAt ? formatDate(inv.lastChasedAt) : "Never",
  });
  checks.push({
    label: "Promise on file",
    state: inv.status === "Promised payment" ? "warn" : "safe",
    value: inv.status === "Promised payment" ? `Promised ${inv.promisedPaymentDate ? formatDate(inv.promisedPaymentDate) : "—"}` : "None",
  });
  return checks;
}

function whyBullets(inv: Invoice): string[] {
  const out: string[] = [];
  if (inv.daysOverdue > 60) out.push(`${inv.daysOverdue} days overdue — well beyond standard terms.`);
  else if (inv.daysOverdue > 30) out.push(`${inv.daysOverdue} days overdue — past usual chase point.`);
  else if (inv.daysOverdue > 0) out.push(`${inv.daysOverdue} days overdue — early reminder window.`);
  if (inv.relationshipType === "high-value client") out.push("High-value client — keep tone warm.");
  if (inv.relationshipType === "problematic payer") out.push("Customer pays late frequently — be specific about a date.");
  if (inv.chaseCount === 0) out.push("First chase — friendly tone recommended.");
  else if (inv.chaseCount >= 3) out.push(`${inv.chaseCount} chases already sent — escalate or change tactic.`);
  return out;
}

const StatusDot = ({ state }: { state: "safe" | "warn" | "block" }) => {
  const c =
    state === "safe" ? "var(--zn-safe)" :
    state === "warn" ? "var(--zn-warn)" :
                       "var(--zn-risk)";
  return <span style={{ width: 8, height: 8, borderRadius: 999, background: c, display: "inline-block", flexShrink: 0 }} />;
};

export function ReviewDrawer({ allInvoices }: { allInvoices: Invoice[] }) {
  const { current, close, isOpen, recordOutcome } = useReview();
  const [focusMode, setFocusMode] = useState(false);
  const [scenario, setScenario] = useState<Scenario>("reminder");
  const [tone, setTone] = useState<ReminderTone>("Friendly");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [copied, setCopied] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  // Payment capture — shown inline when "Marked paid" is selected
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState<PaymentRecord["paidMethod"]>("bank_transfer");
  const [paymentRef, setPaymentRef] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");

  // When a new invoice is opened, reset and seed scenario from suggestion
  useEffect(() => {
    if (!current) return;
    const suggestion = getSuggestedAction(current);
    const inferredScenario: Scenario =
      suggestion === "Call customer" ? "ask_date" :
      suggestion === "Resolve dispute before chasing" ? "dispute" :
      suggestion === "Confirm promised payment" ? "promise" :
      suggestion === "Send firm reminder" ? "reminder" :
      "reminder";
    setScenario(inferredScenario);
    setTone(getRecommendedTone(current));
    setOutcome(null);
    setPaymentRef("");
    setPaymentMethod("bank_transfer");
    setPaymentDate(new Date().toISOString().slice(0, 10));
    checkAndCelebrate("review");
  }, [current?.id]);

  // Esc to close
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, close]);

  // When the scenario changes, snap the tone back to its sensible default for
  // that scenario. Kept as a separate effect so it doesn't fight with the
  // tone-driven regeneration below (which would otherwise overwrite tone).
  useEffect(() => {
    setTone(TONE_DEFAULT[scenario]);
  }, [scenario]);

  // Re-seed subject + body whenever the scenario, the tone, or the invoice
  // changes. This is what makes the tone toggle feel alive — flip "Friendly"
  // → "Firm" and the message text actually rewrites.
  useEffect(() => {
    if (!current) return;
    const t = templateFor(scenario, current, tone);
    setSubject(t.subject);
    setBody(t.body);
  }, [scenario, tone, current?.id]);

  const tpl = current ? templateFor(scenario, current, tone) : null;
  const checks = useMemo(() => (current ? safetyChecks(current) : []), [current]);
  const bullets = useMemo(() => (current ? whyBullets(current) : []), [current]);
  const profile = useMemo(
    () => (current ? getCustomerProfile(allInvoices, current) : null),
    [current, allInvoices],
  );
  const risks = useMemo(() => (current ? getRiskLabels(current) : []), [current]);

  const handleCopy = () => {
    if (!subject && !body) return;
    navigator.clipboard?.writeText(`Subject: ${subject}\n\n${body}`).catch(() => {});
    playTick();
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const handleOutcome = (k: Outcome) => {
    setOutcome(k);
    if (k === "paid") {
      // Pre-fill amount from the invoice; user can adjust before confirming
      if (current) setPaymentAmount(String(current.amount ?? ""));
      setPaymentDate(new Date().toISOString().slice(0, 10));
      // Don't fire celebration yet — wait for confirmPayment()
    } else {
      recordOutcome(k);
      playTick();
      if (k === "sent") checkAndCelebrate("chase");
      if (k === "promised") checkAndCelebrate("chase");
    }
  };

  const confirmPayment = () => {
    if (!current) return;
    const amount = parseFloat(paymentAmount) || current.amount;
    const payment: PaymentRecord = {
      paidAt: paymentDate,
      paidAmount: amount,
      paidMethod: paymentMethod,
      paidReference: paymentRef.trim() || undefined,
    };
    recordPayment(current.id, payment);
    recordOutcome("paid");
    playSuccess();
    checkAndCelebrate("paid");
  };

  // Width strategy:
  //   focus mode → fill the content area edge-to-edge
  //   default    → 460px, but never wider than the viewport allows
  const width = focusMode
    ? "calc(100vw - 232px - 48px)"
    : "min(460px, calc(100vw - 32px))";

  return (
    <aside
      className="fixed top-4 bottom-4 z-50 flex flex-col"
      style={{
        right: isOpen ? 16 : -520,
        width,
        maxWidth: "calc(100vw - 32px)",
        background: "var(--zn-surface)",
        border: "1px solid var(--zn-line)",
        borderRadius: 14,
        boxShadow:
          "0 1px 0 rgba(29,24,19,0.04), 0 24px 64px -24px rgba(29,24,19,0.30)",
        transition:
          "right 320ms cubic-bezier(0.32, 0.72, 0, 1), width 280ms ease",
        opacity: isOpen ? 1 : 0,
        pointerEvents: isOpen ? "auto" : "none",
      }}
      aria-hidden={!isOpen}
    >
      {!current ? null : (
        <>
          {/* Header */}
          <div
            className="flex items-start justify-between gap-3"
            style={{ padding: "14px 18px", borderBottom: "1px solid var(--zn-line-soft)" }}
          >
            <div className="flex flex-col min-w-0 flex-1">
              <div className="zn-label !p-0">Review</div>
              <div className="text-[15px] font-semibold text-[#1d1813] dark:text-[#f0e8d5] truncate mt-0.5">
                {current.customerName}
              </div>
              <div className="text-[11.5px] mt-0.5" style={{ color: "var(--zn-ink-3)" }}>
                {current.invoiceNumber} · {formatCurrency(current.amount)}
                {current.daysOverdue > 0 ? ` · ${current.daysOverdue}d overdue` : ""}
              </div>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                type="button"
                onClick={() => setFocusMode((v) => !v)}
                className="size-7 inline-flex items-center justify-center rounded-md border transition-colors hover:bg-[#f3ecd8] dark:hover:bg-[#2d2820]"
                style={{ borderColor: "var(--zn-line-soft)", color: "var(--zn-ink-3)" }}
                title={focusMode ? "Compact" : "Focus mode"}
                aria-label={focusMode ? "Exit focus mode" : "Enter focus mode"}
              >
                {focusMode ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
              </button>
              <button
                type="button"
                onClick={close}
                className="size-7 inline-flex items-center justify-center rounded-md border transition-colors hover:bg-[#f3ecd8] dark:hover:bg-[#2d2820]"
                style={{ borderColor: "var(--zn-line-soft)", color: "var(--zn-ink-3)" }}
                title="Close"
                aria-label="Close review drawer"
              >
                <X className="size-3.5" />
              </button>
            </div>
          </div>

          {/* Body — scrollable */}
          <div className="flex flex-col gap-4 overflow-auto flex-1" style={{ padding: "16px 18px" }}>

            {/* Recommended action card */}
            <div
              className="rounded-[12px] p-3.5"
              style={{
                background: "var(--zn-surface-2)",
                border: "1px solid var(--zn-line)",
              }}
            >
              <div className="flex flex-wrap items-center gap-1.5 mb-2">
                <span
                  className="zn-chip"
                  style={{
                    background: "var(--zn-accent)",
                    color: "var(--zn-accent-ink)",
                    borderColor: "transparent",
                  }}
                >
                  <Sparkles className="size-3" /> Recommended
                </span>
                <span className="zn-chip">High confidence</span>
                <span className="zn-chip">Review required</span>
              </div>
              <div
                className="text-[19px] leading-tight"
                style={{
                  fontFamily: "var(--font-newsreader), ui-serif, Georgia, serif",
                  fontWeight: 500,
                  color: "var(--zn-ink)",
                }}
              >
                {SCENARIOS.find((s) => s.key === scenario)?.label}
              </div>
              <div className="text-[12.5px] mt-1.5" style={{ color: "var(--zn-ink-3)" }}>
                {tpl?.reason}
              </div>
            </div>

            {/* Why this action */}
            <div>
              <div className="zn-label !p-0 mb-2">Why this action</div>
              <ul className="flex flex-col gap-1.5" style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {bullets.length ? bullets.map((b, i) => (
                  <li key={i} className="flex items-start gap-2 text-[12.5px]" style={{ color: "var(--zn-ink)" }}>
                    <Check className="size-3.5 flex-shrink-0 mt-0.5" style={{ color: "var(--zn-accent)" }} />
                    <span>{b}</span>
                  </li>
                )) : (
                  <li className="text-[12.5px]" style={{ color: "var(--zn-ink-3)" }}>
                    No notable signals — standard recommendation.
                  </li>
                )}
              </ul>
            </div>

            {/* Safety checks */}
            <div>
              <div className="zn-label !p-0 mb-2">Safety checks</div>
              <div className="flex flex-col gap-1">
                {checks.map((s, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded-[8px] px-2.5 py-2"
                    style={{
                      background: "var(--zn-surface)",
                      border: "1px solid var(--zn-line-soft)",
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <StatusDot state={s.state} />
                      <span className="text-[12.5px]">{s.label}</span>
                    </div>
                    <span className="text-[11.5px]" style={{ color: "var(--zn-ink-3)" }}>
                      {s.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Statutory interest — only when material (≥ £5 accrued) */}
            {current && isInterestMaterial(current.amount, current.daysOverdue) && (
              <StatutoryInterestPanel invoice={current} />
            )}

            {/* Action scenario picker */}
            <div>
              <div className="zn-label !p-0 mb-2">Action scenario</div>
              <select
                value={scenario}
                onChange={(e) => setScenario(e.target.value as Scenario)}
                className="w-full rounded-[10px] border px-3 py-2 text-[13px] outline-none"
                style={{
                  background: "var(--zn-surface)",
                  borderColor: "var(--zn-line)",
                  color: "var(--zn-ink)",
                }}
              >
                {SCENARIOS.map((s) => (
                  <option key={s.key} value={s.key}>{s.label}</option>
                ))}
              </select>
            </div>

            {/* Tone */}
            <div>
              <div className="zn-label !p-0 mb-2">Tone</div>
              <div
                className="inline-flex gap-0.5 rounded-full p-[3px]"
                style={{
                  background: "var(--zn-surface)",
                  border: "1px solid var(--zn-line)",
                }}
              >
                {TONES.map((t) => {
                  const active = tone === t;
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTone(t)}
                      className="zn-pill"
                      style={{
                        height: 24,
                        fontSize: 11.5,
                        padding: "0 10px",
                        background: active ? "var(--zn-ink)" : "transparent",
                        color: active ? "var(--zn-surface)" : "var(--zn-ink-2)",
                        border: 0,
                      }}
                    >
                      {t}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Draft message */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="zn-label !p-0">Draft message</div>
                <span className="zn-kind-tag">Template · {scenario}</span>
              </div>
              {scenario === "hold" ? (
                <div
                  className="rounded-[10px] p-3 text-[12.5px] leading-relaxed"
                  style={{
                    background: "var(--zn-surface-2)",
                    border: "1px solid var(--zn-line-soft)",
                    color: "var(--zn-ink-2)",
                  }}
                >
                  No message will be sent. This invoice will be marked do-not-chase
                  and removed from the working queue.
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="rounded-[10px] border px-3 py-2 text-[13px] outline-none"
                    style={{
                      background: "var(--zn-surface)",
                      borderColor: "var(--zn-line)",
                      color: "var(--zn-ink)",
                    }}
                  />
                  <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    rows={9}
                    className="rounded-[10px] border px-3 py-2 text-[13px] leading-relaxed outline-none resize-y"
                    style={{
                      background: "var(--zn-surface)",
                      borderColor: "var(--zn-line)",
                      color: "var(--zn-ink)",
                      fontFamily: "var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif",
                      minHeight: 180,
                    }}
                  />
                </div>
              )}
              {scenario !== "hold" ? (
                <div className="flex flex-col gap-2 mt-2.5">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCopy}
                      className="zn-pill flex-1 justify-center"
                    >
                      {copied ? (
                        <>
                          <Check className="size-3.5" /> Copied
                        </>
                      ) : (
                        <>
                          <Copy className="size-3.5" /> Copy message
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      className="zn-pill zn-pill-ghost"
                      onClick={() => {
                        if (!current) return;
                        const t = templateFor(scenario, current, tone);
                        setSubject(t.subject);
                        setBody(t.body);
                      }}
                    >
                      <Sparkles className="size-3.5" /> Regenerate
                    </button>
                  </div>
                  {/* Open draft in email client */}
                  {(subject || body) && (
                    <div className="flex items-center gap-2">
                      <a
                        href={`mailto:${current?.customerEmail ?? ""}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="zn-pill zn-pill-ghost flex-1 justify-center text-[12px]"
                        title="Opens your default mail app with this draft pre-filled"
                      >
                        <Mail className="size-3.5" /> Open in mail app
                      </a>
                      <a
                        href={`https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(current?.customerEmail ?? "")}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="zn-pill zn-pill-ghost flex-1 justify-center text-[12px]"
                        title="Opens Gmail in a new tab with this draft pre-filled"
                      >
                        <ExternalLink className="size-3.5" /> Open in Gmail
                      </a>
                    </div>
                  )}
                </div>
              ) : null}

              {/* Payment link — inject a Stripe pay-now URL into the draft */}
              {current && ["reminder", "ask_date", "pre_action"].includes(scenario) && (
                <PaymentLinkButton
                  invoiceRef={current.invoiceNumber ?? "INV"}
                  clientName={current.customerName}
                  amountOutstanding={(current as unknown as { amountOutstanding?: number }).amountOutstanding ?? current.amount ?? 0}
                  currency="gbp"
                  onInsert={(url) => setBody((b) => `${b}\n\nPay online: ${url}`)}
                />
              )}
            </div>

            {/* Outcome */}
            <div>
              <div className="zn-label !p-0 mb-2">Record outcome</div>
              <div className="flex flex-wrap gap-1.5">
                {OUTCOMES.map(({ k, label, Icon }) => {
                  const active = outcome === k;
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => handleOutcome(k)}
                      className="zn-pill active:scale-95 transition-transform"
                      style={{
                        height: 28,
                        fontSize: 12,
                        padding: "0 12px",
                        background: active ? "var(--zn-ink)" : "transparent",
                        color: active ? "var(--zn-surface)" : "var(--zn-ink-2)",
                        border: active ? 0 : "1px solid var(--zn-line)",
                      }}
                    >
                      <Icon className="size-3.5" /> {label}
                    </button>
                  );
                })}
              </div>
              {outcome === "paid" ? (
                <div
                  className="mt-3 rounded-xl p-3 flex flex-col gap-2"
                  style={{ background: "var(--zn-safe-soft)", border: "1px solid var(--zn-safe)" }}
                >
                  <p className="text-[11px] font-semibold uppercase tracking-[0.1em]" style={{ color: "var(--zn-safe)" }}>
                    Confirm payment details
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="block">
                      <span className="text-[10.5px] font-medium block mb-1" style={{ color: "var(--zn-ink-3)" }}>Date received</span>
                      <input
                        type="date"
                        value={paymentDate}
                        onChange={(e) => setPaymentDate(e.target.value)}
                        className="w-full rounded-lg border px-2 py-1.5 text-[12.5px] outline-none"
                        style={{ background: "var(--zn-surface)", borderColor: "var(--zn-line)", color: "var(--zn-ink)" }}
                      />
                    </label>
                    <label className="block">
                      <span className="text-[10.5px] font-medium block mb-1" style={{ color: "var(--zn-ink-3)" }}>Amount received</span>
                      <input
                        type="number"
                        step="0.01"
                        value={paymentAmount}
                        onChange={(e) => setPaymentAmount(e.target.value)}
                        className="w-full rounded-lg border px-2 py-1.5 text-[12.5px] outline-none"
                        style={{ background: "var(--zn-surface)", borderColor: "var(--zn-line)", color: "var(--zn-ink)" }}
                      />
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="block">
                      <span className="text-[10.5px] font-medium block mb-1" style={{ color: "var(--zn-ink-3)" }}>Method</span>
                      <select
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value as PaymentRecord["paidMethod"])}
                        className="w-full rounded-lg border px-2 py-1.5 text-[12.5px] outline-none"
                        style={{ background: "var(--zn-surface)", borderColor: "var(--zn-line)", color: "var(--zn-ink)" }}
                      >
                        <option value="bank_transfer">Bank transfer</option>
                        <option value="card">Card</option>
                        <option value="direct_debit">Direct debit</option>
                        <option value="cheque">Cheque</option>
                        <option value="cash">Cash</option>
                        <option value="other">Other</option>
                      </select>
                    </label>
                    <label className="block">
                      <span className="text-[10.5px] font-medium block mb-1" style={{ color: "var(--zn-ink-3)" }}>Reference (optional)</span>
                      <input
                        type="text"
                        value={paymentRef}
                        onChange={(e) => setPaymentRef(e.target.value)}
                        placeholder="e.g. BACS ref"
                        className="w-full rounded-lg border px-2 py-1.5 text-[12.5px] outline-none"
                        style={{ background: "var(--zn-surface)", borderColor: "var(--zn-line)", color: "var(--zn-ink)" }}
                      />
                    </label>
                  </div>
                  <button
                    type="button"
                    onClick={confirmPayment}
                    className="zn-pill w-full justify-center active:scale-95 transition-transform"
                    style={{ background: "var(--zn-safe)", color: "#fff" }}
                  >
                    <Check className="size-3.5" /> Confirm payment received
                  </button>
                </div>
              ) : outcome ? (
                <div className="text-[11.5px] mt-2" style={{ color: "var(--zn-ink-3)" }}>
                  Outcome logged
                </div>
              ) : null}
            </div>

            {/* Customer context */}
            <div>
              <div className="zn-label !p-0 mb-2">Customer context</div>
              <div
                className="rounded-[10px] p-3"
                style={{
                  background: "var(--zn-surface)",
                  border: "1px solid var(--zn-line-soft)",
                }}
              >
                <div className="flex items-center justify-between mb-2.5">
                  <div className="text-[13px] font-semibold text-[#1d1813] dark:text-[#f0e8d5]">
                    {current.customerName}
                  </div>
                  {risks.length ? (
                    <span className="zn-kind-tag" style={{ fontSize: 9.5 }}>
                      {risks[0]}
                    </span>
                  ) : null}
                </div>
                <div className="grid grid-cols-2 gap-y-1 gap-x-3 text-[12px]">
                  <div style={{ color: "var(--zn-ink-3)" }}>Outstanding</div>
                  <div className="font-medium tabular-nums">{formatCurrency(profile?.totalOutstanding ?? 0)}</div>
                  <div style={{ color: "var(--zn-ink-3)" }}>Avg days late</div>
                  <div className="font-medium tabular-nums">{profile?.averageDaysLate ?? 0}d</div>
                  <div style={{ color: "var(--zn-ink-3)" }}>Open invoices</div>
                  <div className="font-medium">{(profile?.invoiceCount ?? 0) - (profile?.paidCount ?? 0)}</div>
                  <div style={{ color: "var(--zn-ink-3)" }}>Relationship</div>
                  <div className="font-medium">{current.relationshipType}</div>
                </div>
              </div>
            </div>

            {/* Activity timeline */}
            <div>
              <div className="zn-label !p-0 mb-2">Activity</div>
              {current.activityHistory.length === 0 ? (
                <div
                  className="rounded-[10px] p-3 text-[12px]"
                  style={{
                    background: "var(--zn-surface-2)",
                    border: "1px solid var(--zn-line-soft)",
                    color: "var(--zn-ink-3)",
                  }}
                >
                  No activity yet. Outcomes you record here will appear in the timeline.
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {current.activityHistory.map((event) => (
                    <div
                      key={event.id}
                      className="flex gap-3 rounded-[10px] p-2.5"
                      style={{
                        background: "var(--zn-surface-2)",
                        border: "1px solid var(--zn-line-soft)",
                      }}
                    >
                      <span
                        className="size-1.5 rounded-full mt-1.5 flex-shrink-0"
                        style={{ background: "var(--zn-accent)" }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-[12.5px] font-semibold text-[#1d1813] dark:text-[#f0e8d5]">
                          {event.title}
                        </div>
                        <div className="text-[11.5px] text-[#6b6253] dark:text-[#8a7d69] mt-0.5">
                          {event.description}
                        </div>
                        <div
                          className="text-[10.5px] mt-1"
                          style={{
                            color: "var(--zn-ink-3)",
                            fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
                          }}
                        >
                          {formatDate(event.createdAt)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Human review reminder */}
            <div
              className="rounded-[10px] p-3 flex items-start gap-2"
              style={{
                background: "var(--zn-surface-2)",
                border: "1px solid var(--zn-line-soft)",
              }}
            >
              <ShieldCheck
                className="size-3.5 flex-shrink-0 mt-0.5"
                style={{ color: "var(--zn-safe)" }}
              />
              <p className="text-[11.5px] leading-relaxed" style={{ color: "var(--zn-ink-3)" }}>
                Zentra drafts and recommends. <strong style={{ color: "var(--zn-ink-2)" }}>You</strong> review and send. Nothing goes out automatically.
              </p>
            </div>
          </div>
        </>
      )}
    </aside>
  );
}

// ── Statutory interest panel ──────────────────────────────────────────────────

/**
 * Surfaces UK statutory late-payment interest accrued on this invoice
 * (Late Payment of Commercial Debts (Interest) Act 1998). Includes a copy
 * button so users can paste the phrasing straight into their chase message.
 *
 * Only rendered when ≥ £5 of interest has accrued — below that it's noise.
 */
function StatutoryInterestPanel({ invoice }: { invoice: Invoice }) {
  const [copied, setCopied] = useState(false);
  const result = useMemo(
    () => calculateStatutoryInterest(invoice.amount, invoice.daysOverdue),
    [invoice.amount, invoice.daysOverdue],
  );
  const phrase = useMemo(
    () => interestPhraseForChase(invoice.amount, invoice.daysOverdue),
    [invoice.amount, invoice.daysOverdue],
  );

  function copyPhrase() {
    if (!phrase) return;
    navigator.clipboard?.writeText(phrase).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div>
      <div className="zn-label !p-0 mb-2">Statutory interest accrued</div>
      <div
        className="rounded-[10px] p-3"
        style={{
          background: "var(--zn-warn-soft)",
          border: "1px solid var(--zn-warn)",
        }}
      >
        <div className="grid grid-cols-3 gap-2 mb-2">
          <div>
            <div className="text-[10px] uppercase tracking-[0.08em] font-semibold" style={{ color: "var(--zn-ink-3)" }}>
              Interest
            </div>
            <div className="text-[14.5px] font-semibold tabular-nums mt-0.5" style={{ color: "var(--zn-ink)" }}>
              {formatCurrency(result.interest)}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.08em] font-semibold" style={{ color: "var(--zn-ink-3)" }}>
              Compensation
            </div>
            <div className="text-[14.5px] font-semibold tabular-nums mt-0.5" style={{ color: "var(--zn-ink)" }}>
              {formatCurrency(result.compensation)}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.08em] font-semibold" style={{ color: "var(--zn-ink-3)" }}>
              Total recoverable
            </div>
            <div className="text-[14.5px] font-semibold tabular-nums mt-0.5" style={{ color: "var(--zn-ink)" }}>
              {formatCurrency(result.totalRecoverable)}
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 pt-2" style={{ borderTop: "1px solid rgba(160, 117, 34, 0.2)" }}>
          <p className="text-[11px] leading-4 flex-1" style={{ color: "var(--zn-ink-2)" }}>
            B2B only · Rate {result.annualRate}% (BoE base + 8%) · This is a calculator, not legal advice.
          </p>
          {phrase && (
            <button
              type="button"
              onClick={copyPhrase}
              className="flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-md whitespace-nowrap"
              style={{
                background: "var(--zn-surface)",
                border: "1px solid var(--zn-line)",
                color: copied ? "var(--zn-safe)" : "var(--zn-ink-2)",
              }}
            >
              {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
              {copied ? "Copied" : "Copy phrase"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
