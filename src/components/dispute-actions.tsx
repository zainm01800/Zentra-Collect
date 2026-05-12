"use client";

import { useState } from "react";
import { Check, ChevronDown, FileText, Mail, Send, X } from "lucide-react";

interface DisputeActionsProps {
  disputeId:    string;
  customerName: string;
  invoiceRef:   string;
  amount:       number;
  owner?:       string;
  isDemo:       boolean;
}

export function DisputeActions({
  disputeId,
  customerName,
  invoiceRef,
  owner,
  isDemo,
}: DisputeActionsProps) {
  const [panel, setPanel]     = useState<"reply" | "evidence" | null>(null);
  const [resolved, setResolved] = useState(false);
  const [confirmResolve, setConfirmResolve] = useState(false);
  const [replyText, setReplyText] = useState(
    `Hi,\n\nThank you for getting in touch regarding invoice ${invoiceRef}. We'd like to resolve this as quickly as possible.\n\nCould you please clarify the specific points of concern so we can investigate and respond accordingly?\n\nKind regards`
  );
  const [evidenceText, setEvidenceText] = useState("");
  const [evidenceSaved, setEvidenceSaved] = useState(false);
  const [replySent, setReplySent] = useState(false);

  const btnStyle = { height: 26, fontSize: 12, padding: "0 11px" };

  if (resolved) {
    return (
      <div className="flex items-center gap-2 text-[12.5px]" style={{ color: "var(--zn-safe)" }}>
        <Check className="size-3.5" />
        <span className="font-medium">Dispute resolved — chase resumed</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center gap-2">
        {/* Reply to customer */}
        <button
          className="zn-pill zn-pill-ghost"
          style={btnStyle}
          onClick={() => setPanel(panel === "reply" ? null : "reply")}
        >
          <Mail className="size-3.5" />
          Reply to customer
          <ChevronDown
            className="size-3 transition-transform"
            style={{ transform: panel === "reply" ? "rotate(180deg)" : "none" }}
          />
        </button>

        {/* Add evidence */}
        <button
          className="zn-pill zn-pill-ghost"
          style={btnStyle}
          onClick={() => setPanel(panel === "evidence" ? null : "evidence")}
        >
          <FileText className="size-3.5" />
          Add evidence
          {evidenceSaved && <span className="ml-1 text-[10px] font-bold" style={{ color: "var(--zn-safe)" }}>✓</span>}
        </button>

        {/* Resolve */}
        {confirmResolve ? (
          <div className="flex items-center gap-1.5">
            <span className="text-[11.5px]" style={{ color: "var(--zn-ink-3)" }}>Confirm resolve?</span>
            <button
              className="zn-pill"
              style={{ ...btnStyle, background: "var(--zn-safe)", color: "#fff" }}
              onClick={() => { setResolved(true); setConfirmResolve(false); }}
            >
              <Check className="size-3.5" /> Yes, resolve
            </button>
            <button
              className="zn-pill zn-pill-ghost"
              style={btnStyle}
              onClick={() => setConfirmResolve(false)}
            >
              <X className="size-3.5" />
            </button>
          </div>
        ) : (
          <button
            className="zn-pill zn-pill-ghost"
            style={btnStyle}
            onClick={() => setConfirmResolve(true)}
          >
            <Check className="size-3.5" /> Resolve & resume chase
          </button>
        )}

        <div className="flex-1" />

        {owner && (
          <span className="zn-pill zn-pill-ghost" style={btnStyle}>
            Owner · {owner}
          </span>
        )}
      </div>

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
            style={{
              background: "var(--zn-surface)",
              border: "1px solid var(--zn-line-soft)",
              color: "var(--zn-ink)",
              minHeight: 120,
            }}
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
          />
          {isDemo ? (
            <p className="text-[11.5px]" style={{ color: "var(--zn-ink-3)" }}>
              Demo mode — import real invoices to send emails.
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <button className="zn-pill zn-pill-ghost" style={btnStyle} onClick={() => setPanel(null)}>
              Cancel
            </button>
            {replySent ? (
              <span className="zn-pill" style={{ ...btnStyle, background: "var(--zn-safe)", color: "#fff" }}>
                <Check className="size-3.5" /> Sent
              </span>
            ) : (
              <button
                className="zn-pill"
                style={btnStyle}
                onClick={() => { setReplySent(true); setTimeout(() => { setPanel(null); setReplySent(false); }, 1500); }}
              >
                <Send className="size-3.5" /> {isDemo ? "Copy draft" : "Send email"}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Evidence panel */}
      {panel === "evidence" && (
        <div
          className="rounded-[10px] p-3.5 flex flex-col gap-2.5"
          style={{ background: "var(--zn-surface-2)", border: "1px solid var(--zn-line)" }}
        >
          <div className="text-[11px] font-semibold uppercase tracking-[0.1em]" style={{ color: "var(--zn-ink-3)" }}>
            Add evidence note
          </div>
          <textarea
            className="w-full rounded-lg text-[13px] leading-[1.55] resize-none p-2.5 outline-none"
            style={{
              background: "var(--zn-surface)",
              border: "1px solid var(--zn-line-soft)",
              color: "var(--zn-ink)",
              minHeight: 80,
            }}
            placeholder="Describe the evidence — e.g. PO number confirmed, delivery receipt attached…"
            value={evidenceText}
            onChange={(e) => setEvidenceText(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <button className="zn-pill zn-pill-ghost" style={btnStyle} onClick={() => setPanel(null)}>
              Cancel
            </button>
            {evidenceSaved ? (
              <span className="zn-pill" style={{ ...btnStyle, background: "var(--zn-safe)", color: "#fff" }}>
                <Check className="size-3.5" /> Saved
              </span>
            ) : (
              <button
                className="zn-pill"
                style={btnStyle}
                disabled={!evidenceText.trim()}
                onClick={() => { setEvidenceSaved(true); setPanel(null); }}
              >
                Save note
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
