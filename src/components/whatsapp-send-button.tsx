"use client";

/**
 * src/components/whatsapp-send-button.tsx
 *
 * "Send via WhatsApp" button for the chase action drawer.
 *
 * Shows a ghost button that expands into an inline panel with:
 *   - Phone number input (auto-normalises to E.164 on send)
 *   - Message textarea (pre-filled with the current draft)
 *   - Send button → calls sendWhatsAppMessage server action
 *
 * States: idle → open → sending → sent / error
 */

import { useState, useTransition } from "react";
import { ChevronDown, MessageCircle, Send, X } from "lucide-react";
import { sendWhatsAppMessage } from "@/actions/whatsapp";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface WhatsAppSendButtonProps {
  invoiceRef:  string;
  clientName:  string;
  draft:       string;   // pre-fills the message textarea
}

// ── Component ─────────────────────────────────────────────────────────────────

export function WhatsAppSendButton({
  invoiceRef,
  clientName,
  draft,
}: WhatsAppSendButtonProps) {
  const [open, setOpen]           = useState(false);
  const [phone, setPhone]         = useState("");
  const [message, setMessage]     = useState(draft);
  const [sent, setSent]           = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Keep message in sync with draft when drawer changes invoice
  // (only sync if user hasn't edited it yet)
  const [userEdited, setUserEdited] = useState(false);
  if (!userEdited && message !== draft) {
    setMessage(draft);
  }

  function handleOpen() {
    setOpen(true);
    setError(null);
    setSent(false);
  }

  function handleClose() {
    setOpen(false);
    setError(null);
  }

  function handleSend() {
    setError(null);
    startTransition(async () => {
      const result = await sendWhatsAppMessage({
        to:         phone,
        message,
        invoiceRef,
        clientName,
      });

      if (result.ok) {
        setSent(true);
        setOpen(false);
        setTimeout(() => setSent(false), 4000);
      } else {
        setError(result.error);
      }
    });
  }

  // ── Sent confirmation ─────────────────────────────────────────────────────

  if (sent) {
    return (
      <div
        className="flex items-center gap-2 rounded-[8px] px-3 py-2"
        style={{ background: "var(--zn-safe-soft)", border: "1px solid var(--zn-safe)" }}
      >
        <MessageCircle className="size-3.5" style={{ color: "var(--zn-safe)" }} />
        <span className="text-[12.5px] font-medium" style={{ color: "var(--zn-safe)" }}>
          WhatsApp message sent ✓
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
          className="w-full flex items-center justify-between rounded-[10px] border px-3 py-2.5 transition-colors hover:bg-[#f3ecd8]"
          style={{ borderColor: "var(--zn-line)", background: "transparent" }}
        >
          <span className="flex items-center gap-2">
            <MessageCircle className="size-4" style={{ color: "var(--zn-ink-3)" }} />
            <span className="text-[12.5px] font-medium" style={{ color: "var(--zn-ink-2)" }}>
              Send via WhatsApp
            </span>
          </span>
          <ChevronDown className="size-3.5" style={{ color: "var(--zn-ink-3)" }} />
        </button>
      ) : (
        // ── Expanded panel ────────────────────────────────────────────────

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
              <MessageCircle className="size-3.5" style={{ color: "var(--zn-ink-3)" }} />
              <span className="text-[12.5px] font-semibold" style={{ color: "var(--zn-ink)" }}>
                Send via WhatsApp
              </span>
            </span>
            <button
              type="button"
              onClick={handleClose}
              className="rounded p-0.5 transition-colors hover:bg-[#ece3cc]"
              aria-label="Close"
            >
              <X className="size-3.5" style={{ color: "var(--zn-ink-3)" }} />
            </button>
          </div>

          <div className="p-3 space-y-3">
            {/* Phone number */}
            <div>
              <label
                htmlFor="wa-phone"
                className="block text-[11px] font-semibold mb-1 uppercase tracking-wide"
                style={{ color: "var(--zn-ink-3)" }}
              >
                {clientName}'s WhatsApp number
              </label>
              <input
                id="wa-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+44 7700 900 000"
                className="w-full rounded-[8px] border px-3 py-2 text-[13px]"
                style={{
                  borderColor: "var(--zn-line)",
                  background:  "var(--zn-surface)",
                  color:       "var(--zn-ink)",
                }}
              />
              <p className="mt-1 text-[10.5px]" style={{ color: "var(--zn-ink-3)" }}>
                Include country code. UK numbers start +44.
              </p>
            </div>

            {/* Message */}
            <div>
              <label
                htmlFor="wa-message"
                className="block text-[11px] font-semibold mb-1 uppercase tracking-wide"
                style={{ color: "var(--zn-ink-3)" }}
              >
                Message
              </label>
              <textarea
                id="wa-message"
                rows={5}
                value={message}
                onChange={(e) => {
                  setMessage(e.target.value);
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
              The recipient must have opted in to receive WhatsApp messages from
              you. Always review before sending.
            </p>

            {/* Send button */}
            <button
              type="button"
              onClick={handleSend}
              disabled={!phone.trim() || !message.trim() || isPending}
              className="w-full flex items-center justify-center gap-2 rounded-full py-2 text-[13px] font-semibold transition-opacity disabled:opacity-40"
              style={{
                background: "#25D366",   // WhatsApp green
                color:      "#ffffff",
              }}
            >
              <Send className="size-3.5" />
              {isPending ? "Sending…" : "Send message"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
