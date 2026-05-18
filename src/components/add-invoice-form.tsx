"use client";

/**
 * add-invoice-form.tsx
 *
 * Slide-in Sheet for logging a single invoice manually — separate from the
 * CSV import flow.  Calls getInvoiceSuggestions() on open to pre-fill the
 * invoice number and populate the client name autocomplete, then calls
 * addInvoice() from src/actions/invoices.ts on save.
 *
 * Usage:
 *   const [open, setOpen] = useState(false);
 *   <AddInvoiceForm open={open} onOpenChange={setOpen} />
 */

import { useEffect, useRef, useState, useTransition } from "react";
import { Check } from "lucide-react";
import { addInvoice, getInvoiceSuggestions } from "@/actions/invoices";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input }    from "@/components/ui/input";
import { Label }    from "@/components/ui/label";
import { Button }   from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

// ── Date helpers ──────────────────────────────────────────────────────────────

/** Today as YYYY-MM-DD in the user's local timezone. */
function todayLocal(): string {
  const d   = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Today + n days as YYYY-MM-DD in the user's local timezone. */
function daysFromNowLocal(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  const pad = (x: number) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// ── Field wrapper ─────────────────────────────────────────────────────────────

/**
 * Consistent label + content + error/hint stack reused for every form field.
 * Pass `optional` to append a muted "optional" hint next to the label.
 */
function Field({
  label,
  htmlFor,
  error,
  optional = false,
  children,
}: {
  label:     string;
  htmlFor?:  string;
  error?:    string;
  optional?: boolean;
  children:  React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
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

export interface AddInvoiceFormProps {
  /** Controlled open state — the parent drives when the sheet is visible. */
  open:         boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddInvoiceForm({ open, onOpenChange }: AddInvoiceFormProps) {
  // ── Field state ──────────────────────────────────────────────────────────

  const [clientName,    setClientName]    = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate,   setInvoiceDate]   = useState(todayLocal);
  const [dueDate,       setDueDate]       = useState(() => daysFromNowLocal(30));
  const [amount,        setAmount]        = useState("");
  // VAT rate as whole-number percent. 0 = "No VAT". Persists the user's
  // last choice in localStorage so VAT-registered users don't have to
  // re-select 20% every time.
  const [vatRate,       setVatRate]       = useState<number>(() => {
    if (typeof window === "undefined") return 0;
    const stored = window.localStorage.getItem("zentra.lastInvoiceVatRate");
    const parsed = stored ? parseInt(stored, 10) : 0;
    return Number.isFinite(parsed) ? parsed : 0;
  });
  const [notes,         setNotes]         = useState("");

  // ── Suggestion state ─────────────────────────────────────────────────────

  /**
   * Customer names fetched from the DB to power the datalist autocomplete.
   * Empty until the sheet has opened at least once and had connectivity.
   */
  const [customerNames, setCustomerNames] = useState<string[]>([]);

  /**
   * Tracks whether we have already pre-filled the invoice number during
   * the current open session — prevents the async suggestion from landing
   * after the user has already typed their own value.
   */
  const numberAutofilledRef = useRef(false);

  // ── UI state ─────────────────────────────────────────────────────────────

  const [errors,    setErrors]      = useState<Record<string, string>>({});
  const [saved,     setSaved]       = useState(false);
  const [isPending, startTransition] = useTransition();

  // ── Load suggestions when sheet opens ────────────────────────────────────

  useEffect(() => {
    if (!open) return;

    getInvoiceSuggestions()
      .then(({ customerNames: names, nextInvoiceNumber }) => {
        setCustomerNames(names);
        // Only pre-fill if the user hasn't already typed their own number.
        if (!numberAutofilledRef.current) {
          setInvoiceNumber(nextInvoiceNumber);
          numberAutofilledRef.current = true;
        }
      })
      .catch(() => {
        // Suggestions unavailable (no Supabase config, not authenticated, etc.).
        // The form still works — the autocomplete is just empty and the
        // invoice number field stays blank for the user to fill.
      });
  }, [open]);

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
    setClientName("");
    setInvoiceNumber("");
    setInvoiceDate(todayLocal());
    setDueDate(daysFromNowLocal(30));
    setAmount("");
    setNotes("");
    setCustomerNames([]);
    setErrors({});
    setSaved(false);
    numberAutofilledRef.current = false;
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  // ── Validation ────────────────────────────────────────────────────────────

  function validate(): Record<string, string> {
    const errs: Record<string, string> = {};

    if (!clientName.trim()) {
      errs.clientName = "Add the client name";
    }
    if (!invoiceNumber.trim()) {
      errs.invoiceNumber = "Add an invoice number";
    }
    if (!invoiceDate) {
      errs.invoiceDate = "Pick an invoice date";
    }
    if (!dueDate) {
      errs.dueDate = "Pick a due date";
    }
    if (invoiceDate && dueDate && dueDate < invoiceDate) {
      errs.dueDate = "Due date can't be before invoice date";
    }
    const parsed = parseFloat(amount.replace(/[^0-9.]/g, ""));
    if (!amount.trim() || isNaN(parsed) || parsed <= 0) {
      errs.amount = "Enter an amount greater than £0";
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

    // Persist VAT preference for next time
    try { window.localStorage.setItem("zentra.lastInvoiceVatRate", String(vatRate)); } catch {}

    startTransition(async () => {
      const result = await addInvoice({
        customerName:  clientName.trim(),
        invoiceNumber: invoiceNumber.trim(),
        invoiceDate,
        dueDate,
        amount:        parsedAmount,  // NET; server computes gross
        vatRate,
        notes:         notes.trim() || undefined,
      });

      if (result.success) {
        setSaved(true);
        // Brief "Saved ✓" flash, then close.
        setTimeout(() => handleOpenChange(false), 1_200);
      } else {
        const message =
          result.reason === "unauthenticated"
            ? "Please sign in and try again"
            : "Couldn't save — please try again";
        setErrors({ _form: message });
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
            Add invoice
          </SheetTitle>
          <SheetDescription
            style={{ color: "var(--zn-ink-3)", fontSize: "12.5px", lineHeight: "1.5" }}
          >
            Log a single invoice without uploading a file.
          </SheetDescription>
        </SheetHeader>

        {/* ── Form body ────────────────────────────────────────────── */}
        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-6">

          {/* Client name — native datalist autocomplete */}
          <Field
            label="Client name"
            htmlFor="invoice-client"
            error={errors.clientName}
          >
            {/*
              Using a native <datalist> keeps this dependency-free and
              fully accessible. The browser renders the suggestions natively.
            */}
            <Input
              id="invoice-client"
              type="text"
              list="invoice-client-suggestions"
              placeholder="Nexus Digital"
              value={clientName}
              onChange={(e) => {
                setClientName(e.target.value);
                clearError("clientName");
              }}
              aria-invalid={!!errors.clientName || undefined}
              autoComplete="off"
            />
            <datalist id="invoice-client-suggestions">
              {customerNames.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </Field>

          {/* Invoice number — pre-filled with next INV-NNN suggestion */}
          <Field
            label="Invoice number"
            htmlFor="invoice-number"
            error={errors.invoiceNumber}
          >
            <Input
              id="invoice-number"
              type="text"
              placeholder="INV-001"
              value={invoiceNumber}
              onChange={(e) => {
                setInvoiceNumber(e.target.value);
                // Mark as user-modified so the async suggestion won't overwrite.
                numberAutofilledRef.current = true;
                clearError("invoiceNumber");
              }}
              aria-invalid={!!errors.invoiceNumber || undefined}
            />
          </Field>

          {/* Dates — side by side to save vertical space */}
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Invoice date"
              htmlFor="invoice-date"
              error={errors.invoiceDate}
            >
              <Input
                id="invoice-date"
                type="date"
                value={invoiceDate}
                onChange={(e) => {
                  setInvoiceDate(e.target.value);
                  clearError("invoiceDate");
                }}
                aria-invalid={!!errors.invoiceDate || undefined}
              />
            </Field>

            <Field
              label="Due date"
              htmlFor="invoice-due-date"
              error={errors.dueDate}
            >
              <Input
                id="invoice-due-date"
                type="date"
                value={dueDate}
                onChange={(e) => {
                  setDueDate(e.target.value);
                  clearError("dueDate");
                }}
                aria-invalid={!!errors.dueDate || undefined}
              />
            </Field>
          </div>

          {/* Amount + VAT */}
          <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
            <Field label="Amount (net)" htmlFor="invoice-amount" error={errors.amount}>
              <div className="relative">
                <span
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 select-none text-[13px]"
                  style={{ color: "var(--zn-ink-3)" }}
                  aria-hidden
                >
                  £
                </span>
                <Input
                  id="invoice-amount"
                  type="text"
                  inputMode="decimal"
                  placeholder="0"
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value);
                    clearError("amount");
                  }}
                  aria-invalid={!!errors.amount || undefined}
                  className="pl-7"
                />
              </div>
            </Field>
            <Field label="VAT" htmlFor="invoice-vat">
              <select
                id="invoice-vat"
                value={String(vatRate)}
                onChange={(e) => setVatRate(parseInt(e.target.value, 10) || 0)}
                className="w-full rounded-[10px] border px-3 py-2 text-[13.5px]"
                style={{
                  background: "var(--zn-surface)",
                  borderColor: "var(--zn-line)",
                  color: "var(--zn-ink)",
                }}
              >
                <option value="0">No VAT</option>
                <option value="5">5% (reduced)</option>
                <option value="20">20% (standard)</option>
              </select>
            </Field>
          </div>

          {/* Live VAT breakdown — only shown when net amount is parseable */}
          {(() => {
            const net = parseFloat((amount || "0").replace(/[^0-9.]/g, ""));
            if (!Number.isFinite(net) || net <= 0) return null;
            const vat = Math.round(net * (vatRate / 100) * 100) / 100;
            const gross = Math.round((net + vat) * 100) / 100;
            const fmt = (n: number) =>
              new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n);
            return (
              <div
                className="rounded-[10px] px-3 py-2.5 text-[12px] grid grid-cols-3 gap-2"
                style={{ background: "var(--zn-surface-2)", border: "1px solid var(--zn-line-soft)" }}
              >
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--zn-ink-3)" }}>Net</p>
                  <p className="tabular-nums mt-0.5" style={{ color: "var(--zn-ink-2)" }}>{fmt(net)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--zn-ink-3)" }}>VAT @ {vatRate}%</p>
                  <p className="tabular-nums mt-0.5" style={{ color: "var(--zn-ink-2)" }}>{fmt(vat)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--zn-ink-3)" }}>Total to bill</p>
                  <p className="tabular-nums mt-0.5 font-semibold" style={{ color: "var(--zn-ink)" }}>{fmt(gross)}</p>
                </div>
              </div>
            );
          })()}

          {/* Notes — optional, auto-grows */}
          <Field
            label="Notes"
            htmlFor="invoice-notes"
            optional
          >
            <Textarea
              id="invoice-notes"
              placeholder="Payment terms, PO number, or anything else worth remembering…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
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
                {isPending ? "Saving…" : "Save invoice"}
              </button>
            </>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
