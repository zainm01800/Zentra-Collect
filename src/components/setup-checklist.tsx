"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CheckCircle2, Circle } from "lucide-react";

/**
 * Onboarding checklist on /today for users with no invoices yet.
 *
 * UX-2: previously the circles were fully manual indicators that read
 * as decorative. Now we auto-detect completion from observable state
 * (localStorage), so users see real progress as they take action —
 * and can still click to override.
 */

const STORAGE_KEY = "zentra.setup.steps.v1";
const INVOICES_KEY = "zentra.invoices.v1";
const CHASES_SENT_KEY = "zentra.chasesSent.v1";

const STEPS = [
  {
    id: "import",
    label: "Import your invoices",
    description: "Upload a CSV or AR ageing export to populate your chase plan.",
    href: "/import",
    cta: "Go to import",
  },
  {
    id: "review",
    label: "Review your chase plan",
    description: "See who needs chasing, ranked by urgency and risk.",
    href: "/chase-today",
    cta: "View chase plan",
  },
  {
    id: "message",
    label: "Send your first message",
    description: "Pick a contact, use the AI-drafted message, and send.",
    href: "/chase-today",
    cta: "Start chasing",
  },
] as const;

type StepId = (typeof STEPS)[number]["id"];

function readDone(): Set<StepId> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as string[]) : [];
    return new Set(parsed as StepId[]);
  } catch {
    return new Set();
  }
}

function writeDone(done: Set<StepId>) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...done]));
}

/** Best-effort: have they imported any invoices? */
function hasInvoices(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.localStorage.getItem(INVOICES_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0;
  } catch {
    return false;
  }
}

/** Best-effort: have they sent any chase emails? */
function hasSentChase(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.localStorage.getItem(CHASES_SENT_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    return typeof parsed === "number" ? parsed > 0
         : Array.isArray(parsed) ? parsed.length > 0
         : false;
  } catch {
    return false;
  }
}

export function SetupChecklist() {
  const [done, setDone] = useState<Set<StepId>>(new Set());
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = readDone();
    // Auto-detect completion from observable state, then merge with explicit toggles.
    if (hasInvoices()) stored.add("import");
    if (hasInvoices()) stored.add("review"); // having invoices implies they could review
    if (hasSentChase()) stored.add("message");
    setDone(stored);
    setMounted(true);
  }, []);

  function toggle(id: StepId) {
    setDone((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      writeDone(next);
      return next;
    });
  }

  if (!mounted) return null;

  const allDone = STEPS.every((s) => done.has(s.id));
  if (allDone) return null;

  return (
    <div
      className="zn-card p-5 flex flex-col gap-4"
      style={{ border: "1px solid var(--zn-line-soft)" }}
    >
      <div>
        <div className="zn-label !p-0 mb-1">Getting started</div>
        <p className="text-[13px]" style={{ color: "var(--zn-ink-3)" }}>
          Complete these steps to get your first chase plan ready. Items tick
          off automatically as you go — click to mark manually.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {STEPS.map((step, i) => {
          const isDone = done.has(step.id);
          return (
            <div
              key={step.id}
              className="flex items-start gap-3 rounded-[10px] p-3 transition-colors"
              style={{
                background: isDone ? "var(--zn-safe-soft, #f0faf4)" : "var(--zn-surface-2)",
                border: "1px solid var(--zn-line-soft)",
                opacity: isDone ? 0.6 : 1,
              }}
            >
              <button
                type="button"
                onClick={() => toggle(step.id)}
                className="mt-0.5 shrink-0 cursor-pointer rounded-full focus:outline-none focus:ring-2 focus:ring-offset-1"
                style={{ color: "var(--zn-ink-3)" }}
                aria-label={isDone ? `Mark step ${i + 1} incomplete` : `Mark step ${i + 1} complete`}
                aria-pressed={isDone}
              >
                {isDone ? (
                  <CheckCircle2 className="size-4" style={{ color: "var(--zn-safe)" }} />
                ) : (
                  <Circle className="size-4" style={{ color: "var(--zn-ink-3)" }} />
                )}
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className="text-[13.5px] font-medium"
                    style={{
                      color: "var(--zn-ink)",
                      textDecoration: isDone ? "line-through" : "none",
                    }}
                  >
                    {step.label}
                  </span>
                  {!isDone && (
                    <Link
                      href={step.href}
                      className="text-[12px] font-medium shrink-0 underline underline-offset-2"
                      style={{ color: "var(--zn-accent)" }}
                    >
                      {step.cta} →
                    </Link>
                  )}
                </div>
                <p className="text-[12.5px] mt-0.5" style={{ color: "var(--zn-ink-3)" }}>
                  {step.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
