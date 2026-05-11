"use client";

/**
 * src/components/payment-link-button.tsx
 *
 * "Add payment link" button for the chase action drawer.
 *
 * Clicking it calls createPaymentLink() on the server to generate a
 * Stripe Payment Link for the outstanding invoice amount.  The URL is
 * then injected into the draft message via the onInsert callback, and
 * also shown inline so the user can copy it independently.
 *
 * States: idle → generating → done (url visible) / error
 */

import { useState, useTransition } from "react";
import { CheckCircle2, Copy, ExternalLink, Link2, Loader2 } from "lucide-react";
import { createPaymentLink } from "@/actions/payment-links";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PaymentLinkButtonProps {
  invoiceRef:        string;
  clientName:        string;
  amountOutstanding: number;
  currency?:         string;
  /** Called with the generated URL so the parent can append it to the draft. */
  onInsert:          (url: string) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function PaymentLinkButton({
  invoiceRef,
  clientName,
  amountOutstanding,
  currency = "gbp",
  onInsert,
}: PaymentLinkButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [url, setUrl]               = useState<string | null>(null);
  const [error, setError]           = useState<string | null>(null);
  const [copied, setCopied]         = useState(false);
  const [inserted, setInserted]     = useState(false);

  function handleGenerate() {
    setError(null);
    startTransition(async () => {
      const result = await createPaymentLink({
        invoiceRef,
        clientName,
        amountOutstanding,
        currency,
      });
      if (result.ok) {
        setUrl(result.url);
        // Auto-insert into draft on first generation
        onInsert(result.url);
        setInserted(true);
      } else {
        setError(result.error);
      }
    });
  }

  function handleCopy() {
    if (!url) return;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleInsertAgain() {
    if (!url) return;
    onInsert(url);
    setInserted(true);
  }

  // ── Idle / generating state ───────────────────────────────────────────────

  if (!url) {
    return (
      <div className="mt-3">
        <button
          type="button"
          onClick={handleGenerate}
          disabled={isPending}
          className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors disabled:opacity-50"
          style={{
            borderColor: "var(--zn-line)",
            color:       "var(--zn-ink-2)",
            background:  "transparent",
          }}
        >
          {isPending ? (
            <Loader2 className="size-3 animate-spin" aria-hidden />
          ) : (
            <Link2 className="size-3" aria-hidden />
          )}
          {isPending ? "Generating link…" : "Add payment link"}
        </button>

        {error && (
          <p className="mt-2 text-[11.5px]" style={{ color: "var(--zn-risk)" }}>
            {error}
          </p>
        )}
      </div>
    );
  }

  // ── Done state — URL generated ────────────────────────────────────────────

  return (
    <div
      className="mt-3 rounded-[10px] p-3 space-y-2"
      style={{
        background: "var(--zn-safe-soft)",
        border:     "1px solid var(--zn-safe)",
      }}
    >
      {/* Header row */}
      <div className="flex items-center gap-1.5">
        <CheckCircle2 className="size-3.5 flex-shrink-0" style={{ color: "var(--zn-safe)" }} />
        <span className="text-[12px] font-semibold" style={{ color: "var(--zn-safe)" }}>
          Payment link ready
        </span>
        {inserted && (
          <span
            className="ml-auto text-[10.5px] font-medium"
            style={{ color: "var(--zn-safe)" }}
          >
            Added to draft ✓
          </span>
        )}
      </div>

      {/* URL pill */}
      <div
        className="flex items-center gap-2 rounded-[8px] px-2.5 py-1.5"
        style={{ background: "rgba(255,255,255,0.6)" }}
      >
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 min-w-0 text-[11px] truncate font-mono"
          style={{ color: "var(--zn-ink-2)" }}
        >
          {url}
        </a>
        <ExternalLink className="size-3 flex-shrink-0" style={{ color: "var(--zn-ink-3)" }} />
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors"
          style={{
            borderColor: "var(--zn-safe)",
            color:       "var(--zn-safe)",
            background:  "transparent",
          }}
        >
          <Copy className="size-3" aria-hidden />
          {copied ? "Copied!" : "Copy"}
        </button>

        {!inserted && (
          <button
            type="button"
            onClick={handleInsertAgain}
            className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors"
            style={{
              borderColor: "var(--zn-safe)",
              color:       "var(--zn-safe)",
              background:  "transparent",
            }}
          >
            <Link2 className="size-3" aria-hidden />
            Add to draft
          </button>
        )}

        <button
          type="button"
          onClick={handleGenerate}
          disabled={isPending}
          className="ml-auto text-[10.5px] transition-opacity disabled:opacity-40"
          style={{ color: "var(--zn-ink-3)" }}
        >
          {isPending ? "Generating…" : "Regenerate"}
        </button>
      </div>
    </div>
  );
}
