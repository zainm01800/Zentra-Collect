"use client";

/**
 * OnboardingGuide — guided first-5-minutes experience.
 *
 * Shows a floating tooltip anchored to the #1 chase row, walking the user
 * through: "This is your #1 priority" → "Click Review to open the drawer"
 * → "Record an outcome". Dismissed permanently via localStorage.
 *
 * Mount <OnboardingGuide /> in the app shell alongside ReviewDrawer.
 * It manages its own visibility and does nothing after dismissal.
 */

import { useEffect, useRef, useState } from "react";
import { ArrowRight, X } from "lucide-react";

const DISMISSED_KEY = "zentra.onboarding.v1.dismissed";
const STEP_KEY = "zentra.onboarding.v1.step";

type Step = 0 | 1 | 2;

const STEPS: { heading: string; body: string; cta: string }[] = [
  {
    heading: "This is your #1 priority",
    body: "Zentra ranked every overdue invoice by risk, amount, and days outstanding. Start here — not at the top of a spreadsheet.",
    cta: "Got it",
  },
  {
    heading: "Open it to review",
    body: "Click the customer name or the Review button to open the chase drawer. You'll see the draft message, safety checks, and all the context you need.",
    cta: "Open the drawer",
  },
  {
    heading: "Record what you did",
    body: "After you've sent a message, mark the outcome: Sent, Promised, Paid, or Dispute. That's it — the queue updates automatically.",
    cta: "Done",
  },
];

interface Props {
  /** Selector for the element to point at (the first chase row's Review button). */
  anchorSelector?: string;
}

export function OnboardingGuide({ anchorSelector = "[data-chase-row-first]" }: Props) {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState<Step>(0);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(DISMISSED_KEY)) return;
    const saved = parseInt(localStorage.getItem(STEP_KEY) ?? "0", 10);
    setStep((Math.min(saved, 2)) as Step);
    setVisible(true);
  }, []);

  // Position tooltip relative to anchor element
  useEffect(() => {
    if (!visible) return;
    function measure() {
      const anchor = document.querySelector(anchorSelector);
      if (!anchor) { setPos(null); return; }
      const rect = anchor.getBoundingClientRect();
      const tooltip = tooltipRef.current;
      const tw = tooltip?.offsetWidth ?? 300;
      const left = Math.min(rect.left + rect.width / 2 - tw / 2, window.innerWidth - tw - 16);
      setPos({ top: rect.bottom + 12, left: Math.max(left, 16) });
    }
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [visible, anchorSelector, step]);

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, "1");
    setVisible(false);
  }

  function advance() {
    if (step >= 2) { dismiss(); return; }
    const next = (step + 1) as Step;
    setStep(next);
    localStorage.setItem(STEP_KEY, String(next));
  }

  if (!visible) return null;

  const current = STEPS[step];

  return (
    <>
      {/* Pulse ring on anchor element */}
      <PulseRing anchorSelector={anchorSelector} />

      {/* Floating tooltip */}
      <div
        ref={tooltipRef}
        className="fixed z-[9990] animate-in fade-in slide-in-from-top-2 duration-200"
        style={{
          top: pos?.top ?? "50%",
          left: pos?.left ?? "50%",
          width: 300,
          background: "var(--zn-ink)",
          borderRadius: 14,
          padding: "14px 16px",
          boxShadow: "0 8px 32px rgba(29,24,19,0.25)",
          ...(pos ? {} : { transform: "translate(-50%, -50%)" }),
        }}
      >
        {/* Caret */}
        {pos && (
          <div
            style={{
              position: "absolute",
              top: -6,
              left: "50%",
              transform: "translateX(-50%)",
              width: 0,
              height: 0,
              borderLeft: "6px solid transparent",
              borderRight: "6px solid transparent",
              borderBottom: "6px solid var(--zn-ink)",
            }}
          />
        )}

        {/* Step dots */}
        <div className="flex items-center gap-1 mb-2.5">
          {STEPS.map((_, i) => (
            <span
              key={i}
              style={{
                width: i === step ? 16 : 6,
                height: 6,
                borderRadius: 999,
                background: i === step ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.25)",
                transition: "width 0.2s ease, background 0.2s ease",
              }}
            />
          ))}
          <button
            onClick={dismiss}
            className="ml-auto rounded-full p-0.5 hover:bg-white/10 transition-colors"
            aria-label="Skip guide"
          >
            <X className="size-3" style={{ color: "rgba(255,255,255,0.5)" }} />
          </button>
        </div>

        <p className="text-[13.5px] font-semibold mb-1" style={{ color: "#fff" }}>
          {current.heading}
        </p>
        <p className="text-[12px] leading-relaxed mb-3" style={{ color: "rgba(255,255,255,0.7)" }}>
          {current.body}
        </p>
        <button
          onClick={advance}
          className="flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-full transition-colors hover:bg-white/20"
          style={{ background: "rgba(255,255,255,0.12)", color: "#fff" }}
        >
          {current.cta}
          {step < 2 && <ArrowRight className="size-3" />}
        </button>
      </div>
    </>
  );
}

/** Animated pulse ring rendered around the anchor element. */
function PulseRing({ anchorSelector }: { anchorSelector: string }) {
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    function measure() {
      const el = document.querySelector(anchorSelector);
      if (!el) { setRect(null); return; }
      setRect(el.getBoundingClientRect());
    }
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [anchorSelector]);

  if (!rect) return null;

  return (
    <div
      className="pointer-events-none fixed z-[9989]"
      style={{
        top: rect.top - 4,
        left: rect.left - 4,
        width: rect.width + 8,
        height: rect.height + 8,
        borderRadius: 10,
        border: "2px solid var(--zn-accent)",
        animation: "onboard-pulse 1.8s ease-in-out infinite",
      }}
    >
      <style>{`
        @keyframes onboard-pulse {
          0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(var(--zn-accent-rgb, 180,130,60), 0.4); }
          50%       { opacity: 0.7; box-shadow: 0 0 0 8px rgba(var(--zn-accent-rgb, 180,130,60), 0); }
        }
      `}</style>
    </div>
  );
}

/** Call this to reset the onboarding guide (for demo/testing). */
export function resetOnboarding() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(DISMISSED_KEY);
  localStorage.removeItem(STEP_KEY);
}
