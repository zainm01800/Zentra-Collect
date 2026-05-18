"use client";

/**
 * Reply Triage — paste a debtor reply, get an instant classification.
 *
 * Calls /api/zentra/classify-reply, surfaces the intent bucket
 * (promise to pay, dispute, stall, etc.) and a suggested next action.
 * Optionally pre-fills invoice context when opened from a specific row.
 */

import { useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  HelpCircle,
  MessageSquare,
  X,
  Zap,
} from "lucide-react";
import type { ReplyClassificationResult, ReplyClassificationType } from "@/lib/ai/reply-classifier";

// ── Label + colour config ─────────────────────────────────────────────────────

const CLASSIFICATION_META: Record<
  ReplyClassificationType,
  { label: string; description: string; color: string; bg: string; icon: React.ElementType }
> = {
  promise_to_pay:    { label: "Promise to pay",       description: "Debtor has committed to a payment date or amount.",          color: "var(--zn-safe)",   bg: "var(--zn-safe-soft)",  icon: CheckCircle2 },
  dispute:           { label: "Invoice dispute",       description: "Debtor is contesting the invoice or amount.",                color: "var(--zn-risk)",   bg: "var(--zn-risk-soft)",  icon: AlertCircle },
  already_paid_claim:{ label: "Claims already paid",  description: "Debtor says payment has already been made.",                 color: "var(--zn-warn)",   bg: "var(--zn-warn-soft)",  icon: AlertCircle },
  needs_invoice_copy:{ label: "Needs invoice copy",   description: "Debtor is requesting a copy of the invoice.",                color: "var(--zn-ink-2)",  bg: "var(--zn-surface-2)",  icon: FileText },
  needs_statement:   { label: "Needs statement",      description: "Debtor is requesting a statement of account.",               color: "var(--zn-ink-2)",  bg: "var(--zn-surface-2)",  icon: FileText },
  needs_remittance:  { label: "Needs remittance info",description: "Debtor needs bank details or remittance advice.",            color: "var(--zn-ink-2)",  bg: "var(--zn-surface-2)",  icon: FileText },
  wrong_contact:     { label: "Wrong contact",        description: "You've reached someone who isn't responsible for payment.",  color: "var(--zn-warn)",   bg: "var(--zn-warn-soft)",  icon: MessageSquare },
  asks_for_PO:       { label: "Needs PO number",      description: "Payment is being held pending a purchase order.",           color: "var(--zn-warn)",   bg: "var(--zn-warn-soft)",  icon: FileText },
  partial_payment:   { label: "Partial payment offer",description: "Debtor is offering to pay part of the amount.",             color: "var(--zn-warn)",   bg: "var(--zn-warn-soft)",  icon: CheckCircle2 },
  refusal_or_delay:  { label: "Stall or refusal",     description: "Debtor is delaying or refuses to commit to a date.",        color: "var(--zn-risk)",   bg: "var(--zn-risk-soft)",  icon: Clock },
  unclear:           { label: "Unclear intent",       description: "The reply doesn't map to a clear collection category.",     color: "var(--zn-ink-3)",  bg: "var(--zn-surface-2)",  icon: HelpCircle },
};

const CONFIDENCE_LABELS: Record<string, { label: string; color: string }> = {
  high:   { label: "High confidence",   color: "var(--zn-safe)" },
  medium: { label: "Medium confidence", color: "var(--zn-warn)" },
  low:    { label: "Low confidence",    color: "var(--zn-risk)" },
};

// ── Component ─────────────────────────────────────────────────────────────────

export function ReplyTriageModal({
  open,
  onClose,
  prefillCustomer,
  prefillInvoice,
  prefillAmount,
}: {
  open: boolean;
  onClose: () => void;
  prefillCustomer?: string;
  prefillInvoice?: string;
  prefillAmount?: number;
}) {
  const [replyText, setReplyText] = useState("");
  const [customerName, setCustomerName] = useState(prefillCustomer ?? "");
  const [invoiceNumber, setInvoiceNumber] = useState(prefillInvoice ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReplyClassificationResult | null>(null);

  if (!open) return null;

  function reset() {
    setReplyText("");
    setResult(null);
    setError(null);
    setLoading(false);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function classify() {
    if (!replyText.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/zentra/classify-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          replyText: replyText.trim(),
          customerName: customerName.trim() || undefined,
          invoiceNumber: invoiceNumber.trim() || undefined,
          amountOutstanding: prefillAmount,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? `Request failed (${res.status})`);
      }

      const data = await res.json() as ReplyClassificationResult;
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Classification failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const meta = result ? CLASSIFICATION_META[result.classification] : null;
  const confidenceMeta = result ? CONFIDENCE_LABELS[result.confidence] : null;
  const Icon = meta?.icon ?? HelpCircle;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/25 backdrop-blur-[2px]"
        onClick={handleClose}
      />

      {/* Modal */}
      <div
        className="fixed inset-x-4 bottom-0 top-auto sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 z-50 w-full sm:max-w-[560px] rounded-t-2xl sm:rounded-2xl overflow-hidden flex flex-col max-h-[90dvh]"
        style={{ background: "var(--zn-surface)", boxShadow: "0 24px 64px rgba(0,0,0,0.18)" }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between gap-3 px-5 py-4 border-b shrink-0"
          style={{ borderColor: "var(--zn-line-soft)" }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="size-7 rounded-lg flex items-center justify-center"
              style={{ background: "var(--zn-surface-2)" }}
            >
              <Zap className="size-3.5" style={{ color: "var(--zn-ink-2)" }} />
            </div>
            <div>
              <p className="text-[14px] font-semibold" style={{ color: "var(--zn-ink)" }}>
                Classify a debtor reply
              </p>
              <p className="text-[11.5px]" style={{ color: "var(--zn-ink-3)" }}>
                Paste the email or message you received
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 rounded-lg hover:bg-black/5"
            aria-label="Close"
          >
            <X className="size-4" style={{ color: "var(--zn-ink-3)" }} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
          {/* Input form */}
          {!result && (
            <div className="px-5 py-4 flex flex-col gap-4">
              {/* Optional context */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-semibold uppercase tracking-[0.07em]" style={{ color: "var(--zn-ink-3)" }}>
                    Customer (optional)
                  </label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="e.g. Acme Ltd"
                    className="rounded-[8px] border px-3 py-2 text-[13px] outline-none"
                    style={{ background: "var(--zn-surface)", borderColor: "var(--zn-line)", color: "var(--zn-ink)" }}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-semibold uppercase tracking-[0.07em]" style={{ color: "var(--zn-ink-3)" }}>
                    Invoice ref (optional)
                  </label>
                  <input
                    type="text"
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    placeholder="e.g. INV-0042"
                    className="rounded-[8px] border px-3 py-2 text-[13px] outline-none"
                    style={{ background: "var(--zn-surface)", borderColor: "var(--zn-line)", color: "var(--zn-ink)" }}
                  />
                </div>
              </div>

              {/* Reply text */}
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-semibold uppercase tracking-[0.07em]" style={{ color: "var(--zn-ink-3)" }}>
                  Debtor reply
                </label>
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Paste the reply email or message here…"
                  rows={7}
                  className="w-full rounded-[8px] border px-3 py-2.5 text-[13px] leading-relaxed outline-none resize-none"
                  style={{ background: "var(--zn-surface)", borderColor: "var(--zn-line)", color: "var(--zn-ink)" }}
                  autoFocus
                />
              </div>

              {error && (
                <p className="text-[12.5px] rounded-lg px-3 py-2" style={{ background: "var(--zn-risk-soft)", color: "var(--zn-risk)" }}>
                  {error}
                </p>
              )}

              <div className="flex items-center justify-between gap-3">
                <p className="text-[11.5px]" style={{ color: "var(--zn-ink-3)" }}>
                  Your reply stays private — never shared or stored.
                </p>
                <button
                  type="button"
                  onClick={classify}
                  disabled={!replyText.trim() || loading}
                  className="zn-pill"
                  style={{ opacity: (!replyText.trim() || loading) ? 0.5 : 1 }}
                >
                  {loading ? "Classifying…" : "Classify reply"}
                </button>
              </div>
            </div>
          )}

          {/* Result */}
          {result && meta && (
            <div className="px-5 py-4 flex flex-col gap-4">
              {/* Classification badge */}
              <div
                className="flex items-start gap-3 rounded-xl px-4 py-3.5"
                style={{ background: meta.bg, border: `1px solid ${meta.color}30` }}
              >
                <Icon className="size-5 mt-0.5 shrink-0" style={{ color: meta.color }} />
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-[14px] font-semibold" style={{ color: meta.color }}>
                      {meta.label}
                    </p>
                    {confidenceMeta && (
                      <span
                        className="text-[10.5px] font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: "rgba(255,255,255,0.6)", color: confidenceMeta.color }}
                      >
                        {confidenceMeta.label}
                      </span>
                    )}
                  </div>
                  <p className="text-[12.5px] mt-1 leading-relaxed" style={{ color: "var(--zn-ink-2)" }}>
                    {result.reason}
                  </p>
                </div>
              </div>

              {/* Extracted data */}
              {(result.extractedPromiseDate || result.extractedPromiseAmount || result.extractedDisputeReason) && (
                <div
                  className="rounded-xl px-4 py-3 flex flex-col gap-2"
                  style={{ background: "var(--zn-surface-2)", border: "1px solid var(--zn-line-soft)" }}
                >
                  <p className="text-[10.5px] font-semibold uppercase tracking-[0.07em]" style={{ color: "var(--zn-ink-3)" }}>
                    Extracted details
                  </p>
                  {result.extractedPromiseDate && (
                    <div className="flex items-center gap-2">
                      <Clock className="size-3.5 shrink-0" style={{ color: "var(--zn-ink-3)" }} />
                      <p className="text-[13px]" style={{ color: "var(--zn-ink-2)" }}>
                        Promise date: <strong style={{ color: "var(--zn-ink)" }}>{result.extractedPromiseDate}</strong>
                      </p>
                    </div>
                  )}
                  {result.extractedPromiseAmount && (
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="size-3.5 shrink-0" style={{ color: "var(--zn-ink-3)" }} />
                      <p className="text-[13px]" style={{ color: "var(--zn-ink-2)" }}>
                        Promised amount: <strong style={{ color: "var(--zn-ink)" }}>£{result.extractedPromiseAmount.toLocaleString("en-GB")}</strong>
                      </p>
                    </div>
                  )}
                  {result.extractedDisputeReason && (
                    <div className="flex items-center gap-2">
                      <AlertCircle className="size-3.5 shrink-0" style={{ color: "var(--zn-risk)" }} />
                      <p className="text-[13px]" style={{ color: "var(--zn-ink-2)" }}>
                        Dispute: <strong style={{ color: "var(--zn-ink)" }}>{result.extractedDisputeReason}</strong>
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Suggested next action */}
              <div
                className="rounded-xl px-4 py-3 flex flex-col gap-1.5"
                style={{ background: "var(--zn-surface-2)", border: "1px solid var(--zn-line-soft)" }}
              >
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.07em]" style={{ color: "var(--zn-ink-3)" }}>
                  Suggested next action
                </p>
                <div className="flex items-start gap-2">
                  <ChevronRight className="size-4 mt-0.5 shrink-0" style={{ color: "var(--zn-ink-2)" }} />
                  <p className="text-[13px] leading-relaxed" style={{ color: "var(--zn-ink)" }}>
                    {result.suggestedNextAction}
                  </p>
                </div>
                {result.suggestedStatusUpdate && result.suggestedStatusUpdate !== "Manual review" && (
                  <p className="text-[12px] mt-0.5" style={{ color: "var(--zn-ink-3)" }}>
                    Status update: <span style={{ color: "var(--zn-ink-2)" }}>{result.suggestedStatusUpdate}</span>
                  </p>
                )}
              </div>

              {/* Manual review notice */}
              {result.requiresManualReview && (
                <p
                  className="text-[11.5px] leading-relaxed rounded-lg px-3 py-2"
                  style={{ background: "var(--zn-warn-soft)", color: "var(--zn-ink-2)" }}
                >
                  <strong>Review required.</strong> Always read the reply yourself before updating invoice status or sending a follow-up.
                </p>
              )}

              {/* Context used */}
              {(customerName || invoiceNumber) && (
                <p className="text-[11.5px]" style={{ color: "var(--zn-ink-3)" }}>
                  Classified for{customerName ? ` ${customerName}` : ""}{invoiceNumber ? ` · ${invoiceNumber}` : ""} · {result.source === "ai" ? "AI" : "Rules"}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between gap-3 px-5 py-3.5 border-t shrink-0"
          style={{ borderColor: "var(--zn-line-soft)" }}
        >
          {result ? (
            <>
              <button
                type="button"
                onClick={reset}
                className="text-[13px] font-medium"
                style={{ color: "var(--zn-ink-3)" }}
              >
                ← Classify another
              </button>
              <button
                type="button"
                onClick={handleClose}
                className="zn-pill zn-pill-ghost"
                style={{ height: 34, fontSize: 13 }}
              >
                Done
              </button>
            </>
          ) : (
            <p className="text-[11.5px]" style={{ color: "var(--zn-ink-3)" }}>
              Works with emails, WhatsApp messages, texts, or any written reply.
            </p>
          )}
        </div>
      </div>
    </>
  );
}
