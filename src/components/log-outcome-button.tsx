"use client";

/**
 * src/components/log-outcome-button.tsx
 *
 * A self-contained "Log outcome" button for each chase-plan item.
 *
 * The user picks what happened after chasing an invoice (sent an email,
 * got a promise, payment received, etc.).  The outcome is saved to
 * zentra_chase_outcomes via the logChaseOutcome server action.
 *
 * Deliberately lightweight — no Sheet, no Dialog, just an inline
 * popover panel positioned below the trigger button so it doesn't
 * interrupt the rest of the chase list.
 */

import { useEffect, useRef, useState, useTransition } from "react";
import { CheckCircle2, ChevronDown, X } from "lucide-react";
import { logChaseOutcome, type ChaseOutcome } from "@/actions/chase-outcomes";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LogOutcomeButtonProps {
  invoiceRef:         string;
  clientName:         string;
  amountOutstanding?: number;
}

// ── Outcome option config ─────────────────────────────────────────────────────

const OUTCOME_OPTIONS: Array<{
  value: ChaseOutcome;
  label: string;
  emoji: string;
  color: string;
}> = [
  { value: "sent",     label: "Sent chase",    emoji: "✉",  color: "var(--zn-ink-2)" },
  { value: "promised", label: "Got promise",   emoji: "📅", color: "var(--zn-warn)"  },
  { value: "paid",     label: "Paid",          emoji: "✓",  color: "var(--zn-safe)"  },
  { value: "dispute",  label: "Disputed",      emoji: "⚠",  color: "var(--zn-risk)"  },
  { value: "snoozed",  label: "Snoozed",       emoji: "⏸",  color: "var(--zn-ink-3)" },
];

// ── Component ─────────────────────────────────────────────────────────────────

export function LogOutcomeButton({
  invoiceRef,
  clientName,
  amountOutstanding,
}: LogOutcomeButtonProps) {
  const [open, setOpen]                 = useState(false);
  const [selected, setSelected]         = useState<ChaseOutcome | null>(null);
  const [promisedDate, setPromisedDate] = useState("");
  const [notes, setNotes]               = useState("");
  const [saved, setSaved]               = useState(false);
  const [saveError, setSaveError]       = useState("");
  const [isPending, startTransition]    = useTransition();
  const panelRef                        = useRef<HTMLDivElement>(null);
  const triggerRef                      = useRef<HTMLButtonElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        !triggerRef.current?.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Reset inner state when panel is closed
  function closePanel() {
    setOpen(false);
    // Keep saved state visible on the trigger for a moment, then reset
    if (!saved) {
      setSelected(null);
      setPromisedDate("");
      setNotes("");
      setSaveError("");
    }
  }

  function handleSave() {
    if (!selected) return;
    setSaveError("");
    startTransition(async () => {
      const res = await logChaseOutcome({
        invoiceRef,
        clientName,
        amountOutstanding,
        outcome:      selected,
        promisedDate: selected === "promised" && promisedDate ? promisedDate : undefined,
        notes:        notes || undefined,
      });
      if (res.ok) {
        setSaved(true);
        setOpen(false);
        // Reset after 3 s so the button can be used again
        setTimeout(() => {
          setSaved(false);
          setSelected(null);
          setPromisedDate("");
          setNotes("");
        }, 3000);
      } else {
        setSaveError(res.error ?? "Failed to save. Try again.");
      }
    });
  }

  const cfg = selected ? OUTCOME_OPTIONS.find((o) => o.value === selected) : null;

  return (
    <div className="relative flex-shrink-0">
      {/* ── Trigger button ── */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          if (saved) return;
          setOpen((v) => !v);
        }}
        className="inline-flex items-center gap-1 rounded-full border text-[11.5px] font-medium transition-colors"
        style={{
          height:      26,
          padding:     "0 10px",
          borderColor: saved ? "var(--zn-safe)" : "var(--zn-line)",
          color:       saved ? "var(--zn-safe)" : "var(--zn-ink-3)",
          background:  saved ? "var(--zn-safe-soft)" : "transparent",
          cursor:      saved ? "default" : "pointer",
        }}
        aria-label={saved ? "Outcome logged" : "Log outcome"}
        aria-expanded={open}
      >
        {saved ? (
          <>
            <CheckCircle2 className="size-3" />
            Logged
          </>
        ) : (
          <>
            Log
            <ChevronDown className="size-3" aria-hidden />
          </>
        )}
      </button>

      {/* ── Inline panel ── */}
      {open && (
        <div
          ref={panelRef}
          className="absolute right-0 top-full mt-1.5 z-50 rounded-[12px] shadow-lg"
          style={{
            width:       260,
            background:  "var(--zn-surface)",
            border:      "1px solid var(--zn-line)",
          }}
          role="dialog"
          aria-label="Log chase outcome"
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3 border-b"
            style={{ borderColor: "var(--zn-line-soft)" }}
          >
            <p className="text-[13px] font-semibold" style={{ color: "var(--zn-ink)" }}>
              What happened?
            </p>
            <button
              type="button"
              onClick={closePanel}
              className="rounded p-0.5 transition-colors hover:bg-[#f3ecd8] dark:hover:bg-[#2d2820]"
              aria-label="Close"
            >
              <X className="size-3.5" style={{ color: "var(--zn-ink-3)" }} />
            </button>
          </div>

          {/* Outcome chips */}
          <div className="grid grid-cols-1 gap-1 p-3">
            {OUTCOME_OPTIONS.map((opt) => {
              const active = selected === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setSelected(opt.value)}
                  className="flex items-center gap-2.5 w-full rounded-[8px] px-3 py-2 text-left transition-colors"
                  style={{
                    background:  active ? "var(--zn-bg-2)" : "transparent",
                    border:      `1px solid ${active ? "var(--zn-line)" : "transparent"}`,
                  }}
                >
                  <span
                    className="text-[15px] leading-none w-5 text-center flex-shrink-0"
                    aria-hidden
                  >
                    {opt.emoji}
                  </span>
                  <span
                    className="text-[12.5px] font-medium"
                    style={{ color: active ? opt.color : "var(--zn-ink-2)" }}
                  >
                    {opt.label}
                  </span>
                  {active && (
                    <CheckCircle2
                      className="size-3.5 ml-auto flex-shrink-0"
                      style={{ color: opt.color }}
                      aria-hidden
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* Promise date — only shown when "promised" is selected */}
          {selected === "promised" && (
            <div
              className="px-3 pb-1 border-t pt-3"
              style={{ borderColor: "var(--zn-line-soft)" }}
            >
              <label
                htmlFor="log-promised-date"
                className="block text-[11px] font-medium mb-1"
                style={{ color: "var(--zn-ink-3)" }}
              >
                Promise date
              </label>
              <input
                id="log-promised-date"
                type="date"
                value={promisedDate}
                onChange={(e) => setPromisedDate(e.target.value)}
                className="w-full rounded-[8px] border px-3 py-1.5 text-[12.5px]"
                style={{
                  borderColor: "var(--zn-line)",
                  background:  "var(--zn-bg-2)",
                  color:       "var(--zn-ink)",
                }}
              />
            </div>
          )}

          {/* Optional note */}
          <div className="px-3 pb-3 pt-2">
            <label
              htmlFor="log-outcome-note"
              className="block text-[11px] font-medium mb-1"
              style={{ color: "var(--zn-ink-3)" }}
            >
              Note (optional)
            </label>
            <textarea
              id="log-outcome-note"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. called and left voicemail"
              className="w-full resize-none rounded-[8px] border px-3 py-1.5 text-[12.5px] placeholder:opacity-50"
              style={{
                borderColor: "var(--zn-line)",
                background:  "var(--zn-bg-2)",
                color:       "var(--zn-ink)",
              }}
            />
          </div>

          {/* Error */}
          {saveError && (
            <p className="px-4 pb-2 text-[11.5px]" style={{ color: "var(--zn-risk)" }}>
              {saveError}
            </p>
          )}

          {/* Save button */}
          <div
            className="px-3 pb-3 border-t pt-3"
            style={{ borderColor: "var(--zn-line-soft)" }}
          >
            <button
              type="button"
              onClick={handleSave}
              disabled={!selected || isPending}
              className="w-full rounded-full py-1.5 text-[12.5px] font-semibold transition-opacity disabled:opacity-40"
              style={{
                background: "var(--zn-accent)",
                color:      "var(--zn-accent-ink)",
              }}
            >
              {isPending ? "Saving…" : "Save outcome"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
