"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { FileText, Copy, Check, X } from "lucide-react";

// ── Color tokens ──────────────────────────────────────────────────────────────
const T = {
  bg:      "#FAF7F2",
  card:    "#FFFFFF",
  surf2:   "#F4F4F5",
  ink:     "#1A1916",
  muted:   "#8A8680",
  border:  "rgba(0,0,0,0.08)",
  green:   "#16A34A",
  amber:   "#C28800",
  red:     "#DC2626",
  blue:    "#2563EB",
} as const;

// ── Data ──────────────────────────────────────────────────────────────────────

const CUSTOMERS: Record<string, {
  name: string; contact: string; role: string;
  email: string; phone: string; history: string;
}> = {
  meridian:   { name: "Meridian Studio",      contact: "Sarah Whitford",  role: "Operations Director", email: "sarah.whitford@meridianstudio.co.uk", phone: "+44 20 7946 0118", history: "Client since 2023 · 14 invoices paid on time" },
  bluepeak:   { name: "BluePeak Ltd",          contact: "Daniel Okafor",   role: "Head of Finance",     email: "accounts@bluepeak.ltd.uk",            phone: "+44 161 555 0142", history: "Client since 2024 · 6 invoices, 2 paid late" },
  oaktree:    { name: "Oaktree Consulting",    contact: "Priya Raman",     role: "Managing Partner",    email: "priya@oaktree-consulting.com",         phone: "+44 20 3964 7720", history: "Client since 2022 · 21 invoices, 1 dispute" },
  harborgate: { name: "Harborgate Architects", contact: "Tom Reilly",      role: "Practice Manager",    email: "t.reilly@harborgate-arch.co.uk",       phone: "+44 117 555 0093", history: "Client since 2025 · 4 invoices, 1 disputed" },
};

type Urgency = "red" | "amber" | "grey" | "blocked";

interface Invoice {
  id: string; ref: string; customer: keyof typeof CUSTOMERS;
  amount: number; daysOverdue: number; due: string;
  urgency: Urgency; status: string;
  action: string; template: string; aiDraft: string; reason: string;
}

const INVOICES: Invoice[] = [
  { id: "i1", ref: "INV-2026-0142", customer: "oaktree",    amount: 8400.00,  daysOverdue: 47, due: "1 Apr 2026",  urgency: "red",     status: "Action now",
    action: "Send final notice — 47 days, two reminders unanswered",
    template: "Dear Priya,\n\nThis is a formal final notice. Invoice INV-2026-0142 for £8,400.00, dated 1 April 2026, is now 47 days overdue despite reminders on 22 April and 6 May.\n\nUnless full payment is received within 7 days (by 26 May 2026), we will commence recovery under the Late Payment of Commercial Debts (Interest) Act 1998. Statutory interest of 8% above base plus £100 compensation may apply.\n\nPlease settle to the bank details on the invoice, or reply to agree a payment plan.\n\nKind regards,\nHelen Carver",
    aiDraft: "Hi Priya,\n\nI wanted to flag that INV-2026-0142 (£8,400) has now been outstanding for 47 days — beyond the two reminders we've sent. Before we escalate to a formal pre-action letter, I'd love to find a way through this together.\n\nCould we hop on a 15-minute call this week?\n\nHelen",
    reason: "Two prior reminders sent (22 Apr, 6 May) with no response. At 47 days past due, this invoice crosses the threshold where statutory interest under the Late Payment of Commercial Debts (Interest) Act 1998 begins to accrue meaningfully." },
  { id: "i2", ref: "INV-2026-0138", customer: "bluepeak",   amount: 12250.00, daysOverdue: 23, due: "26 Apr 2026", urgency: "red",     status: "Action now",
    action: "Chase now — largest single exposure, customer slow-paying pattern",
    template: "Hi Daniel,\n\nA reminder that invoice INV-2026-0138 for £12,250.00, due on 26 April 2026, is now 23 days overdue.\n\nCould you confirm a payment date, or let me know if there is anything holding things up?\n\nThanks,\nHelen",
    aiDraft: "Hi Daniel,\n\nQuick check-in on INV-2026-0138 (£12,250) — it's now 23 days past due. Happy to jump on a call to talk through options.\n\nHelen",
    reason: "Largest single outstanding invoice. BluePeak has been late on two of six invoices this year — a chase at the 3-week mark typically resolves within 5 working days." },
  { id: "i3", ref: "INV-2026-0119", customer: "harborgate", amount: 18500.00, daysOverdue: 89, due: "20 Feb 2026", urgency: "blocked", status: "Disputed — blocked",
    action: "Dispute on hold — awaiting reconciliation from Tom Reilly",
    template: "Hi Tom,\n\nFollowing up on the dispute around INV-2026-0119 (£18,500.00). Could you share the line items you're querying so we can produce a credit note or revised invoice?\n\nThanks,\nHelen",
    aiDraft: "Hi Tom,\n\nI know we've gone back and forth on INV-2026-0119, so let me try to simplify. Could you confirm which specific lines you're contesting? If we can pin those down today I'll have a revised invoice with you by Friday.\n\nHelen",
    reason: "Customer has formally disputed scope (email 18 Mar). Until resolved, escalation is paused. Last contact was 5 May — Tom Reilly to send line-item reconciliation." },
  { id: "i4", ref: "INV-2026-0151", customer: "meridian",   amount: 4800.00,  daysOverdue: 14, due: "5 May 2026",  urgency: "amber",   status: "Follow up",
    action: "Phone call recommended — strong payment history",
    template: "Hi Sarah,\n\nHope you're well. Just a quick note — INV-2026-0151 (£4,800.00) is showing as outstanding (was due 5 May).\n\nBest,\nHelen",
    aiDraft: "Hi Sarah,\n\nINV-2026-0151 (£4,800) drifted past its due date a fortnight ago. Meridian has paid every invoice on time for the past 14 months, so I'm sure this is just an admin slip — but a quick word would be perfect. Shall I call tomorrow at 10:30?\n\nHelen",
    reason: "Meridian has paid 14 consecutive invoices on time, so a 14-day delay is unusual. Most such cases resolve with a single phone call." },
  { id: "i5", ref: "INV-2026-0147", customer: "bluepeak",   amount: 3200.00,  daysOverdue: 31, due: "18 Apr 2026", urgency: "amber",   status: "Follow up",
    action: "Second reminder — first sent 11 May",
    template: "Hi Daniel,\n\nFollowing up on INV-2026-0147 (£3,200.00). We sent a first reminder on 11 May and have not heard back. The invoice is now 31 days overdue.\n\nCould you confirm a payment date this week?\n\nThanks,\nHelen",
    aiDraft: "Hi Daniel,\n\nSecond reminder on INV-2026-0147 (£3,200) — now a month past due and not yet acknowledged.\n\nHelen",
    reason: "First reminder went out 11 May with no acknowledgement. This is the second of three planned reminder steps before formal escalation." },
  { id: "i6", ref: "INV-2026-0149", customer: "oaktree",    amount: 2900.00,  daysOverdue: 15, due: "4 May 2026",  urgency: "amber",   status: "Follow up",
    action: "Friendly nudge — first reminder window",
    template: "Hi Priya,\n\nJust a quick nudge on invoice INV-2026-0149 (£2,900.00), due 4 May.\n\nThanks,\nHelen",
    aiDraft: "Hi Priya,\n\nINV-2026-0149 (£2,900) is two weeks past due. If there's anything I can do to clear it through — re-issue, split, change of payee — just say the word.\n\nHelen",
    reason: "Standard first-reminder window. No need for escalation language at this stage." },
  { id: "i7", ref: "INV-2026-0153", customer: "meridian",   amount: 2350.00,  daysOverdue: 62, due: "18 Mar 2026", urgency: "red",     status: "Action now",
    action: "Escalate — past two reminder cycles",
    template: "Dear Sarah,\n\nDespite reminders on 1 April and 24 April, invoice INV-2026-0153 for £2,350.00 (due 18 March) remains unpaid and is now 62 days overdue.\n\nPlease settle within 7 days.\n\nBest,\nHelen",
    aiDraft: "Hi Sarah,\n\nThis is unusual — INV-2026-0153 (£2,350) has now slipped past 60 days, despite two prior reminders. Before I follow our standard escalation, I'd really rather just talk.\n\nHelen",
    reason: "Two prior reminders went unanswered, breaking Meridian's normal pattern. At 62 days past due this would normally trigger formal escalation, but the customer's long clean history warrants a personal call first." },
  { id: "i8", ref: "INV-2026-0156", customer: "harborgate", amount: 1200.00,  daysOverdue: 4,  due: "15 May 2026", urgency: "grey",    status: "Monitoring",
    action: "Re-check in 3 days — within first-reminder grace",
    template: "Hi Tom,\n\nQuick note — INV-2026-0156 (£1,200.00) became due last week. Could you confirm when we can expect payment?\n\nThanks,\nHelen",
    aiDraft: "Hi Tom,\n\nINV-2026-0156 (£1,200) became due on 15 May — could you confirm a payment date?\n\nHelen",
    reason: "Within standard 7-day grace window. Re-evaluate on 22 May." },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtGBP(n: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

function fmtGBPShort(n: number) {
  return "£" + n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const URGENCY_DOT: Record<Urgency, string> = {
  red:     T.red,
  amber:   T.amber,
  grey:    T.muted,
  blocked: T.red,
};

const URGENCY_PILL: Record<Urgency, { bg: string; color: string }> = {
  red:     { bg: "#FEF2F2", color: T.red },
  amber:   { bg: "#FFFBEB", color: T.amber },
  grey:    { bg: T.surf2,   color: T.muted },
  blocked: { bg: "#FEF2F2", color: T.red },
};

const URGENCY_DAYS_COLOR: Record<Urgency, string> = {
  red:     T.red,
  amber:   T.amber,
  grey:    T.muted,
  blocked: T.red,
};

type FilterKey = "all" | "action" | "followup" | "monitoring" | "blocked";

const FILTER_LABELS: Record<FilterKey, string> = {
  all:        "All",
  action:     "Action now",
  followup:   "Follow up",
  monitoring: "Monitoring",
  blocked:    "Blocked",
};

function matchFilter(inv: Invoice, f: FilterKey): boolean {
  if (f === "all") return true;
  if (f === "action")     return inv.urgency === "red" && inv.status !== "Disputed — blocked";
  if (f === "followup")   return inv.urgency === "amber";
  if (f === "monitoring") return inv.urgency === "grey";
  if (f === "blocked")    return inv.urgency === "blocked";
  return true;
}

const FILTER_COUNTS: Record<FilterKey, number> = {
  all:        INVOICES.length,
  action:     INVOICES.filter((i) => matchFilter(i, "action")).length,
  followup:   INVOICES.filter((i) => matchFilter(i, "followup")).length,
  monitoring: INVOICES.filter((i) => matchFilter(i, "monitoring")).length,
  blocked:    INVOICES.filter((i) => matchFilter(i, "blocked")).length,
};

// ── Sub-components ────────────────────────────────────────────────────────────

function UrgencyDot({ urgency, size = 8 }: { urgency: Urgency; size?: number }) {
  return (
    <span
      style={{
        display: "inline-block",
        width: size, height: size,
        borderRadius: "50%",
        background: URGENCY_DOT[urgency],
        flexShrink: 0,
      }}
    />
  );
}

function StatusPill({ urgency, status }: { urgency: Urgency; status: string }) {
  const p = URGENCY_PILL[urgency];
  return (
    <span
      style={{
        display: "inline-flex", alignItems: "center", gap: 4,
        background: p.bg, color: p.color,
        borderRadius: 99, padding: "2px 8px",
        fontSize: 11, fontWeight: 600, whiteSpace: "nowrap",
      }}
    >
      <UrgencyDot urgency={urgency} size={6} />
      {status}
    </span>
  );
}

function Toggle({
  on, onToggle, colorOn,
}: { on: boolean; onToggle: () => void; colorOn: string }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      style={{
        width: 36, height: 20, borderRadius: 10, border: "none",
        background: on ? colorOn : "#D1D5DB",
        position: "relative", cursor: "pointer", transition: "background 0.18s",
        flexShrink: 0,
      }}
      aria-pressed={on}
    >
      <span
        style={{
          position: "absolute", top: 2, left: on ? 18 : 2,
          width: 16, height: 16, borderRadius: "50%",
          background: "#fff", transition: "left 0.18s",
          boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
        }}
      />
    </button>
  );
}

// ── Detail panel ──────────────────────────────────────────────────────────────

function DetailPanel({
  inv, replied, snoozed, draftMode, bodyText,
  onToggleReplied, onToggleSnoozed,
  onSetDraftMode, onBodyChange,
  onCopy, copied, onMarkChased, onSnooze,
}: {
  inv: Invoice;
  replied: boolean; snoozed: boolean;
  draftMode: "template" | "ai";
  bodyText: string;
  onToggleReplied: () => void;
  onToggleSnoozed: () => void;
  onSetDraftMode: (m: "template" | "ai") => void;
  onBodyChange: (s: string) => void;
  onCopy: () => void;
  copied: boolean;
  onMarkChased: () => void;
  onSnooze: () => void;
}) {
  const cust = CUSTOMERS[inv.customer];
  const pill = URGENCY_PILL[inv.urgency];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Eyebrow */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <UrgencyDot urgency={inv.urgency} />
        <span style={{ fontSize: 12, color: pill.color, fontWeight: 600 }}>{inv.status}</span>
        <span style={{ fontSize: 12, color: T.muted }}>·</span>
        <span style={{ fontSize: 12, color: T.muted, fontFamily: "monospace" }}>{inv.ref}</span>
      </div>

      {/* Customer name */}
      <div>
        <h2 style={{ fontSize: 18, fontWeight: 600, color: T.ink, margin: 0, letterSpacing: "-0.01em" }}>
          {cust.name}
        </h2>
        <p style={{ fontSize: 12, color: T.muted, margin: "4px 0 0" }}>
          {cust.contact} · {cust.role}
        </p>
      </div>

      {/* Summary grid 2×2 */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {[
          { label: "Amount",       value: fmtGBP(inv.amount) },
          { label: "Days overdue", value: `${inv.daysOverdue} days`, color: URGENCY_DAYS_COLOR[inv.urgency] },
          { label: "Status",       value: inv.status },
          { label: "Contact",      value: cust.contact },
        ].map(({ label, value, color }) => (
          <div
            key={label}
            style={{
              background: T.surf2, borderRadius: 8, padding: "10px 12px",
              border: `1px solid ${T.border}`,
            }}
          >
            <p style={{ fontSize: 10.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: T.muted, margin: "0 0 3px" }}>
              {label}
            </p>
            <p style={{ fontSize: 13, fontWeight: 600, color: color ?? T.ink, margin: 0 }}>
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* Why chase now */}
      <div>
        <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: T.muted, margin: "0 0 8px" }}>
          Why chase now
        </p>
        <p style={{ fontSize: 13, color: T.muted, lineHeight: 1.6, margin: 0 }}>
          {inv.reason}
        </p>
      </div>

      {/* Draft message */}
      <div>
        <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: T.muted, margin: "0 0 10px" }}>
          Draft message
        </p>

        {/* Tab toggle */}
        <div
          style={{
            display: "inline-flex", borderRadius: 8,
            background: T.surf2, border: `1px solid ${T.border}`,
            padding: 3, marginBottom: 10,
          }}
        >
          {(["template", "ai"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => onSetDraftMode(m)}
              style={{
                padding: "5px 12px", borderRadius: 6, border: "none",
                fontSize: 12, fontWeight: 500, cursor: "pointer",
                background: draftMode === m ? T.card : "transparent",
                color: draftMode === m ? T.ink : T.muted,
                boxShadow: draftMode === m ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                transition: "all 0.15s",
              }}
            >
              {m === "template" ? "Template" : "AI draft (Demo)"}
            </button>
          ))}
        </div>

        {/* Textarea */}
        <textarea
          rows={9}
          value={bodyText}
          onChange={(e) => onBodyChange(e.target.value)}
          style={{
            width: "100%", boxSizing: "border-box",
            padding: "10px 12px", borderRadius: 8,
            border: `1px solid ${T.border}`,
            fontSize: 13, lineHeight: 1.55, color: T.ink,
            background: T.card, resize: "vertical", outline: "none",
            fontFamily: "inherit",
          }}
        />

        {/* To + char count */}
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
          <span style={{ fontSize: 11, color: T.muted }}>
            To: {cust.email}
          </span>
          <span style={{ fontSize: 11, color: T.muted }}>
            {bodyText.length} chars
          </span>
        </div>

        {/* Action buttons */}
        <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={onCopy}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              background: T.ink, color: "#fff",
              border: "none", borderRadius: 99,
              padding: "8px 16px", fontSize: 13, fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? "Copied!" : "Copy message"}
          </button>
          <button
            type="button"
            onClick={onMarkChased}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              background: "transparent", color: T.ink,
              border: `1px solid ${T.border}`, borderRadius: 99,
              padding: "8px 16px", fontSize: 13, fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Mark as chased
          </button>
          <button
            type="button"
            onClick={onSnooze}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              background: "transparent", color: T.ink,
              border: `1px solid ${T.border}`, borderRadius: 99,
              padding: "8px 16px", fontSize: 13, fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Snooze 7 days
          </button>
        </div>
      </div>

      {/* Customer signals */}
      <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 16 }}>
        <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: T.muted, margin: "0 0 12px" }}>
          Customer signals
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <p style={{ fontSize: 13, fontWeight: 500, color: T.ink, margin: 0 }}>Reply received</p>
              <p style={{ fontSize: 11, color: T.muted, margin: "2px 0 0" }}>
                {replied ? "Chase paused — reply logged" : "No reply logged yet"}
              </p>
            </div>
            <Toggle on={replied} onToggle={onToggleReplied} colorOn={T.green} />
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <p style={{ fontSize: 13, fontWeight: 500, color: T.ink, margin: 0 }}>Snoozed 7 days</p>
              <p style={{ fontSize: 11, color: T.muted, margin: "2px 0 0" }}>
                {snoozed ? "Re-surfaces 26 May" : "Not snoozed"}
              </p>
            </div>
            <Toggle on={snoozed} onToggle={onToggleSnoozed} colorOn={T.amber} />
          </div>
          <div style={{ marginTop: 4 }}>
            <p style={{ fontSize: 11, color: T.muted, margin: 0 }}>
              {cust.history}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DemoChasePlanPage() {
  const [filter,      setFilter]      = useState<FilterKey>("all");
  const [selectedId,  setSelectedId]  = useState<string | null>("i1");
  const [checkedIds,  setCheckedIds]  = useState<Set<string>>(new Set());
  const [replied,     setReplied]     = useState<Set<string>>(new Set());
  const [snoozed,     setSnoozed]     = useState<Set<string>>(new Set());
  const [draftMode,   setDraftMode]   = useState<"template" | "ai">("template");
  const [bodyText,    setBodyText]    = useState<string>("");
  const [copied,      setCopied]      = useState<boolean>(false);
  const [toast,       setToast]       = useState<string | null>(null);

  const filtered = useMemo(
    () => INVOICES.filter((i) => matchFilter(i, filter)),
    [filter],
  );

  const selectedInv = selectedId ? INVOICES.find((i) => i.id === selectedId) ?? null : null;

  // Sync body text when selection or draft mode changes
  useEffect(() => {
    if (!selectedInv) { setBodyText(""); return; }
    setBodyText(draftMode === "template" ? selectedInv.template : selectedInv.aiDraft);
  }, [selectedInv, draftMode]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  function toggleChecked(id: string) {
    setCheckedIds((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  function selectAll() {
    if (checkedIds.size === filtered.length) {
      setCheckedIds(new Set());
    } else {
      setCheckedIds(new Set(filtered.map((i) => i.id)));
    }
  }

  const toggleReplied = useCallback((id: string) => {
    setReplied((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
    showToast("Marked as replied — chase paused");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleSnoozed = useCallback((id: string) => {
    setSnoozed((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
    showToast("Snoozed until 26 May");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleCopy() {
    navigator.clipboard.writeText(bodyText).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleMarkChased() {
    if (!selectedId) return;
    setReplied((p) => { const n = new Set(p); n.add(selectedId); return n; });
    showToast("Marked as replied — chase paused");
  }

  function handleSnooze() {
    if (!selectedId) return;
    setSnoozed((p) => { const n = new Set(p); n.add(selectedId); return n; });
    showToast("Snoozed until 26 May");
  }

  function bulkMarkChased() {
    setReplied((p) => { const n = new Set(p); checkedIds.forEach((id) => n.add(id)); return n; });
    setCheckedIds(new Set());
    showToast(`${checkedIds.size} invoice${checkedIds.size > 1 ? "s" : ""} marked as chased`);
  }

  function bulkSnooze() {
    setSnoozed((p) => { const n = new Set(p); checkedIds.forEach((id) => n.add(id)); return n; });
    setCheckedIds(new Set());
    showToast("Snoozed until 26 May");
  }

  const checkedTotal = Array.from(checkedIds).reduce((sum, id) => {
    const inv = INVOICES.find((i) => i.id === id);
    return sum + (inv?.amount ?? 0);
  }, 0);

  const urgentCount = INVOICES.filter((i) => i.urgency === "red").length;
  const FILTER_KEYS: FilterKey[] = ["all", "action", "followup", "monitoring", "blocked"];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Page header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: T.ink, margin: 0, letterSpacing: "-0.02em", lineHeight: 1.1 }}>
            Chase plan
          </h1>
          <p style={{ fontSize: 13.5, color: T.muted, margin: "6px 0 0" }}>
            {INVOICES.length} invoices · {urgentCount} urgent
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              background: T.surf2, color: T.muted,
              border: `1px solid ${T.border}`, borderRadius: 99,
              padding: "8px 16px", fontSize: 13, fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Export
          </button>
          <button
            type="button"
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              background: T.ink, color: "#fff",
              border: "none", borderRadius: 99,
              padding: "8px 16px", fontSize: 13, fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Send selected
          </button>
        </div>
      </div>

      {/* Two-panel body */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 400px",
          gap: 20,
          alignItems: "start",
        }}
      >
        {/* ── LEFT panel ── */}
        <div
          style={{
            background: T.card,
            border: `1px solid ${T.border}`,
            borderRadius: 12,
            overflow: "hidden",
          }}
        >
          {/* Filter tabs + select-all */}
          <div
            style={{
              borderBottom: `1px solid ${T.border}`,
              padding: "0 16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
            }}
          >
            {/* Tabs */}
            <div style={{ display: "flex", gap: 0 }}>
              {FILTER_KEYS.map((key) => {
                const active = filter === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setFilter(key)}
                    style={{
                      padding: "13px 0",
                      marginRight: 20,
                      border: "none",
                      borderBottom: active ? `2px solid ${T.ink}` : "2px solid transparent",
                      background: "transparent",
                      fontSize: 13,
                      fontWeight: active ? 600 : 400,
                      color: active ? T.ink : T.muted,
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                      transition: "color 0.15s",
                    }}
                  >
                    {FILTER_LABELS[key]}
                    <span
                      style={{
                        marginLeft: 6,
                        fontSize: 11,
                        color: active ? T.ink : T.muted,
                        fontWeight: active ? 600 : 400,
                      }}
                    >
                      ({FILTER_COUNTS[key]})
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Select all */}
            <button
              type="button"
              onClick={selectAll}
              style={{
                fontSize: 12, color: T.muted, background: "none",
                border: "none", cursor: "pointer", whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              {checkedIds.size === filtered.length && filtered.length > 0 ? "Deselect all" : "Select all"}
            </button>
          </div>

          {/* Invoice list */}
          <div style={{ overflowY: "auto", maxHeight: "calc(100vh - 260px)" }}>
            {filtered.length === 0 && (
              <div style={{ padding: "48px 24px", textAlign: "center" }}>
                <FileText size={36} style={{ color: T.muted, opacity: 0.3, margin: "0 auto 12px" }} />
                <p style={{ fontSize: 13, color: T.muted }}>No invoices in this filter.</p>
              </div>
            )}

            {filtered.map((inv, idx) => {
              const isSelected = selectedId === inv.id;
              const isChecked  = checkedIds.has(inv.id);
              const isReplied  = replied.has(inv.id);
              const isSnoozed  = snoozed.has(inv.id);
              const cust       = CUSTOMERS[inv.customer];

              return (
                <div
                  key={inv.id}
                  onClick={() => setSelectedId(isSelected ? null : inv.id)}
                  style={{
                    borderBottom: idx < filtered.length - 1 ? `1px solid ${T.border}` : "none",
                    borderLeft: isSelected ? `2px solid ${T.ink}` : "2px solid transparent",
                    background: isSelected ? "#FAFAFA" : T.card,
                    padding: "14px 16px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    transition: "background 0.12s",
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = "#FAFAFA";
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = T.card;
                  }}
                >
                  {/* Checkbox */}
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={(e) => { e.stopPropagation(); toggleChecked(inv.id); }}
                    onClick={(e) => e.stopPropagation()}
                    style={{ width: 14, height: 14, cursor: "pointer", flexShrink: 0, accentColor: T.ink }}
                  />

                  {/* Urgency dot */}
                  <UrgencyDot urgency={inv.urgency} />

                  {/* Left: customer + ref */}
                  <div style={{ flex: "0 0 160px", minWidth: 0 }}>
                    <p style={{
                      fontSize: 13, fontWeight: 600, color: T.ink, margin: 0,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {cust.name}
                    </p>
                    <p style={{ fontSize: 11, color: T.muted, margin: "2px 0 0", fontFamily: "monospace" }}>
                      {inv.ref} · {inv.due}
                    </p>
                  </div>

                  {/* Middle: pill + action */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <StatusPill urgency={inv.urgency} status={inv.status} />
                    <p style={{
                      fontSize: 11, color: T.muted, margin: "4px 0 0",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {inv.action}
                    </p>
                  </div>

                  {/* Right: amount + days + badges */}
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: T.ink, margin: 0 }}>
                      {fmtGBP(inv.amount)}
                    </p>
                    <p style={{ fontSize: 11, color: URGENCY_DAYS_COLOR[inv.urgency], margin: "2px 0 0", fontWeight: 600 }}>
                      {inv.daysOverdue}d overdue
                    </p>
                    <div style={{ display: "flex", gap: 4, justifyContent: "flex-end", marginTop: 4 }}>
                      {isReplied && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10.5, color: T.muted }}>
                          <span style={{ width: 6, height: 6, borderRadius: "50%", background: T.green, display: "inline-block" }} />
                          Replied
                        </span>
                      )}
                      {isSnoozed && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10.5, color: T.muted }}>
                          <span style={{ width: 6, height: 6, borderRadius: "50%", background: T.amber, display: "inline-block" }} />
                          Snoozed 7d
                        </span>
                      )}
                      {inv.urgency === "blocked" && !isReplied && !isSnoozed && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10.5, color: T.muted }}>
                          <span style={{ width: 6, height: 6, borderRadius: "50%", background: T.red, display: "inline-block" }} />
                          Disputed
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── RIGHT: detail panel ── */}
        <div style={{ position: "sticky", top: 24 }}>
          {selectedInv ? (
            <div
              style={{
                background: T.card,
                border: `1px solid ${T.border}`,
                borderRadius: 12,
                padding: 20,
                maxHeight: "calc(100vh - 120px)",
                overflowY: "auto",
                position: "relative",
              }}
            >
              {/* Close */}
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                style={{
                  position: "absolute", top: 14, right: 14,
                  background: "none", border: "none", cursor: "pointer",
                  color: T.muted, padding: 4, borderRadius: 6,
                  display: "flex", alignItems: "center",
                }}
              >
                <X size={16} />
              </button>

              <DetailPanel
                inv={selectedInv}
                replied={replied.has(selectedInv.id)}
                snoozed={snoozed.has(selectedInv.id)}
                draftMode={draftMode}
                bodyText={bodyText}
                onToggleReplied={() => toggleReplied(selectedInv.id)}
                onToggleSnoozed={() => toggleSnoozed(selectedInv.id)}
                onSetDraftMode={(m) => { setDraftMode(m); }}
                onBodyChange={setBodyText}
                onCopy={handleCopy}
                copied={copied}
                onMarkChased={handleMarkChased}
                onSnooze={handleSnooze}
              />
            </div>
          ) : (
            <div
              style={{
                background: T.card,
                border: `1px solid ${T.border}`,
                borderRadius: 12,
                minHeight: 300,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "64px 24px",
                textAlign: "center",
              }}
            >
              <FileText size={40} style={{ color: T.muted, opacity: 0.2, marginBottom: 12 }} />
              <p style={{ fontSize: 14, fontWeight: 500, color: T.ink, margin: 0 }}>
                Select an invoice
              </p>
              <p style={{ fontSize: 12.5, color: T.muted, margin: "6px 0 0" }}>
                Click a row to see the reason, contact, and draft message.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Bulk action bar ── */}
      {checkedIds.size > 0 && (
        <div
          style={{
            position: "fixed",
            bottom: 24,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 50,
            animation: "bulkRise 0.18s ease-out both",
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 12,
              background: T.ink,
              color: "#fff",
              borderRadius: 99,
              padding: "10px 20px",
              boxShadow: "0 8px 32px rgba(0,0,0,0.24)",
              whiteSpace: "nowrap",
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 600 }}>
              {checkedIds.size} selected · {fmtGBPShort(checkedTotal)}
            </span>
            <div style={{ width: 1, height: 16, background: "rgba(255,255,255,0.2)" }} />
            <button
              type="button"
              onClick={bulkMarkChased}
              style={{
                background: "none", border: "none", color: "#fff",
                fontSize: 13, fontWeight: 500, cursor: "pointer", padding: 0,
              }}
            >
              Mark chased
            </button>
            <button
              type="button"
              onClick={bulkSnooze}
              style={{
                background: "none", border: "none", color: "#fff",
                fontSize: 13, fontWeight: 500, cursor: "pointer", padding: 0,
              }}
            >
              Snooze 7 days
            </button>
            <button
              type="button"
              style={{
                background: "none", border: "none", color: "rgba(255,255,255,0.7)",
                fontSize: 13, fontWeight: 500, cursor: "pointer", padding: 0,
              }}
            >
              Export
            </button>
            <div style={{ width: 1, height: 16, background: "rgba(255,255,255,0.2)" }} />
            <button
              type="button"
              onClick={() => setCheckedIds(new Set())}
              style={{
                background: "none", border: "none", color: "rgba(255,255,255,0.7)",
                cursor: "pointer", padding: 0, display: "flex", alignItems: "center",
              }}
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ── Toast ── */}
      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: checkedIds.size > 0 ? 80 : 24,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 60,
            background: T.ink,
            color: "#fff",
            borderRadius: 99,
            padding: "10px 20px",
            fontSize: 13,
            fontWeight: 500,
            boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
            whiteSpace: "nowrap",
            animation: "bulkRise 0.18s ease-out both",
          }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}
