"use client";

/**
 * Modal shown on first /demo visit (and whenever the visitor clicks
 * "Switch plan" in the sidebar). Lets them choose which plan tier to
 * preview, or "Show everything" to see all features in one go.
 *
 * Choice persists in localStorage via lib/demo-plan.ts. No real
 * subscription, no payment, no Supabase — purely a presentation
 * preference for the demo area.
 */

import { useEffect, useState } from "react";
import { ArrowRight, Sparkles, X } from "lucide-react";
import { DEMO_PLANS, readDemoPlan, writeDemoPlan, type DemoPlanId } from "@/lib/demo-plan";

interface Props {
  /** When true, the modal renders regardless of saved preference. Used by the "Switch plan" link. */
  forceOpen?: boolean;
  /** Called once the user picks (or closes). */
  onClose?:   () => void;
}

export function DemoPlanPicker({ forceOpen, onClose }: Props) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<DemoPlanId>("solo");

  useEffect(() => {
    if (forceOpen) { setOpen(true); return; }
    // First visit only — no saved choice yet.
    const saved = readDemoPlan();
    if (!saved) setOpen(true);
    else setSelected(saved);
  }, [forceOpen]);

  function confirm(plan: DemoPlanId) {
    writeDemoPlan(plan);
    setOpen(false);
    onClose?.();
  }

  function dismiss() {
    // Only allow dismissing when the user already has a saved plan
    // (i.e. they re-opened via "Switch plan"). On first visit we want a
    // deliberate choice so the rest of the demo is correctly scoped.
    if (readDemoPlan()) {
      setOpen(false);
      onClose?.();
    }
    // Otherwise: ignore the dismiss attempt. The user must pick a plan.
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.55)" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="demo-plan-title"
    >
      <div
        className="relative w-full max-w-[860px] rounded-2xl overflow-hidden shadow-2xl max-h-[90vh] overflow-y-auto"
        style={{ background: "var(--zn-bg)" }}
      >
        {/* X is only shown when the user already has a saved plan
            (re-opened via "Switch plan"). First-time visitors must
            pick a plan so the rest of the demo is correctly scoped. */}
        {readDemoPlan() && (
          <button
            type="button"
            onClick={dismiss}
            aria-label="Close picker"
            className="absolute top-4 right-4 size-8 rounded-full inline-flex items-center justify-center hover:bg-black/5 z-10"
            style={{ color: "var(--zn-ink-3)" }}
          >
            <X className="size-4" />
          </button>
        )}

        {/* Header */}
        <div className="px-7 pt-7 pb-5 border-b" style={{ borderColor: "var(--zn-line-soft)" }}>
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="size-4" style={{ color: "var(--zn-accent)" }} />
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em]"
               style={{ color: "var(--zn-ink-3)" }}>
              Choose a demo plan
            </p>
          </div>
          <h2 id="demo-plan-title"
              className="text-[24px] font-semibold tracking-[-0.01em] leading-tight"
              style={{ color: "var(--zn-ink)" }}>
            Which plan would you like to see?
          </h2>
          <p className="mt-1.5 text-[13.5px]" style={{ color: "var(--zn-ink-3)" }}>
            Each plan unlocks a different set of features. Pick the one that fits how you work — or
            choose <strong>Show everything</strong> to compare them all.
          </p>
        </div>

        {/* Plan grid */}
        <div className="p-5 sm:p-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {DEMO_PLANS.map((plan) => {
            const isSelected = selected === plan.id;
            const isShowcase = plan.id === "all";
            const titleId = `demo-plan-card-${plan.id}-title`;
            return (
              <button
                key={plan.id}
                type="button"
                onClick={() => setSelected(plan.id)}
                aria-pressed={isSelected}
                aria-labelledby={titleId}
                className="text-left rounded-xl p-4 transition-all"
                style={{
                  background:  isSelected ? "var(--zn-surface)" : "var(--zn-bg-2)",
                  border:      `2px solid ${isSelected ? "var(--zn-accent)" : "var(--zn-line-soft)"}`,
                  outline:     "none",
                }}
              >
                <div className="flex items-baseline justify-between gap-2 mb-1">
                  <span id={titleId} className="text-[14.5px] font-semibold" style={{ color: "var(--zn-ink)" }}>
                    {plan.label}
                  </span>
                  <span className="text-[11px] font-semibold tabular-nums"
                        style={{ color: isShowcase ? "var(--zn-accent)" : "var(--zn-ink-3)" }}>
                    {plan.priceLabel}
                  </span>
                </div>
                <p className="text-[12px] mb-2" style={{ color: "var(--zn-ink-2)" }}>
                  {plan.tagline}
                </p>
                <p className="text-[11.5px] leading-[1.5] mb-3" style={{ color: "var(--zn-ink-3)" }}>
                  {plan.bestFor}
                </p>
                <ul className="space-y-1 text-[11.5px]" style={{ color: "var(--zn-ink-2)" }}>
                  {plan.features.slice(0, 5).map((f) => (
                    <li key={f} className="flex gap-1.5">
                      <span style={{ color: "var(--zn-accent)" }}>•</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </button>
            );
          })}
        </div>

        {/* Confirm */}
        <div className="px-6 pb-6 pt-2 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
          <p className="text-[11.5px]" style={{ color: "var(--zn-ink-3)" }}>
            You can switch any time from the sidebar. Your choice is saved on this device only — no account or sign-up needed.
          </p>
          <button
            type="button"
            onClick={() => confirm(selected)}
            className="zn-pill"
            style={{ height: 38, padding: "0 18px", fontSize: 13 }}
          >
            Show me the {DEMO_PLANS.find((p) => p.id === selected)?.label} demo
            <ArrowRight className="size-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
