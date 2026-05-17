"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CheckCircle2, Circle } from "lucide-react";

const STORAGE_KEY = "zentra.setup.steps.v1";

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

export function SetupChecklist() {
  const [done, setDone] = useState<Set<StepId>>(new Set());
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setDone(readDone());
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
          Complete these steps to get your first chase plan ready.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {STEPS.map((step, i) => {
          const isDone = done.has(step.id);
          return (
            <div
              key={step.id}
              className="flex items-start gap-3 rounded-[10px] p-3"
              style={{
                background: isDone ? "var(--zn-safe-soft, #f0faf4)" : "var(--zn-surface-2)",
                border: "1px solid var(--zn-line-soft)",
                opacity: isDone ? 0.6 : 1,
              }}
            >
              <button
                type="button"
                onClick={() => toggle(step.id)}
                className="mt-0.5 shrink-0"
                aria-label={isDone ? `Mark step ${i + 1} incomplete` : `Mark step ${i + 1} complete`}
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
