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
  Flag,
  Mail,
  Maximize2,
  Minimize2,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { useReview } from "@/components/review-context";
import { formatCurrency, formatDate } from "@/lib/formatters";
import {
  getCustomerProfile,
  getRecommendedTone,
  getRiskLabels,
  getSuggestedAction,
} from "@/lib/invoice-logic";
import type { Invoice, ReminderTone } from "@/types/cashpilot";

type Scenario =
  | "reminder"
  | "ask_date"
  | "promise"
  | "remit"
  | "statement"
  | "dispute"
  | "ap_contact"
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

function templateFor(scenario: Scenario, inv: Invoice): { subject: string; body: string; reason: string } {
  const ref = inv.invoiceNumber;
  const amount = formatCurrency(inv.amount);
  const due = formatDate(inv.dueDate);
  const days = inv.daysOverdue || 0;
  const customer = inv.customerName;

  switch (scenario) {
    case "reminder":
      return {
        subject: `Friendly reminder: invoice ${ref}`,
        body: `Hi,\n\nJust a friendly nudge that invoice ${ref} for ${amount} was due on ${due} and is now ${days} day${days === 1 ? "" : "s"} overdue.\n\nCould you let me know when we can expect payment?\n\nThanks,\n${customer}`,
        reason: `${days}d overdue · no recent reply · standard reminder cadence`,
      };
    case "ask_date":
      return {
        subject: `Quick question on ${ref}`,
        body: `Hi,\n\nCould you give me a date when we can expect payment of invoice ${ref} (${amount})?\n\nWe'd rather have a clear date than chase repeatedly — thanks for understanding.\n\nBest,`,
        reason: `Customer typically late · asking for a date prevents repeated chases`,
      };
    case "promise":
      return {
        subject: `Following up on promised payment for ${ref}`,
        body: `Hi,\n\nThanks for confirming you'd settle ${ref} (${amount}). I just wanted to check that the payment is still on track for the date you mentioned.\n\nLet me know if anything has changed.\n\nThanks,`,
        reason: `Promise on file · approaching the agreed date · soft check-in is safest`,
      };
    case "remit":
      return {
        subject: `Remittance advice request — ${ref}`,
        body: `Hi,\n\nWe believe payment for invoice ${ref} (${amount}) may have been made. Could you send across the remittance advice so we can match it on our end?\n\nThanks,`,
        reason: `Customer claims payment made · need remittance to reconcile`,
      };
    case "statement":
      return {
        subject: `Statement of account — ${customer}`,
        body: `Hi,\n\nPlease find attached your statement of account showing ${amount} outstanding across open invoices.\n\nLet me know if anything looks unexpected.\n\nThanks,`,
        reason: `Multiple open invoices · statement summarises the position cleanly`,
      };
    case "dispute":
      return {
        subject: `Re: dispute on invoice ${ref}`,
        body: `Hi,\n\nThanks for raising your concern on ${ref}. I'd like to resolve this quickly — could you let me know the specific lines or amounts you'd like reviewed?\n\nWe'll pause any further reminders until this is resolved.\n\nBest,`,
        reason: `Active dispute · acknowledge first, gather detail before any chase`,
      };
    case "ap_contact":
      return {
        subject: `Best contact for accounts payable?`,
        body: `Hi,\n\nWe're trying to make sure invoice ${ref} (${amount}) reaches the right person on your team. Could you point me to the best contact in accounts payable?\n\nThanks,`,
        reason: `Contact unresponsive · routing to AP improves the reply rate`,
      };
    case "escalate":
      return {
        subject: `Internal: escalation on ${customer} / ${ref}`,
        body: `${customer} has ${amount} outstanding on ${ref}, ${days}d overdue with no engagement. Suggest escalating to relationship owner before next reminder.`,
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

  // Re-seed subject/body when scenario changes
  useEffect(() => {
    if (!current) return;
    const t = templateFor(scenario, current);
    setSubject(t.subject);
    setBody(t.body);
    setTone(TONE_DEFAULT[scenario]);
  }, [scenario, current?.id]);

  const tpl = current ? templateFor(scenario, current) : null;
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
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const handleOutcome = (k: Outcome) => {
    setOutcome(k);
    recordOutcome(k);
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
              <div className="text-[15px] font-semibold text-[#1d1813] truncate mt-0.5">
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
                className="size-7 inline-flex items-center justify-center rounded-md border transition-colors hover:bg-[#f3ecd8]"
                style={{ borderColor: "var(--zn-line-soft)", color: "var(--zn-ink-3)" }}
                title={focusMode ? "Compact" : "Focus mode"}
                aria-label={focusMode ? "Exit focus mode" : "Enter focus mode"}
              >
                {focusMode ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
              </button>
              <button
                type="button"
                onClick={close}
                className="size-7 inline-flex items-center justify-center rounded-md border transition-colors hover:bg-[#f3ecd8]"
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
                <div className="flex items-center gap-2 mt-2.5">
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
                      const t = templateFor(scenario, current);
                      setSubject(t.subject);
                      setBody(t.body);
                    }}
                  >
                    <Sparkles className="size-3.5" /> Regenerate
                  </button>
                </div>
              ) : null}
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
                      className="zn-pill"
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
              {outcome ? (
                <div className="text-[11.5px] mt-2" style={{ color: "var(--zn-ink-3)" }}>
                  Logged · would appear in activity timeline (demo)
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
                  <div className="text-[13px] font-semibold text-[#1d1813]">
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
                        <div className="text-[12.5px] font-semibold text-[#1d1813]">
                          {event.title}
                        </div>
                        <div className="text-[11.5px] text-[#6b6253] mt-0.5">
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
