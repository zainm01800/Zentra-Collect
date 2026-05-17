/**
 * invoice-store — single source of truth for invoice data.
 *
 * Every area of the app (chase queue, P&L, Tax, Aged Debt, Invoices hub)
 * reads and writes through this module. A custom DOM event notifies all
 * subscribed components whenever the data changes, so marking an invoice
 * paid in the chase queue immediately updates P&L, Tax, and Aged Debt
 * without a page reload.
 *
 * Usage:
 *   import { readInvoices, patchInvoice, subscribeToInvoiceChanges } from "@/lib/invoice-store";
 */

import type { CollectionStatus, Invoice } from "@/types/zentra";
import { readLocalAccount } from "@/lib/demo-auth";
import { importedInvoicesStorageKey } from "@/lib/import/zentra-import";
import {
  readActiveClientId,
  clientInvoicesKey,
} from "@/lib/bookkeeper-clients";
import { demoCashpilotInvoices } from "@/lib/demo-data/zentra-demo-data";

// ── Constants ─────────────────────────────────────────────────────────────────

export const INVOICE_CHANGE_EVENT = "zentra:invoices:changed";

const DEMO_INVOICE_KEY = "zentra.demoInvoiceState.v1";
const BOOKKEEPER_PLAN_IDS = new Set([
  "bookkeeper_starter",
  "bookkeeper_pro",
]);

// ── Key resolution ────────────────────────────────────────────────────────────

/** Returns the localStorage key for the current user/workspace. */
export function resolveStorageKey(): string {
  const account = readLocalAccount();
  if (account?.planId === "demo") return DEMO_INVOICE_KEY;
  if (account && BOOKKEEPER_PLAN_IDS.has(account.planId)) {
    const clientId = readActiveClientId();
    if (clientId && clientId !== "all") return clientInvoicesKey(clientId);
  }
  return importedInvoicesStorageKey;
}

// ── Read ──────────────────────────────────────────────────────────────────────

/**
 * Read all invoices for the current user/workspace.
 * Safe to call during SSR (returns []).
 */
export function readInvoices(): Invoice[] {
  if (typeof window === "undefined") return [];
  const account = readLocalAccount();
  const isDemo = account?.planId === "demo";
  const key = resolveStorageKey();
  const raw = window.localStorage.getItem(key);
  if (!raw) {
    return isDemo ? (demoCashpilotInvoices as unknown as Invoice[]) : [];
  }
  try {
    const parsed = JSON.parse(raw) as Invoice[];
    if (!Array.isArray(parsed) || !parsed.length) {
      return isDemo ? (demoCashpilotInvoices as unknown as Invoice[]) : [];
    }
    return parsed;
  } catch {
    return [];
  }
}

// ── Write ─────────────────────────────────────────────────────────────────────

/**
 * Persist the full invoice array and notify all subscribers.
 * All mutations should go through this or patchInvoice/createInvoice.
 */
export function writeInvoices(invoices: Invoice[]): void {
  if (typeof window === "undefined") return;
  const key = resolveStorageKey();
  try {
    window.localStorage.setItem(key, JSON.stringify(invoices));
  } catch {
    // localStorage quota — silently ignore, at least the in-memory state is fresh
  }
  window.dispatchEvent(new CustomEvent(INVOICE_CHANGE_EVENT));
}

/**
 * Atomically update one invoice by id. Only the provided fields are changed;
 * everything else is preserved. Dispatches INVOICE_CHANGE_EVENT after write.
 */
export function patchInvoice(id: string, patch: Partial<Invoice>): void {
  const invoices = readInvoices();
  const updated = invoices.map((inv) =>
    inv.id === id ? { ...inv, ...patch } : inv,
  );
  writeInvoices(updated);
}

/**
 * Prepend a new invoice to the list. Used by the invoice creation form
 * and the new-invoice drawer so the chase queue sees it immediately.
 */
export function createInvoice(invoice: Invoice): void {
  const invoices = readInvoices();
  writeInvoices([invoice, ...invoices]);
}

// ── Payment recording ─────────────────────────────────────────────────────────

export interface PaymentRecord {
  paidAt: string;          // ISO date string
  paidAmount: number;
  paidMethod: "bank_transfer" | "card" | "cash" | "cheque" | "direct_debit" | "other";
  paidReference?: string;
}

/**
 * Mark an invoice as fully paid with real payment metadata.
 * Sets status → "paid", amountOutstanding → 0, and stores the payment record.
 * Dispatches INVOICE_CHANGE_EVENT so P&L, Tax, Aged Debt update instantly.
 */
export function recordPayment(id: string, payment: PaymentRecord): void {
  patchInvoice(id, {
    status: "paid" as CollectionStatus,
    amountOutstanding: 0,
    // We store the payment record in a reserved field. The Invoice type doesn't
    // define paymentRecord yet, but we spread it in as extra data — downstream
    // readers can cast to InvoiceWithPayment if they need it.
    ...({ paymentRecord: payment } as object as Partial<Invoice>),
  });
}

/**
 * Map a cashpilot/review outcome string to a CollectionStatus.
 * Centralised here so chase-queue-data-wrapper and the review drawer
 * stay in sync.
 */
export function outcomeToCollectionStatus(outcome: string): CollectionStatus | null {
  switch (outcome) {
    case "paid":      return "paid";
    case "promised":  return "promised";
    case "dispute":   return "disputed";
    case "sent":      return "overdue";   // stays overdue, chase logged separately
    case "snooze":    return "do_not_chase";
    default:          return null;
  }
}

// ── Subscription ──────────────────────────────────────────────────────────────

/**
 * Subscribe to invoice changes. Returns an unsubscribe function — call it
 * in a useEffect cleanup to avoid memory leaks.
 *
 * Example:
 *   useEffect(() => subscribeToInvoiceChanges(() => setInvoices(readInvoices())), []);
 */
export function subscribeToInvoiceChanges(handler: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(INVOICE_CHANGE_EVENT, handler);
  return () => window.removeEventListener(INVOICE_CHANGE_EVENT, handler);
}

// ── Invoice generation helpers ────────────────────────────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000;

export function generateInvoiceId(): string {
  return `inv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

export function generateInvoiceNumber(existingInvoices: Invoice[]): string {
  // Try to find the highest INV-YYYYMM-NNN style number and increment
  const ym = (() => {
    const d = new Date();
    return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`;
  })();
  const pattern = new RegExp(`^INV-${ym}-(\\d+)$`);
  let max = 0;
  for (const inv of existingInvoices) {
    const m = inv.invoiceNumber?.match(pattern);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  const seq = String(max + 1).padStart(3, "0");
  return `INV-${ym}-${seq}`;
}

export function calculateDaysOverdue(dueDateStr: string): number {
  const due = new Date(dueDateStr).getTime();
  return Math.max(0, Math.floor((Date.now() - due) / DAY_MS));
}

export function deriveStatus(dueDateStr: string): CollectionStatus {
  const due = new Date(dueDateStr).getTime();
  const now = Date.now();
  if (due < now) return "overdue";
  if (due - now < 14 * DAY_MS) return "due_soon";
  return "due_soon";
}
