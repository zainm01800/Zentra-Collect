"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { Invoice, InvoiceStatus } from "@/types/cashpilot";

export type ReviewOutcome =
  | "sent"
  | "promised"
  | "paid"
  | "dispute"
  | "snooze";

type OnOutcomeFn = (invoiceId: string, outcome: ReviewOutcome) => void;

type ReviewState = {
  current: Invoice | null;
  open: (invoice: Invoice) => void;
  close: () => void;
  isOpen: boolean;
  registerOnOutcome: (fn: OnOutcomeFn) => void;
  recordOutcome: (outcome: ReviewOutcome) => void;
  /** How many outcomes have been recorded in this session (resets on reload). */
  outcomesLogged: number;
};

/**
 * Map a review outcome to the invoice status it should set.
 * "sent" doesn't change status; "snooze" doesn't change status.
 */
export function statusForOutcome(outcome: ReviewOutcome): InvoiceStatus | null {
  switch (outcome) {
    case "paid":     return "Paid";
    case "promised": return "Promised payment";
    case "dispute":  return "Disputed";
    case "sent":     return "Reminder sent";
    default:         return null;
  }
}

const Ctx = createContext<ReviewState | null>(null);

export function ReviewProvider({ children }: { children: React.ReactNode }) {
  const [current, setCurrent] = useState<Invoice | null>(null);
  const [onOutcome, setOnOutcome] = useState<OnOutcomeFn | null>(null);
  const [outcomesLogged, setOutcomesLogged] = useState(0);

  const open = useCallback((invoice: Invoice) => {
    setCurrent(invoice);
  }, []);
  const close = useCallback(() => {
    setCurrent(null);
  }, []);
  const registerOnOutcome = useCallback((fn: OnOutcomeFn) => {
    setOnOutcome(() => fn);
  }, []);
  const recordOutcome = useCallback(
    (outcome: ReviewOutcome) => {
      if (current && onOutcome) {
        onOutcome(current.id, outcome);
        setOutcomesLogged((n) => n + 1);
        // Persist to the chase-streak tracker so the streak badge updates.
        // Dynamic import keeps this a client-only side effect.
        if (typeof window !== "undefined") {
          import("@/lib/chase-streak").then(({ recordOutcome: trackOutcome }) => {
            trackOutcome();
          }).catch(() => { /* non-critical */ });
        }
      }
    },
    [current, onOutcome],
  );

  const value = useMemo<ReviewState>(
    () => ({
      current,
      open,
      close,
      isOpen: current !== null,
      registerOnOutcome,
      recordOutcome,
      outcomesLogged,
    }),
    [current, open, close, registerOnOutcome, recordOutcome, outcomesLogged],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useReview() {
  const ctx = useContext(Ctx);
  if (!ctx) {
    // Safe no-op during SSR or if used outside provider
    return {
      current: null,
      open: () => {},
      close: () => {},
      isOpen: false,
      registerOnOutcome: () => {},
      recordOutcome: () => {},
      outcomesLogged: 0,
    } as ReviewState;
  }
  return ctx;
}
