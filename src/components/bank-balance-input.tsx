"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState, useTransition } from "react";
import { Check, Pencil, X } from "lucide-react";
import { updateBankBalance } from "@/actions/financial-settings";

// ── Formatters ────────────────────────────────────────────────────────────────

function formatGBP(amount: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Turn an ISO timestamp into a compact relative string.
 * Falls back to a short date for anything older than a week.
 */
function formatRelative(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins   = Math.floor(diffMs / 60_000);
  const hours  = Math.floor(diffMs / 3_600_000);
  const days   = Math.floor(diffMs / 86_400_000);

  if (mins  <  1) return "just now";
  if (mins  < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days  <  7) return `${days}d ago`;

  return new Intl.DateTimeFormat("en-GB", {
    day:   "numeric",
    month: "short",
  }).format(new Date(iso));
}

/**
 * Parse a free-form currency input ("11,240", "£11240", "11240.50")
 * into a number, returning null if it cannot be parsed.
 */
function parseInputValue(raw: string): number | null {
  const cleaned = raw.replace(/[^0-9.-]/g, "");
  const parsed  = parseFloat(cleaned);
  return isNaN(parsed) ? null : parsed;
}

// ── Component ─────────────────────────────────────────────────────────────────

export interface BankBalanceInputHandle {
  /**
   * Programmatically enter edit mode — used by the "Update balance"
   * quick-action button in the financial header.
   */
  enterEdit: () => void;
}

export interface BankBalanceInputProps {
  initialBalance: number | null;
  lastUpdated: string | null;
}

export const BankBalanceInput = forwardRef<BankBalanceInputHandle, BankBalanceInputProps>(
function BankBalanceInput({
  initialBalance,
  lastUpdated: lastUpdatedProp,
}: BankBalanceInputProps, ref) {
  const [balance,     setBalance]     = useState<number | null>(initialBalance);
  const [lastUpdated, setLastUpdated] = useState<string | null>(lastUpdatedProp);
  const [isEditing,   setIsEditing]   = useState(false);
  const [inputValue,  setInputValue]  = useState("");
  const [savedOk,     setSavedOk]     = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [isPending,   startTransition] = useTransition();

  const inputRef  = useRef<HTMLInputElement>(null);
  const hasBalance = balance !== null;

  // Focus + select all when entering edit mode so the user can type immediately.
  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  // Expose enterEdit() so parent components can trigger edit mode imperatively
  // (e.g. the "Update balance" quick-action button in FinancialHeader).
  useImperativeHandle(ref, () => ({ enterEdit }), [balance, isEditing]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Handlers ──────────────────────────────────────────────────────────────

  function enterEdit() {
    setInputValue(balance !== null ? String(balance) : "");
    setError(null);
    setSavedOk(false);
    setIsEditing(true);
  }

  function cancelEdit() {
    setIsEditing(false);
    setError(null);
  }

  function handleSave() {
    const parsed = parseInputValue(inputValue);
    if (parsed === null) {
      setError("Enter a valid amount — e.g. 11240");
      return;
    }
    setError(null);

    startTransition(async () => {
      try {
        await updateBankBalance(parsed);
        setBalance(parsed);
        setLastUpdated(new Date().toISOString());
        setIsEditing(false);
        setSavedOk(true);
        // Clear the success flash after 2.5 s.
        setTimeout(() => setSavedOk(false), 2_500);
      } catch {
        setError("Couldn't save — try again");
      }
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter")  { e.preventDefault(); handleSave(); }
    if (e.key === "Escape") { e.preventDefault(); cancelEdit(); }
  }

  // ── Shared input row (reused by empty + edit states) ──────────────────────

  const inputRow = (
    <div className="flex items-center gap-2">
      {/* £-prefixed text field */}
      <div className="relative min-w-0 flex-1">
        <span
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 select-none text-[13px]"
          style={{ color: "var(--zn-ink-3)" }}
          aria-hidden
        >
          £
        </span>
        <input
          ref={inputRef}
          id="bank-balance-input"
          type="text"
          inputMode="decimal"
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="0"
          disabled={isPending}
          aria-label="Bank balance amount in pounds"
          aria-invalid={error !== null}
          aria-describedby={error ? "bank-balance-error" : undefined}
          className="w-full rounded-[8px] border py-2 pl-7 pr-3 text-[14px] font-medium outline-none transition-colors focus:outline-none"
          style={{
            background:  "var(--zn-surface-2)",
            borderColor: error ? "var(--zn-risk)" : "var(--zn-line)",
            color:       "var(--zn-ink)",
          }}
        />
      </div>

      {/* Save / confirm button */}
      <button
        type="button"
        onClick={handleSave}
        disabled={isPending}
        aria-label={hasBalance ? "Save balance" : "Add balance"}
        className="flex shrink-0 items-center justify-center rounded-[8px] transition-opacity disabled:opacity-50"
        style={{
          width:      34,
          height:     34,
          background: "var(--zn-ink)",
          color:      "var(--zn-surface)",
        }}
      >
        {isPending ? (
          /* Minimal spinner — no extra dep, matches the overall minimal tone */
          <span
            className="block size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
            aria-hidden
          />
        ) : (
          <Check className="size-3.5" strokeWidth={2.5} />
        )}
      </button>

      {/* Cancel button — only shown when editing an existing balance */}
      {hasBalance && (
        <button
          type="button"
          onClick={cancelEdit}
          disabled={isPending}
          aria-label="Cancel"
          className="flex shrink-0 items-center justify-center rounded-[8px] transition-opacity disabled:opacity-40"
          style={{
            width:      34,
            height:     34,
            background: "var(--zn-surface-2)",
            border:     "1px solid var(--zn-line)",
            color:      "var(--zn-ink-3)",
          }}
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="zn-card space-y-3 px-4 py-3.5">

      {/* ── Header row ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3">
        <span className="zn-label">Bank balance</span>

        {/* Edit button — only visible when a balance exists and we're not editing */}
        {hasBalance && !isEditing && (
          <button
            type="button"
            onClick={enterEdit}
            aria-label="Edit bank balance"
            className="flex items-center gap-1.5 rounded-[6px] px-2 py-1 text-[11.5px] font-medium transition-colors hover:bg-[#f3ecd8]"
            style={{ color: "var(--zn-ink-3)" }}
          >
            <Pencil className="size-3" strokeWidth={2} />
            Edit
          </button>
        )}
      </div>

      {/* ── State A: no balance set yet (first-time prompt) ─────────── */}
      {!hasBalance && (
        <div className="space-y-2.5">
          <p
            className="text-[12.5px] leading-[1.6]"
            style={{ color: "var(--zn-ink-3)" }}
          >
            Add your bank balance to unlock{" "}
            <span className="font-medium" style={{ color: "var(--zn-ink-2)" }}>
              Safe to Spend
            </span>
            .
          </p>
          {inputRow}
          {error && (
            <p
              id="bank-balance-error"
              className="text-[11.5px]"
              style={{ color: "var(--zn-risk)" }}
              role="alert"
            >
              {error}
            </p>
          )}
        </div>
      )}

      {/* ── State B: balance set, display mode ──────────────────────── */}
      {hasBalance && !isEditing && (
        <div>
          {/* Large balance figure — flashes green on successful save */}
          <p
            className="text-[30px] font-semibold leading-none tracking-tight"
            style={{
              color:              savedOk ? "var(--zn-safe)" : "var(--zn-ink)",
              transition:         "color 400ms ease",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {formatGBP(balance!)}
          </p>

          {/* Timestamp + "Saved" flash */}
          <div
            className="mt-1.5 flex min-h-[18px] items-center gap-2"
            aria-live="polite"
            aria-atomic="true"
          >
            {lastUpdated && !savedOk && (
              <span
                className="text-[11.5px]"
                style={{ color: "var(--zn-ink-3)" }}
              >
                Updated {formatRelative(lastUpdated)}
              </span>
            )}
            {savedOk && (
              <span
                className="flex items-center gap-1 text-[11px] font-medium"
                style={{ color: "var(--zn-safe)" }}
              >
                <Check className="size-3" strokeWidth={2.5} />
                Saved
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── State C: balance set, inline edit mode ───────────────────── */}
      {hasBalance && isEditing && (
        <div className="space-y-2">
          {inputRow}
          {error && (
            <p
              id="bank-balance-error"
              className="text-[11.5px]"
              style={{ color: "var(--zn-risk)" }}
              role="alert"
            >
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
});

BankBalanceInput.displayName = "BankBalanceInput";
