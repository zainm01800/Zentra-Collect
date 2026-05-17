"use client";

/**
 * DisputeWorkflow — structured dispute management with formal stages.
 *
 * Stages: raised → contacted → awaiting_docs → under_review → resolved | rejected
 *
 * Each stage has stage-specific action prompts, internal notes, and
 * auto-generated draft replies to the customer.
 */

import { useState, useEffect } from "react";
import {
  Flag,
  Mail,
  FileText,
  CheckCircle2,
  XCircle,
  ChevronRight,
  MessageSquare,
  Send,
  Check,
  ArrowRight,
  Clock,
  User,
} from "lucide-react";

type DisputeStage = "raised" | "contacted" | "awaiting_docs" | "under_review" | "resolved" | "rejected";

const STAGES: { key: DisputeStage; label: string; description: string }[] = [
  { key: "raised",       label: "Raised",          description: "Dispute logged, not yet actioned" },
  { key: "contacted",    label: "Contacted",        description: "Customer contacted, waiting response" },
  { key: "awaiting_docs",label: "Awaiting docs",   description: "Evidence or documents requested" },
  { key: "under_review", label: "Under review",     description: "Evidence received, reviewing internally" },
  { key: "resolved",     label: "Resolved",         description: "Dispute closed, chase resumed" },
  { key: "rejected",     label: "Rejected",         description: "Customer claim rejected, chase resumed" },
];

const STAGE_ORDER: DisputeStage[] = ["raised", "contacted", "awaiting_docs", "under_review", "resolved"];

const STORAGE_KEY = "zentra.disputeWorkflow.v1";

interface WorkflowState {
  stage: DisputeStage;
  notes: { stage: DisputeStage; text: string; createdAt: string }[];
  updatedAt: string;
  assignee?: string;
}

function readWorkflow(disputeId: string): WorkflowState {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}.${disputeId}`);
    if (raw) return JSON.parse(raw);
  } catch { /* */ }
  return { stage: "raised", notes: [], updatedAt: new Date().toISOString() };
}

function writeWorkflow(disputeId: string, state: WorkflowState): void {
  try {
    localStorage.setItem(`${STORAGE_KEY}.${disputeId}`, JSON.stringify(state));
  } catch { /* */ }
}

function draftReply(stage: DisputeStage, customerName: string, invoiceRef: string): string {
  const greet = `Hi,\n\nThank you for raising a query regarding invoice ${invoiceRef}.`;
  switch (stage) {
    case "raised":
      return `${greet}\n\nWe've logged your dispute and will investigate. We'll pause any automated reminders on this invoice while we look into it.\n\nCould you provide more detail on the specific concern so we can respond accurately?\n\nKind regards`;
    case "contacted":
      return `${greet}\n\nFollowing up on our earlier conversation — could you confirm whether you've had a chance to review the information we sent?\n\nWe're keen to resolve this as soon as possible.\n\nKind regards`;
    case "awaiting_docs":
      return `${greet}\n\nWe're still waiting for the documents we requested to investigate your query. Could you please provide these at your earliest convenience?\n\nWe're unable to complete our review without them.\n\nKind regards`;
    case "under_review":
      return `${greet}\n\nThank you for the information provided. We're currently reviewing this internally and will be in touch shortly with our response.\n\nKind regards`;
    case "resolved":
      return `${greet}\n\nWe're pleased to confirm that this dispute has been resolved. Normal payment terms now apply.\n\nKind regards`;
    case "rejected":
      return `${greet}\n\nFollowing our review, we are unable to accept the basis of the dispute raised. The original invoice remains valid and payable.\n\nIf you would like to discuss further, please reply to this email.\n\nKind regards`;
    default:
      return greet;
  }
}

const STAGE_NEXT_ACTION: Record<DisputeStage, string> = {
  raised:        "Contact customer",
  contacted:     "Request evidence",
  awaiting_docs: "Mark as received & under review",
  under_review:  "Resolve or reject dispute",
  resolved:      "",
  rejected:      "",
};

interface Props {
  disputeId: string;
  customerName: string;
  invoiceRef: string;
  amount: number;
  isDemo: boolean;
  initialStage?: DisputeStage;
  owner?: string;
}

export function DisputeWorkflow({
  disputeId,
  customerName,
  invoiceRef,
  amount,
  isDemo,
  initialStage = "raised",
  owner,
}: Props) {
  const [wf, setWf] = useState<WorkflowState>({
    stage: initialStage,
    notes: [],
    updatedAt: new Date().toISOString(),
    assignee: owner,
  });
  const [panel, setPanel] = useState<"reply" | "note" | "advance" | null>(null);
  const [replyText, setReplyText] = useState("");
  const [noteText, setNoteText] = useState("");
  const [replySent, setReplySent] = useState(false);
  const [noteSaved, setNoteSaved] = useState(false);

  useEffect(() => {
    const stored = readWorkflow(disputeId);
    if (stored.stage !== "raised" || stored.notes.length > 0) {
      setWf(stored);
    }
  }, [disputeId]);

  useEffect(() => {
    setReplyText(draftReply(wf.stage, customerName, invoiceRef));
  }, [wf.stage, customerName, invoiceRef]);

  function save(next: WorkflowState) {
    setWf(next);
    writeWorkflow(disputeId, next);
  }

  function advanceStage(to: DisputeStage) {
    save({ ...wf, stage: to, updatedAt: new Date().toISOString() });
    setPanel(null);
  }

  function addNote() {
    if (!noteText.trim()) return;
    const updated: WorkflowState = {
      ...wf,
      notes: [...wf.notes, { stage: wf.stage, text: noteText.trim(), createdAt: new Date().toISOString() }],
      updatedAt: new Date().toISOString(),
    };
    save(updated);
    setNoteText("");
    setNoteSaved(true);
    setPanel(null);
    setTimeout(() => setNoteSaved(false), 2000);
  }

  const isTerminal = wf.stage === "resolved" || wf.stage === "rejected";
  const currentIdx = STAGE_ORDER.indexOf(wf.stage);
  const nextStage = currentIdx >= 0 && currentIdx < STAGE_ORDER.length - 1
    ? STAGE_ORDER[currentIdx + 1]
    : null;

  const stageInfo = STAGES.find((s) => s.key === wf.stage)!;
  const btnStyle: React.CSSProperties = { height: 26, fontSize: 12, padding: "0 11px" };

  return (
    <div className="flex flex-col gap-3">
      {/* Stage progress bar */}
      <div className="flex items-center gap-0">
        {STAGE_ORDER.map((s, i) => {
          const done = STAGE_ORDER.indexOf(wf.stage) > i;
          const active = wf.stage === s;
          const terminal = wf.stage === "resolved" || wf.stage === "rejected";
          return (
            <div key={s} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <div
                  className="w-full h-1.5 rounded-full transition-all duration-300"
                  style={{
                    background: done || (active && terminal)
                      ? "var(--zn-safe)"
                      : active
                        ? "var(--zn-warn)"
                        : "var(--zn-line-soft)",
                  }}
                />
                <span
                  className="text-[9.5px] font-medium mt-1 text-center leading-tight"
                  style={{
                    color: active ? "var(--zn-ink)" : "var(--zn-ink-3)",
                    fontWeight: active ? 700 : 400,
                  }}
                >
                  {STAGES.find((st) => st.key === s)?.label}
                </span>
              </div>
              {i < STAGE_ORDER.length - 1 && (
                <ChevronRight className="size-3 mx-0.5 shrink-0" style={{ color: "var(--zn-line-soft)" }} />
              )}
            </div>
          );
        })}
        {/* Resolved / rejected terminal */}
        <div className="flex items-center">
          <ChevronRight className="size-3 mx-0.5 shrink-0" style={{ color: "var(--zn-line-soft)" }} />
          <div className="flex flex-col items-center">
            <div
              className="w-full h-1.5 rounded-full transition-all duration-300"
              style={{
                minWidth: 32,
                background: isTerminal ? (wf.stage === "resolved" ? "var(--zn-safe)" : "var(--zn-risk)") : "var(--zn-line-soft)",
              }}
            />
            <span
              className="text-[9.5px] font-medium mt-1"
              style={{ color: isTerminal ? "var(--zn-ink)" : "var(--zn-ink-3)", fontWeight: isTerminal ? 700 : 400 }}
            >
              {wf.stage === "rejected" ? "Rejected" : "Resolved"}
            </span>
          </div>
        </div>
      </div>

      {/* Current stage chip + next action */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 text-[12px]" style={{ color: "var(--zn-ink-2)" }}>
          <Clock className="size-3.5" style={{ color: "var(--zn-ink-3)" }} />
          <span className="font-medium">{stageInfo.label}</span>
          <span style={{ color: "var(--zn-ink-3)" }}>— {stageInfo.description}</span>
        </div>
        {wf.assignee && (
          <div className="flex items-center gap-1 text-[11.5px]" style={{ color: "var(--zn-ink-3)" }}>
            <User className="size-3" />
            {wf.assignee}
          </div>
        )}
      </div>

      {/* Action row */}
      {!isTerminal && (
        <div className="flex flex-wrap items-center gap-2">
          {/* Reply to customer */}
          <button
            className="zn-pill zn-pill-ghost"
            style={btnStyle}
            onClick={() => setPanel(panel === "reply" ? null : "reply")}
          >
            <Mail className="size-3.5" /> Reply to customer
          </button>

          {/* Add internal note */}
          <button
            className="zn-pill zn-pill-ghost"
            style={btnStyle}
            onClick={() => setPanel(panel === "note" ? null : "note")}
          >
            <MessageSquare className="size-3.5" /> Add note
            {noteSaved && <span className="ml-1 text-[10px]" style={{ color: "var(--zn-safe)" }}>✓</span>}
          </button>

          {/* Advance stage */}
          {nextStage && (
            <button
              className="zn-pill"
              style={{ ...btnStyle }}
              onClick={() => setPanel(panel === "advance" ? null : "advance")}
            >
              <ArrowRight className="size-3.5" /> {STAGE_NEXT_ACTION[wf.stage]}
            </button>
          )}

          {/* Resolve / reject — at under_review stage */}
          {wf.stage === "under_review" && (
            <div className="flex items-center gap-1.5">
              <button
                className="zn-pill"
                style={{ ...btnStyle, background: "var(--zn-safe)", color: "#fff" }}
                onClick={() => advanceStage("resolved")}
              >
                <CheckCircle2 className="size-3.5" /> Resolve & resume chase
              </button>
              <button
                className="zn-pill zn-pill-ghost"
                style={{ ...btnStyle, color: "var(--zn-risk)", borderColor: "var(--zn-risk)" }}
                onClick={() => advanceStage("rejected")}
              >
                <XCircle className="size-3.5" /> Reject claim
              </button>
            </div>
          )}
        </div>
      )}

      {/* Terminal state */}
      {isTerminal && (
        <div
          className="flex items-center gap-2 text-[12.5px] rounded-xl px-3 py-2.5"
          style={{
            background: wf.stage === "resolved" ? "var(--zn-safe-soft)" : "var(--zn-risk-soft)",
            color: wf.stage === "resolved" ? "var(--zn-safe)" : "var(--zn-risk)",
          }}
        >
          {wf.stage === "resolved"
            ? <CheckCircle2 className="size-4 shrink-0" />
            : <XCircle className="size-4 shrink-0" />
          }
          <span className="font-medium">
            {wf.stage === "resolved" ? "Dispute resolved — normal chase schedule resumed." : "Dispute rejected — original invoice is payable."}
          </span>
          <button
            className="ml-auto text-[11px] underline"
            onClick={() => advanceStage("raised")}
            style={{ color: "inherit", opacity: 0.7 }}
          >
            Reopen
          </button>
        </div>
      )}

      {/* Reply panel */}
      {panel === "reply" && (
        <div
          className="rounded-[10px] p-3.5 flex flex-col gap-2.5"
          style={{ background: "var(--zn-surface-2)", border: "1px solid var(--zn-line)" }}
        >
          <div className="text-[11px] font-semibold uppercase tracking-[0.1em]" style={{ color: "var(--zn-ink-3)" }}>
            Draft reply — {customerName}
          </div>
          <textarea
            className="w-full rounded-lg text-[13px] leading-[1.55] resize-none p-2.5 outline-none"
            style={{ background: "var(--zn-surface)", border: "1px solid var(--zn-line-soft)", color: "var(--zn-ink)", minHeight: 140 }}
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <button className="zn-pill zn-pill-ghost" style={btnStyle} onClick={() => setPanel(null)}>
              Cancel
            </button>
            {replySent ? (
              <span className="zn-pill" style={{ ...btnStyle, background: "var(--zn-safe)", color: "#fff" }}>
                <Check className="size-3.5" /> {isDemo ? "Copied" : "Sent"}
              </span>
            ) : (
              <button
                className="zn-pill"
                style={btnStyle}
                onClick={() => {
                  if (isDemo) navigator.clipboard?.writeText(replyText).catch(() => {});
                  setReplySent(true);
                  // Auto-advance to contacted if still at raised
                  if (wf.stage === "raised") advanceStage("contacted");
                  setTimeout(() => { setPanel(null); setReplySent(false); }, 1500);
                }}
              >
                <Send className="size-3.5" /> {isDemo ? "Copy draft" : "Send email"}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Note panel */}
      {panel === "note" && (
        <div
          className="rounded-[10px] p-3.5 flex flex-col gap-2.5"
          style={{ background: "var(--zn-surface-2)", border: "1px solid var(--zn-line)" }}
        >
          <div className="text-[11px] font-semibold uppercase tracking-[0.1em]" style={{ color: "var(--zn-ink-3)" }}>
            Internal note
          </div>
          <textarea
            className="w-full rounded-lg text-[13px] leading-[1.55] resize-none p-2.5 outline-none"
            style={{ background: "var(--zn-surface)", border: "1px solid var(--zn-line-soft)", color: "var(--zn-ink)", minHeight: 80 }}
            placeholder="E.g. Customer confirmed PO query — waiting for their AP team..."
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <button className="zn-pill zn-pill-ghost" style={btnStyle} onClick={() => setPanel(null)}>
              Cancel
            </button>
            <button
              className="zn-pill"
              style={btnStyle}
              disabled={!noteText.trim()}
              onClick={addNote}
            >
              <FileText className="size-3.5" /> Save note
            </button>
          </div>
        </div>
      )}

      {/* Advance stage confirmation panel */}
      {panel === "advance" && nextStage && (
        <div
          className="rounded-[10px] p-3.5 flex flex-col gap-2.5"
          style={{ background: "var(--zn-surface-2)", border: "1px solid var(--zn-line)" }}
        >
          <p className="text-[13px]" style={{ color: "var(--zn-ink-2)" }}>
            Move dispute to <strong>{STAGES.find((s) => s.key === nextStage)?.label}</strong>?
            This will update the stage and log a timestamp.
          </p>
          <div className="flex gap-2">
            <button className="zn-pill zn-pill-ghost" style={btnStyle} onClick={() => setPanel(null)}>Cancel</button>
            <button className="zn-pill" style={btnStyle} onClick={() => advanceStage(nextStage)}>
              <ArrowRight className="size-3.5" /> Confirm
            </button>
          </div>
        </div>
      )}

      {/* Notes history */}
      {wf.notes.length > 0 && (
        <div className="space-y-2 pt-1">
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.1em]" style={{ color: "var(--zn-ink-3)" }}>
            Notes ({wf.notes.length})
          </div>
          {wf.notes.map((n, i) => (
            <div
              key={i}
              className="rounded-lg px-3 py-2.5"
              style={{ background: "var(--zn-surface-2)", border: "1px solid var(--zn-line-soft)" }}
            >
              <p className="text-[12.5px]" style={{ color: "var(--zn-ink)" }}>{n.text}</p>
              <p className="text-[10.5px] mt-1" style={{ color: "var(--zn-ink-3)" }}>
                {STAGES.find((s) => s.key === n.stage)?.label} ·{" "}
                {new Date(n.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}{" "}
                {new Date(n.createdAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
