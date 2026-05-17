"use client";

import { useMemo } from "react";
import { ChaseQueue } from "@/components/chase-queue";
import { readLocalAccount } from "@/lib/demo-auth";
import { demoCashpilotInvoices as demoInvoices } from "@/lib/demo-data/zentra-demo-data";
import { importedInvoicesStorageKey } from "@/lib/import/zentra-import";
import {
  readActiveClientId,
  clientInvoicesKey,
} from "@/lib/bookkeeper-clients";
import {
  INVOICE_CHANGE_EVENT,
  patchInvoice,
  outcomeToCollectionStatus,
} from "@/lib/invoice-store";
import type { Invoice } from "@/types/cashpilot";
import type { Invoice as ZentraInvoice } from "@/types/zentra";

const demoInvoiceStateStorageKey = "zentra.demoInvoiceState.v1";

const BOOKKEEPER_PLAN_IDS = ["bookkeeper_starter", "bookkeeper_pro"];

/** Returns the correct invoice storage key for the current user/workspace. */
function resolveInvoiceKey(planId: string): string {
  if (BOOKKEEPER_PLAN_IDS.includes(planId)) {
    const activeClientId = readActiveClientId();
    if (activeClientId && activeClientId !== "all") {
      return clientInvoicesKey(activeClientId);
    }
  }
  return importedInvoicesStorageKey;
}

function readInvoicesForQueue(): Invoice[] {
  if (typeof window === "undefined") return [];
  const localAccount = readLocalAccount();
  const isDemo = localAccount?.planId === "demo";

  if (isDemo) {
    const stored = window.localStorage.getItem(demoInvoiceStateStorageKey);
    if (!stored) return demoInvoices as Invoice[];
    try {
      const parsed = JSON.parse(stored) as Invoice[];
      return Array.isArray(parsed) && parsed.length ? parsed : (demoInvoices as Invoice[]);
    } catch {
      return demoInvoices as Invoice[];
    }
  }

  const storageKey = resolveInvoiceKey(localAccount?.planId ?? "");
  const stored = window.localStorage.getItem(storageKey);
  if (!stored) return [];
  try {
    const parsed = JSON.parse(stored) as Invoice[];
    return Array.isArray(parsed) && parsed.length ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Maps a cashpilot InvoiceStatus → zentra CollectionStatus so the
 * persisted imported invoices stay in sync with queue interactions.
 */
function cashpilotStatusToZentra(status: string | null): string {
  switch (status) {
    case "Paid":              return "paid";
    case "Promised payment":  return "promised_payment";
    case "Disputed":          return "disputed";
    case "Reminder sent":     return "reminded";
    case "Needs call":        return "needs_ap_contact";
    case "Overdue":           return "overdue";
    case "Due soon":          return "due_soon";
    case "Not due":           return "not_due";
    default:                  return status?.toLowerCase().replace(/\s+/g, "_") ?? "overdue";
  }
}

/**
 * Persist a status change triggered by the review drawer back to localStorage,
 * then dispatch INVOICE_CHANGE_EVENT so P&L, Tax, Aged Debt update instantly.
 *
 * Demo users → write cashpilot Invoice[] to demoInvoiceStateStorageKey.
 * Real users → patchInvoice() from the unified store (handles key resolution
 *              and event dispatch automatically).
 */
function persistStatusChange(invoiceId: string, nextStatus: string | null) {
  if (typeof window === "undefined") return;
  const localAccount = readLocalAccount();
  const isDemo = localAccount?.planId === "demo";

  if (isDemo) {
    // Demo: persist cashpilot status format, then notify other areas
    const key = demoInvoiceStateStorageKey;
    const stored = localStorage.getItem(key);
    const invoices = stored
      ? (JSON.parse(stored) as Invoice[])
      : (demoInvoices as Invoice[]);
    const updated = invoices.map((inv) =>
      inv.id === invoiceId && nextStatus
        ? { ...inv, status: nextStatus as Invoice["status"] }
        : inv,
    );
    try {
      localStorage.setItem(key, JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent(INVOICE_CHANGE_EVENT));
    } catch { /* quota */ }
  } else {
    // Real user: go through the store so the event fires automatically
    const zentraStatus = outcomeToCollectionStatus(
      cashpilotStatusToZentra(nextStatus),
    ) ?? (cashpilotStatusToZentra(nextStatus) as ZentraInvoice["status"]);
    patchInvoice(invoiceId, { status: zentraStatus as ZentraInvoice["status"] });
  }
}

export function ChaseQueueDataWrapper({ onlyToday = false }: { onlyToday?: boolean }) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const invoices = useMemo(() => readInvoicesForQueue(), []);
  return (
    <ChaseQueue
      initialInvoices={invoices}
      onlyToday={onlyToday}
      onInvoiceStatusChange={persistStatusChange}
    />
  );
}
