"use client";

import type { Invoice, QueueStatus } from "@/types/zentra";
import {
  importedInvoicesStorageKey,
  waitingInvoicesNoticeKey,
} from "@/lib/import/zentra-import";

export type QueueCounts = {
  active: number;
  waiting: number;
};

export type PromotionEvent = {
  invoiceId: string;
  customerName: string;
  invoiceNumber: string;
  amountOutstanding: number;
  promotedAt: string;
};

// ── Storage helpers ────────────────────────────────────────────────────────

export function readAllQueuedInvoices(): Invoice[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(importedInvoicesStorageKey);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? (parsed as Invoice[]) : [];
  } catch {
    return [];
  }
}

function writeAllQueuedInvoices(invoices: Invoice[]): void {
  localStorage.setItem(importedInvoicesStorageKey, JSON.stringify(invoices));
}

export function readActiveInvoices(): Invoice[] {
  return readAllQueuedInvoices().filter(
    (inv) => !inv.queueStatus || inv.queueStatus === "active",
  );
}

export function readWaitingInvoices(): Invoice[] {
  return readAllQueuedInvoices()
    .filter((inv) => inv.queueStatus === "waiting")
    .sort((a, b) => b.amountOutstanding - a.amountOutstanding);
}

export function getQueueCounts(): QueueCounts {
  const all = readAllQueuedInvoices();
  return {
    active: all.filter((inv) => !inv.queueStatus || inv.queueStatus === "active")
      .length,
    waiting: all.filter((inv) => inv.queueStatus === "waiting").length,
  };
}

// ── Queue split ────────────────────────────────────────────────────────────

// Called on every import (fresh or re-import). Assigns queueStatus to all
// invoices from scratch — previous statuses are discarded so the new file
// is always the source of truth.
//
// Promotion priority: highest amountOutstanding first (configurable later).
export function applyQueueSplit(
  invoices: Invoice[],
  planLimit: number | "unlimited",
): Invoice[] {
  if (planLimit === "unlimited") {
    return invoices.map((inv) => ({ ...inv, queueStatus: "active" as QueueStatus }));
  }

  // Sort descending by outstanding amount to determine priority
  const sorted = [...invoices].sort(
    (a, b) => b.amountOutstanding - a.amountOutstanding,
  );

  return sorted.map((inv, idx) => ({
    ...inv,
    queueStatus: (idx < planLimit ? "active" : "waiting") as QueueStatus,
    // Clear any stale promotedAt from a previous import cycle
    promotedAt: undefined,
  }));
}

// ── Slot freeing + promotion ───────────────────────────────────────────────

// Mark one invoice with a terminal status and promote the next waiting invoice
// into active. Returns a PromotionEvent if a promotion happened (used to show
// the notification banner), or null if nothing was waiting.
export function freeSlot(
  invoiceId: string,
  newStatus: Extract<QueueStatus, "paid" | "dismissed" | "archived">,
): PromotionEvent | null {
  const all = readAllQueuedInvoices();
  if (!all.length) return null;

  // Find the highest-priority waiting invoice
  const waiting = all
    .filter((inv) => inv.queueStatus === "waiting")
    .sort((a, b) => b.amountOutstanding - a.amountOutstanding);

  const toPromote = waiting[0] ?? null;
  const promotedAt = toPromote ? new Date().toISOString() : undefined;

  const updated = all.map((inv) => {
    if (inv.id === invoiceId) {
      return { ...inv, queueStatus: newStatus };
    }
    if (toPromote && inv.id === toPromote.id) {
      return { ...inv, queueStatus: "active" as QueueStatus, promotedAt };
    }
    return inv;
  });

  writeAllQueuedInvoices(updated);

  if (!toPromote || !promotedAt) return null;

  const event: PromotionEvent = {
    invoiceId: toPromote.id,
    customerName: toPromote.customerName,
    invoiceNumber: toPromote.invoiceNumber,
    amountOutstanding: toPromote.amountOutstanding,
    promotedAt,
  };
  localStorage.setItem(waitingInvoicesNoticeKey, JSON.stringify(event));
  return event;
}

// Read and clear the latest promotion event so the banner shows once only.
export function consumePromotionEvent(): PromotionEvent | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(waitingInvoicesNoticeKey);
    if (!stored) return null;
    localStorage.removeItem(waitingInvoicesNoticeKey);
    return JSON.parse(stored) as PromotionEvent;
  } catch {
    return null;
  }
}
