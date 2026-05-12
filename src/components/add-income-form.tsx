"use client";

/**
 * add-income-form.tsx
 *
 * Slide-in Sheet for logging a manual income entry.
 * Calls addManualIncome() from financial-settings.ts on save.
 *
 * Usage:
 *   const [open, setOpen] = useState(false);
 *   <AddIncomeForm open={open} onOpenChange={setOpen} />
 */

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { addManualIncome } from "@/actions/financial-settings";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

// ── Date helper ───────────────────────────────────────────────────────────────

/** Today as YYYY-MM-DD in the user's local timezone. */
function todayLocal(): string {
  const d   = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// ── Field wrapper ─────────────────────────────────────────────────────────────

/**
 * Wraps a label, input slot, and optional inline error message into a
 * consistent vertical stack.  The `optional` flag adds a muted hint.
 */
function Field({
  label,
  htmlFor,
  error,
  optional = false,
  children,
}: {
  label:     string;
  htmlFor:   string;
  error?:    string;
  optional?: boolean;
  children:  React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <Label
          htmlFor={htmlFor}
          style={{ color: "var(--zn-ink-2)", fontSize: "12.5px" }}
        >
          {label}
        </Label>
        {optional && (
          <span className="text-[11px]" style={{ color: "var(--zn-muted)" }}>
            optional
          </span>
        )}
      </div>

      {children}

      {error && (
        <p
          className="text-[11.5px]"
          style={{ color: "var(--zn-risk)" }}
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export interface AddIncomeFormProps {
  /** Controlled open state — the parent drives when the sheet is visible. */
  open:         boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddIncomeForm({ open, onOpenChange }: AddIncomeFormProps) {
  // ── Field state ──────────────────────────────────────────────────────────

  const [amount,      setAmount]      = useState("");
  const [description, setDescription] = useState("");
  const [date,        setDate]        = useState(todayLocal);
  const [source,      setSource]      = useState("");

  // ── UI state ─────────────────────────────────────────────────────────────

  const [errors,    setErrors]    = useState<Record<string, string>>({});
  const [saved,     setSaved]     = useState(false);
  const [isPending, startTransition] = useTransition();

  // ── Helpers ───────────────────────────────────────────────────────────────

  /** Remove a single field error when the user starts correcting it. */
  function clearError(key: string) {
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  /** Reset every field back to its initial value. */
  function reset() {
    setAmount("");
    setDescription("");
    setDate(todayLocal());
    setSource("");
    setErrors({});
    setSaved(false);
  }

  /** Forward the open-change to the parent; reset form when closing. */
  function handleOpenChange(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  // ── Validation ────────────────────────────────────────────────────────────

  function validate(): Record<string, string> {
    const errs: Record<string, string> = {};

    const parsed = parseFloat(amount.replace(/[^0-9.]/g, ""));
    if (!amount.trim() || isNaN(parsed) || parsed <= 0) {
      errs.amount = "Enter an amount greater than £0";
    }
    if (!description.trim()) {
      errs.description = "Add a short description";
    }
    if (!date) {
      errs.date = "Pick a date";
    }

    return errs;
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  function handleSave() {
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    const parsedAmount = parseFloat(amount.replace(/[^0-9.]/g, ""));

    startTransition(async () => {
      try {
        await addManualIncome({
          amount:       parsedAmount,
          description:  description.trim(),
          receivedDate: date,
          source:       source.trim() || undefined,
        });

        setSaved(true);
        // Brief "Saved ✓" flash, then close.
        setTimeout(() => handleOpenChange(false), 1_200);
      } catch {
        setErrors({ _form: "Couldn't save — please try again" });
      }
    });
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="right"
        className="gap-0 overflow-hidden [background:var(--zn-surface)] [border-left-color:var(--zn-line)]"
      >
        {/* ── Header ──────────────────────────────────────────────── */}
        <SheetHeader className="border-b px-6 pb-5 pt-6 [border-bottom-color:var(--zn-line-soft)]">
          <SheetTitle
            style={{ color: "var(--zn-ink)", fontSize: "15px", fontWeight: 600 }}
          >
            Record income
          </SheetTitle>
          <SheetDescription
            style={{ color: "var(--zn-ink-3)", fontSize: "12.5px", lineHeight: "1.5" }}
          >
            Log money you've received or are expecting soon.
          </SheetDescription>
        </SheetHeader>

        {/* ── Form body ────────────────────────────────────────────── */}
        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-6">

          {/* Amount */}
          <Field label="Amount" htmlFor="income-amount" error={errors.amount}>
            <div className="relative">
              <span
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 select-none text-[13px]"
                style={{ color: "var(--zn-ink-3)" }}
                aria-hidden
              >
                £
              </span>
              <Input
                id="income-amount"
                type="text"
                inputMode="decimal"
                placeholder="0"
                value={amount}
                onChange={(e) => { setAmount(e.target.value); clearError("amount"); }}
                aria-invalid={!!errors.amount || undefined}
                className="pl-7"
              />
            </div>
          </Field>

          {/* Description */}
          <Field
            label="What was it for?"
            htmlFor="income-description"
            error={errors.description}
          >
            <Input
              id="income-description"
              type="text"
              placeholder="Freelance project — Nexus Digital"
              value={description}
              onChange={(e) => { setDescription(e.target.value); clearError("description"); }}
              aria-invalid={!!errors.description || undefined}
            />
          </Field>

          {/* Date received */}
          <Field label="Date received" htmlFor="income-date" error={errors.date}>
            <Input
              id="income-date"
              type="date"
              value={date}
              onChange={(e) => { setDate(e.target.value); clearError("date"); }}
              aria-invalid={!!errors.date || undefined}
            />
          </Field>

          {/* Source — optional */}
          <Field label="Who paid you?" htmlFor="income-source" optional>
            <Input
              id="income-source"
              type="text"
              placeholder="Client or company name"
              value={source}
              onChange={(e) => setSource(e.target.value)}
            />
          </Field>

          {/* Form-level error */}
          {errors._form && (
            <p
              className="text-[12px]"
              style={{ color: "var(--zn-risk)" }}
              role="alert"
            >
              {errors._form}
            </p>
          )}
        </div>

        {/* ── Footer ───────────────────────────────────────────────── */}
        <SheetFooter className="flex-row items-center justify-end gap-2 border-t px-6 py-4 [border-top-color:var(--zn-line-soft)]">
          {saved ? (
            /* Success flash shown briefly before the sheet closes */
            <span
              className="flex items-center gap-1.5 text-[13px] font-medium"
              style={{ color: "var(--zn-safe)" }}
              role="status"
            >
              <Check className="size-4" strokeWidth={2.5} />
              Saved
            </span>
          ) : (
            <>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleOpenChange(false)}
                disabled={isPending}
                style={{ color: "var(--zn-ink-3)" }}
              >
                Cancel
              </Button>

              <button
                type="button"
                onClick={handleSave}
                disabled={isPending}
                className="zn-pill rounded-[8px] px-4 py-2 text-[13px] font-medium disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isPending ? "Saving…" : "Save income"}
              </button>
            </>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
