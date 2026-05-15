"use client";

import { useMemo } from "react";
import { ChaseQueue } from "@/components/chase-queue";
import { readLocalAccount } from "@/lib/demo-auth";
import { demoCashpilotInvoices as demoInvoices } from "@/lib/demo-data/zentra-demo-data";
import { importedInvoicesStorageKey } from "@/lib/import/zentra-import";
import type { Invoice } from "@/types/cashpilot";
import type { Invoice as ZentraInvoice } from "@/types/zentra";

const demoInvoiceStateStorageKey = "zentra.demoInvoiceState.v1";

function readInvoicesForQueue(): Invoice[] {
  if (typeof window === "undefined") return [];
  const localAccount = readLocalAccount();
  const isDemo = localAccount?.planId === "demo";
  const storageKey = isDemo ? demoInvoiceStateStorageKey : importedInvoicesStorageKey;
  const stored = window.localStorage.getItem(storageKey);
  if (!stored) return isDemo ? (demoInvoices as Invoice[]) : [];
  try {
    const parsed = JSON.parse(stored) as Invoice[];
    return Array.isArray(parsed) && parsed.length
      ? parsed
      : isDemo
        ? (demoInvoices as Invoice[])
        : [];
  } catch {
    return isDemo ? (demoInvoices as Invoice[]) : [];
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
 * Persist a status change triggered by the review drawer back to localStorage.
 * Demo users → write cashpilot Invoice[] to demoInvoiceStateStorageKey.
 * Real users → update zentra Invoice status in importedInvoicesStorageKey.
 */
function persistStatusChange(invoiceId: string, nextStatus: string | null) {
  if (typeof window === "undefined") return;
  const localAccount = readLocalAccount();
  const isDemo = localAccount?.planId === "demo";

  if (isDemo) {
    // Demo: persist the full cashpilot array (status is already cashpilot format)
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
    try { localStorage.setItem(key, JSON.stringify(updated)); } catch { /* quota */ }
  } else {
    // Real user: update zentra Invoice status
    const key = importedInvoicesStorageKey;
    const stored = localStorage.getItem(key);
    if (!stored) return;
    try {
      const invoices = JSON.parse(stored) as ZentraInvoice[];
      const zentraStatus = cashpilotStatusToZentra(nextStatus);
      const updated = invoices.map((inv) =>
        inv.id === invoiceId
          ? { ...inv, status: zentraStatus as ZentraInvoice["status"] }
          : inv,
      );
      localStorage.setItem(key, JSON.stringify(updated));
    } catch { /* quota or parse */ }
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
