"use client";

/**
 * src/components/email-send-button.tsx
 *
 * "Send email" inline panel for the chase action drawer.
 *
 * Collapses to a ghost button; expands into:
 *   - To:      email address input (pre-filled from invoice.customerEmail)
 *   - Subject: editable subject line
 *   - Body:    textarea pre-filled with the current draft message
 *   - Send button → calls sendSingleEmail server action
 *
 * States: idle → open → sending → sent (auto-resets after 4 s) / error
 */

import { useState, useTransition } from "react";
import { ChevronDown, Mail, Send, X } from "lucide-react";
import { sendSingleEmail, type OutstandingInvoice } from "@/actions/send-single-email";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface EmailSendButtonProps {
  invoiceRef:           string;
  clientName:           string;
  toEmail?:             string;              // pre-fills the To field
  draft:                string;              // pre-fills the body textarea
  outstandingInvoices?: OutstandingInvoice[]; // appended as statement of account
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function defaultSubject(clientName: string, invoiceRef: string): string {
  return `Invoice ${invoiceRef} — payment follow-up`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function EmailSendButton({
  invoiceRef,
  clientName,
  toEmail = "",
  draft,
  outstandingInvoices,
}: EmailSendButtonProps) {
  const [open, setOpen]               = useState(false);
  const [to, setTo]                   = useState(toEmail);
  const [subject, setSubject]         = useState(defaultSubject(clientName, invoiceRef));
  const [body, setBody]               = useState(draft);
  const [sent, setSent]               = useState(false);
  const [simulated, setSimulated]     = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [userEdited, setUserEdited]   = useState(false);
  const [isPending, startTransition]  = useTransition();

  // Sync draft when the drawer switches to a different invoice
  if (!userEdited && body !== draft) {
    setBody(draft);
  }

  function handleOpen() {
    setOpen(true);
    setError(null);
    setSent(false);
    setSimulated(false);
  }

  function handleClose() {
    setOpen(false);
    setError(null);
  }

  function handleSend() {
    setError(null);
    startTransition(async () => {
      const result = await sendSingleEmail({
        to,
        subject,
        bodyText:            body,
        invoiceRef,
        clientName,
        outstandingInvoices: outstandingInvoices && outstandingInvoices.length > 0
          ? outstandingInvoices
          : undefined,
      });

      if (result.ok) {
        setSent(true);
        setSimulated(result.simulated ?? false);
        setOpen(false);
        setTimeout(() => setSent(false), 5000);
      } else {
        setError(result.error ?? "Something went wrong.");
      }
    });
  }

  // ── Sent confirmation ─────────────────────────────────────────────────────

  if (sent) {
    return (
      <div
        className="flex items-center gap-2 rounded-[8px] px-3 py-2"
        style={{
          background: "var(--zn-safe-soft)",
          border:     "1px solid var(--zn-safe)",
        }}
      >
        <Mail className="size-3.5 flex-shrink-0" style={{ color: "var(--zn-safe)" }} />
        <span className="text-[12.5px] font-medium" style={{ color: "var(--zn-safe)" }}>
          {simulated
            ? "Email sent (demo — no real email delivered) ✓"
            : `Email sent to ${to} ✓`}
        </span>
      </div>
    );
  }

  // ── Idle trigger ──────────────────────────────────────────────────────────

  return (
    <div>
      {!open ? (
        <button
          type="button"
          onClick={handleOpen}
          className="w-full flex items-center justify-between rounded-[10px] border px-3 py-2.5 transition-colors hover:bg-[#f3ecd8] dark:hover:bg-[#2d2820]"
          style={{ borderColor: "var(--zn-line)", background: "transparent" }}
        >
          <span className="flex items-center gap-2">
            <Mail className="size-4" style={{ color: "var(--zn-ink-3)" }} />
            <span className="text-[12.5px] font-medium" style={{ color: "var(--zn-ink-2)" }}>
              Send email
            </span>
          </span>
          <ChevronDown className="size-3.5" style={{ color: "var(--zn-ink-3)" }} />
        </button>
      ) : (
        // ── Expanded panel ─────────────────────────────────────────────────

        <div
          className="rounded-[10px] border"
          style={{ borderColor: "var(--zn-line)", background: "var(--zn-bg-2)" }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-3 py-2.5 border-b"
            style={{ borderColor: "var(--zn-line-soft)" }}
          >
            <span className="flex items-center gap-2">
              <Mail className="size-3.5" style={{ color: "var(--zn-ink-3)" }} />
              <span className="text-[12.5px] font-semibold" style={{ color: "var(--zn-ink)" }}>
                Send email
              </span>
            </span>
            <button
              type="button"
              onClick={handleClose}
              className="rounded p-0.5 transition-colors hover:bg-[#ece3cc] dark:hover:bg-[#28231c]"
              aria-label="Close"
            >
              <X className="size-3.5" style={{ color: "var(--zn-ink-3)" }} />
            </button>
          </div>

          <div className="p-3 space-y-3">
            {/* To */}
            <div>
              <label
                htmlFor="email-to"
                className="block text-[11px] font-semibold mb-1 uppercase tracking-wide"
                style={{ color: "var(--zn-ink-3)" }}
              >
                To
              </label>
              <input
                id="email-to"
                type="email"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder="client@example.com"
                className="w-full rounded-[8px] border px-3 py-2 text-[13px]"
                style={{
                  borderColor: "var(--zn-line)",
                  background:  "var(--zn-surface)",
                  color:       "var(--zn-ink)",
                }}
              />
            </div>

            {/* Subject */}
            <div>
              <label
                htmlFor="email-subject"
                className="block text-[11px] font-semibold mb-1 uppercase tracking-wide"
                style={{ color: "var(--zn-ink-3)" }}
              >
                Subject
              </label>
              <input
                id="email-subject"
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full rounded-[8px] border px-3 py-2 text-[13px]"
                style={{
                  borderColor: "var(--zn-line)",
                  background:  "var(--zn-surface)",
                  color:       "var(--zn-ink)",
                }}
              />
            </div>

            {/* Body */}
            <div>
              <label
                htmlFor="email-body"
                className="block text-[11px] font-semibold mb-1 uppercase tracking-wide"
                style={{ color: "var(--zn-ink-3)" }}
              >
                Message
              </label>
              <textarea
                id="email-body"
                rows={6}
                value={body}
                onChange={(e) => {
                  setBody(e.target.value);
                  setUserEdited(true);
                }}
                className="w-full resize-none rounded-[8px] border px-3 py-2 text-[12.5px] leading-[1.5]"
                style={{
                  borderColor: "var(--zn-line)",
                  background:  "var(--zn-surface)",
                  color:       "var(--zn-ink)",
                }}
              />
            </div>

            {/* Error */}
            {error && (
              <p className="text-[11.5px]" style={{ color: "var(--zn-risk)" }}>
                {error}
              </p>
            )}

            {/* Disclaimer */}
            <p className="text-[10.5px] leading-[1.5]" style={{ color: "var(--zn-ink-3)" }}>
              Always review before sending. You are responsible for the content
              of every message sent from your account.
            </p>

            {/* Send button */}
            <button
              type="button"
              onClick={handleSend}
              disabled={!to.trim() || !subject.trim() || !body.trim() || isPending}
              className="w-full flex items-center justify-center gap-2 rounded-full py-2 text-[13px] font-semibold transition-opacity disabled:opacity-40"
              style={{
                background: "var(--zn-ink)",
                color:      "var(--zn-surface)",
              }}
            >
              <Send className="size-3.5" />
              {isPending ? "Sending…" : "Send email"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
