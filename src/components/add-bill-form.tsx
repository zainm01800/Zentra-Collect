"use client";

/**
 * add-bill-form.tsx
 *
 * Slide-in Sheet for recording a manual bill or upcoming expense.
 * Calls addManualBill() from financial-settings.ts on save.
 *
 * Usage:
 *   const [open, setOpen] = useState(false);
 *   <AddBillForm open={open} onOpenChange={setOpen} />
 */

import { useState, useTransition } from "react";
import { addManualBill } from "@/actions/financial-settings";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input }  from "@/components/ui/input";
import { Label }  from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ── Types ─────────────────────────────────────────────────────────────────────

type RecurrenceInterval = "monthly" | "weekly" | "yearly";

// ── Field wrapper ─────────────────────────────────────────────────────────────

/**
 * Consistent label + input + error layout reused for every form field.
 */
function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label:    string;
  htmlFor?: string;
  error?:   string;
  hint?:    string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {htmlFor ? (
        <Label
          htmlFor={htmlFor}
          style={{ color: "var(--zn-ink-2)", fontSize: "12.5px" }}
        >
          {label}
        </Label>
      ) : (
        <span
          className="text-[12.5px] font-medium leading-none select-none"
          style={{ color: "var(--zn-ink-2)" }}
        >
          {label}
        </span>
      )}

      {children}

      {hint && !error && (
        <p className="text-[11px]" style={{ color: "var(--zn-muted)" }}>
          {hint}
        </p>
      )}
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

export interface AddBillFormProps {
  /** Controlled open state — the parent drives when the sheet is visible. */
  open:         boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddBillForm({ open, onOpenChange }: AddBillFormProps) {
  // ── Field state ──────────────────────────────────────────────────────────

  const [description,          setDescription]         = useState("");
  const [amount,               setAmount]              = useState("");
  const [dueDate,              setDueDate]             = useState("");
  const [isRecurring,          setIsRecurring]         = useState(false);
  const [recurrenceInterval,   setRecurrenceInterval]  = useState<RecurrenceInterval>("monthly");

  // ── UI state ─────────────────────────────────────────────────────────────

  const [errors,    setErrors]    = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();

  // ── Helpers ───────────────────────────────────────────────────────────────

  function clearError(key: string) {
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function reset() {
    setDescription("");
    setAmount("");
    setDueDate("");
    setIsRecurring(false);
    setRecurrenceInterval("monthly");
    setErrors({});
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  // ── Validation ────────────────────────────────────────────────────────────

  function validate(): Record<string, string> {
    const errs: Record<string, string> = {};

    if (!description.trim()) {
      errs.description = "Add a short description";
    }
    const parsed = parseFloat(amount.replace(/[^0-9.]/g, ""));
    if (!amount.trim() || isNaN(parsed) || parsed <= 0) {
      errs.amount = "Enter an amount greater than £0";
    }
    if (!dueDate) {
      errs.dueDate = "Pick a due date";
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
        await addManualBill({
          description: description.trim(),
          amount:      parsedAmount,
          dueDate,
          isRecurring,
          // recurrenceInterval is stored locally for future schema support;
          // pass it once addManualBill() accepts that column.
        });

        handleOpenChange(false);
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
            Add a bill
          </SheetTitle>
          <SheetDescription
            style={{ color: "var(--zn-ink-3)", fontSize: "12.5px", lineHeight: "1.5" }}
          >
            Track an upcoming payment so it shows up in your cash flow.
          </SheetDescription>
        </SheetHeader>

        {/* ── Form body ────────────────────────────────────────────── */}
        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-6">

          {/* Description */}
          <Field
            label="What's the bill for?"
            htmlFor="bill-description"
            error={errors.description}
          >
            <Input
              id="bill-description"
              type="text"
              placeholder="Adobe Creative Cloud"
              value={description}
              onChange={(e) => { setDescription(e.target.value); clearError("description"); }}
              aria-invalid={!!errors.description || undefined}
            />
          </Field>

          {/* Amount */}
          <Field label="Amount" htmlFor="bill-amount" error={errors.amount}>
            <div className="relative">
              <span
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 select-none text-[13px]"
                style={{ color: "var(--zn-ink-3)" }}
                aria-hidden
              >
                £
              </span>
              <Input
                id="bill-amount"
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

          {/* Due date */}
          <Field label="Due date" htmlFor="bill-due-date" error={errors.dueDate}>
            <Input
              id="bill-due-date"
              type="date"
              value={dueDate}
              onChange={(e) => { setDueDate(e.target.value); clearError("dueDate"); }}
              aria-invalid={!!errors.dueDate || undefined}
            />
          </Field>

          {/* Divider */}
          <div
            className="h-px w-full"
            style={{ background: "var(--zn-line-soft)" }}
          />

          {/* Recurring toggle */}
          <Field label="Does this repeat?">
            <div className="flex items-center justify-between gap-4">
              <p
                className="text-[12.5px] leading-[1.5]"
                style={{ color: "var(--zn-ink-3)" }}
              >
                {isRecurring
                  ? "Yes — this is a recurring payment"
                  : "No — one-time payment"}
              </p>
              <Switch
                id="bill-recurring"
                checked={isRecurring}
                onCheckedChange={setIsRecurring}
                aria-label="Mark as recurring"
              />
            </div>
          </Field>

          {/* Interval select — only visible when recurring is on */}
          {isRecurring && (
            <Field
              label="How often?"
              hint="We'll use this to flag future due dates."
            >
              <Select
                value={recurrenceInterval}
                onValueChange={(v) => setRecurrenceInterval(v as RecurrenceInterval)}
              >
                <SelectTrigger
                  id="bill-interval"
                  className="w-full"
                  aria-label="Recurrence interval"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          )}

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
            {isPending ? "Saving…" : "Add bill"}
          </button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
