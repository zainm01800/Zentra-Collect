/**
 * Recurring invoice templates.
 *
 * Stores recurring invoice schedules in localStorage. On each app load (or
 * on demand), `processRecurringInvoices()` checks whether any templates are
 * due and calls createInvoice() from the invoice store for each one.
 *
 * Templates are stored in "zentra.recurringInvoices.v1".
 */

import type { Invoice } from "@/types/zentra";
import { createInvoice, generateInvoiceId, generateInvoiceNumber, readInvoices } from "@/lib/invoice-store";

export type RecurringFrequency = "weekly" | "monthly" | "quarterly" | "annually";

export interface RecurringTemplate {
  id: string;
  customerName: string;
  customerEmail?: string;
  description: string;
  amount: number;
  currency: "GBP";
  frequency: RecurringFrequency;
  dayOfMonth: number;       // 1-28 — day of month to generate the invoice
  netDays: number;          // payment terms: days until due (e.g. 30)
  active: boolean;
  createdAt: string;
  lastGeneratedAt?: string; // ISO date of last generated invoice
  nextDueAt: string;        // ISO date of next generation
}

const STORAGE_KEY = "zentra.recurringInvoices.v1";

// ── CRUD ─────────────────────────────────────────────────────────────────────

export function readTemplates(): RecurringTemplate[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

export function writeTemplates(templates: RecurringTemplate[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
  } catch { /* quota */ }
}

export function saveTemplate(template: RecurringTemplate): void {
  const templates = readTemplates();
  const idx = templates.findIndex((t) => t.id === template.id);
  if (idx >= 0) templates[idx] = template;
  else templates.unshift(template);
  writeTemplates(templates);
}

export function deleteTemplate(id: string): void {
  writeTemplates(readTemplates().filter((t) => t.id !== id));
}

export function toggleTemplate(id: string, active: boolean): void {
  const templates = readTemplates();
  const t = templates.find((t) => t.id === id);
  if (t) { t.active = active; writeTemplates(templates); }
}

// ── Date helpers ──────────────────────────────────────────────────────────────

function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function nextGenerationDate(
  frequency: RecurringFrequency,
  dayOfMonth: number,
  from: Date = new Date(),
): string {
  const d = new Date(from);
  const day = Math.min(dayOfMonth, 28);

  if (frequency === "weekly") {
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  }

  if (frequency === "monthly") {
    // Next occurrence of dayOfMonth in this or the next month
    const candidate = new Date(d.getFullYear(), d.getMonth(), day);
    if (candidate <= d) candidate.setMonth(candidate.getMonth() + 1);
    return candidate.toISOString().slice(0, 10);
  }

  if (frequency === "quarterly") {
    const candidate = new Date(d.getFullYear(), d.getMonth(), day);
    if (candidate <= d) candidate.setMonth(candidate.getMonth() + 3);
    else candidate.setMonth(candidate.getMonth() + 3);
    return candidate.toISOString().slice(0, 10);
  }

  // annually
  const candidate = new Date(d.getFullYear(), d.getMonth(), day);
  if (candidate <= d) candidate.setFullYear(candidate.getFullYear() + 1);
  return candidate.toISOString().slice(0, 10);
}

export function newTemplate(partial: Partial<RecurringTemplate> = {}): RecurringTemplate {
  const id = `rec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const frequency: RecurringFrequency = partial.frequency ?? "monthly";
  const dayOfMonth = partial.dayOfMonth ?? 1;
  return {
    id,
    customerName: "",
    description: "",
    amount: 0,
    currency: "GBP",
    frequency,
    dayOfMonth,
    netDays: 30,
    active: true,
    createdAt: new Date().toISOString(),
    nextDueAt: nextGenerationDate(frequency, dayOfMonth),
    ...partial,
  };
}

// ── Invoice generation ────────────────────────────────────────────────────────

/**
 * Check all active templates and generate invoices for any that are due today
 * or overdue. Safe to call on every app load — it checks `nextDueAt` and
 * won't double-generate.
 *
 * Returns the number of invoices generated.
 */
export function processRecurringInvoices(): number {
  if (typeof window === "undefined") return 0;
  const templates = readTemplates();
  const today = new Date().toISOString().slice(0, 10);
  const existingInvoices = readInvoices();
  let generated = 0;

  const updated = templates.map((t) => {
    if (!t.active || t.nextDueAt > today) return t;

    // Generate the invoice
    const invoiceDate = today;
    const dueDate = addDays(today, t.netDays);
    const invoiceNumber = generateInvoiceNumber(existingInvoices);
    const id = generateInvoiceId();

    const invoice: Invoice = {
      id,
      businessId: "local",
      customerId: `cust-${t.customerName.toLowerCase().replace(/\s+/g, "-")}`,
      customerName: t.customerName,
      customerEmail: t.customerEmail,
      invoiceNumber,
      invoiceDate,
      dueDate,
      amount: t.amount,
      amountOutstanding: t.amount,
      currency: t.currency,
      status: "due_soon",
      daysOverdue: 0,
      previousChaseCount: 0,
      relationshipType: "regular customer",
      lineItems: [{
        id: `${id}-line-0`,
        description: t.description || `${t.frequency} invoice`,
        quantity: 1,
        unitPrice: t.amount,
        amount: t.amount,
      }],
      activityHistory: [],
      sourceBatchId: `recurring-${t.id}`,
      importedRowNumber: 0,
    };

    createInvoice(invoice);
    existingInvoices.unshift(invoice); // keep local list fresh for number generation
    generated++;

    return {
      ...t,
      lastGeneratedAt: today,
      nextDueAt: nextGenerationDate(t.frequency, t.dayOfMonth),
    };
  });

  writeTemplates(updated);
  return generated;
}
