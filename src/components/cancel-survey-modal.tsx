"use client";

/**
 * Cancel-intent survey + save offer.
 *
 * Shown when the user clicks "Thinking about cancelling?" on the
 * account/billing page. Three steps:
 *   1. Reason picker — captures why (used to drive retention work)
 *   2. Save offer — "pause for 2 months at 50%" (or a tier downgrade)
 *   3. Goodbye — opens the Stripe portal if they still want to cancel
 *
 * The reason is stored to /api/account/cancel-feedback (best-effort —
 * fails silently if the endpoint isn't deployed yet). The save-offer
 * "Pause" CTA marks an intent in the account record; actually applying
 * the pause is handled server-side via Stripe later.
 */

import { useState } from "react";
import { ArrowRight, Loader2, Pause, X } from "lucide-react";

interface Props {
  open:    boolean;
  onClose: () => void;
}

type Reason =
  | "too_expensive"
  | "missing_feature"
  | "switched_tool"
  | "not_using"
  | "temporary_break"
  | "other";

const REASONS: { id: Reason; label: string }[] = [
  { id: "too_expensive",  label: "Too expensive" },
  { id: "missing_feature", label: "Missing a feature I need" },
  { id: "switched_tool",  label: "Switched to another tool" },
  { id: "not_using",      label: "Not using it enough" },
  { id: "temporary_break", label: "Just taking a break" },
  { id: "other",          label: "Other" },
];

export function CancelSurveyModal({ open, onClose }: Props) {
  const [step, setStep] = useState<"reason" | "offer" | "goodbye">("reason");
  const [reason, setReason] = useState<Reason | null>(null);
  const [detail, setDetail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  async function recordFeedback(action: "pause" | "cancel" | "kept") {
    if (!reason) return;
    setSubmitting(true);
    try {
      await fetch("/api/account/cancel-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason, detail, action }),
      });
    } catch { /* best-effort */ }
    finally { setSubmitting(false); }
  }

  async function pause() {
    await recordFeedback("pause");
    // In the real product this triggers Stripe coupon + pause_collection.
    // For now we record the intent and confirm.
    alert("Your account will be paused for 2 months at 50%. We'll email you to confirm.");
    onClose();
  }

  async function openPortal() {
    await recordFeedback("cancel");
    setSubmitting(true);
    try {
      const r = await fetch("/api/billing/portal", { method: "POST" });
      const data = await r.json();
      if (r.ok && data.url) window.location.href = data.url;
      else { alert("Could not open billing portal. Try again or email support."); setSubmitting(false); }
    } catch { setSubmitting(false); }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4"
         style={{ background: "rgba(0,0,0,0.55)" }}
         role="dialog" aria-modal="true" aria-labelledby="cancel-survey-title">
      <div className="relative w-full max-w-[480px] rounded-2xl overflow-hidden shadow-2xl"
           style={{ background: "var(--zn-bg)" }}>
        <button type="button" onClick={onClose} aria-label="Close"
          className="absolute top-4 right-4 size-8 rounded-full inline-flex items-center justify-center hover:bg-black/5 z-10"
          style={{ color: "var(--zn-ink-3)" }}>
          <X className="size-4" />
        </button>

        {step === "reason" && (
          <div className="p-6">
            <h2 id="cancel-survey-title" className="text-[19px] font-semibold tracking-tight mb-1.5"
                style={{ color: "var(--zn-ink)" }}>
              Sorry to see you thinking about leaving
            </h2>
            <p className="text-[13px] mb-4" style={{ color: "var(--zn-ink-3)" }}>
              Mind telling us why? It genuinely helps us improve — and there might be a better option than cancelling.
            </p>
            <div className="space-y-1.5">
              {REASONS.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setReason(r.id)}
                  aria-pressed={reason === r.id}
                  className="w-full text-left rounded-lg px-3 py-2 text-[13px] transition-colors"
                  style={{
                    background: reason === r.id ? "var(--zn-surface)" : "transparent",
                    border:     `1px solid ${reason === r.id ? "var(--zn-accent)" : "var(--zn-line-soft)"}`,
                    color:      "var(--zn-ink-2)",
                  }}
                >
                  {r.label}
                </button>
              ))}
            </div>
            {(reason === "missing_feature" || reason === "other") && (
              <textarea
                value={detail}
                onChange={(e) => setDetail(e.target.value)}
                placeholder={reason === "missing_feature" ? "Which feature?" : "Anything else?"}
                rows={2}
                className="mt-3 w-full rounded-lg px-3 py-2 text-[13px] border resize-none"
                style={{ borderColor: "var(--zn-line)", background: "var(--zn-bg-2)" }}
              />
            )}
            <div className="flex items-center justify-between gap-3 mt-5">
              <button type="button" onClick={onClose}
                className="text-[12.5px]" style={{ color: "var(--zn-ink-3)" }}>
                Never mind, keep my plan
              </button>
              <button type="button" disabled={!reason} onClick={() => setStep("offer")}
                className="zn-pill text-[12px]" style={{ height: 34, padding: "0 14px" }}>
                Continue <ArrowRight className="size-3.5" />
              </button>
            </div>
          </div>
        )}

        {step === "offer" && (
          <div className="p-6">
            <div className="size-10 rounded-xl inline-flex items-center justify-center mb-3"
                 style={{ background: "var(--zn-accent-soft)", color: "var(--zn-accent)" }}>
              <Pause className="size-5" />
            </div>
            <h2 className="text-[19px] font-semibold tracking-tight mb-1.5"
                style={{ color: "var(--zn-ink)" }}>
              Pause for 2 months at 50%?
            </h2>
            <p className="text-[13px] mb-4" style={{ color: "var(--zn-ink-3)" }}>
              Your data stays exactly where it is. We&rsquo;ll halve your bill for the next two cycles and you can come back any time. No card change needed.
            </p>
            <div className="flex flex-col gap-2">
              <button type="button" disabled={submitting} onClick={pause}
                className="zn-pill w-full justify-center text-[13px]"
                style={{ height: 38 }}>
                {submitting ? <Loader2 className="size-3.5 animate-spin" /> : <Pause className="size-3.5" />}
                Pause my account
              </button>
              <button type="button" disabled={submitting} onClick={() => setStep("goodbye")}
                className="text-[12px] py-2 hover:underline"
                style={{ color: "var(--zn-ink-3)" }}>
                No thanks, I want to cancel
              </button>
            </div>
          </div>
        )}

        {step === "goodbye" && (
          <div className="p-6">
            <h2 className="text-[19px] font-semibold tracking-tight mb-1.5"
                style={{ color: "var(--zn-ink)" }}>
              We&rsquo;ll send you to Stripe to cancel
            </h2>
            <p className="text-[13px] mb-5" style={{ color: "var(--zn-ink-3)" }}>
              Your data stays available for 30 days in case you change your mind. After that it&rsquo;s deleted permanently.
            </p>
            <div className="flex flex-col gap-2">
              <button type="button" disabled={submitting} onClick={openPortal}
                className="inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2.5 text-[13px] font-semibold"
                style={{ background: "var(--zn-risk-soft)", color: "var(--zn-risk)" }}>
                {submitting && <Loader2 className="size-3.5 animate-spin" />}
                Take me to Stripe to cancel
              </button>
              <button type="button" disabled={submitting} onClick={() => { void recordFeedback("kept"); onClose(); }}
                className="text-[12px] py-2 hover:underline"
                style={{ color: "var(--zn-ink-3)" }}>
                Actually, I&rsquo;ll keep my plan
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
