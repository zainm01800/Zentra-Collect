/**
 * Map Sage Business Cloud invoices → Zentra invoice schema.
 *
 * Sage's status semantics (subset we care about):
 *   - "Paid"      → paid
 *   - "Void"      → paid (closed, treated as done)
 *   - "Draft"     → not_due
 *   - "Sent" / "Part Paid":
 *       - if outstanding_amount === 0 → paid
 *       - else if due_date in past    → overdue
 *       - else if due_date <= +7 days → due_soon
 *       - else                        → not_due
 */

import type { Invoice as ZentraInvoice, CollectionStatus } from "@/types/zentra";
import type { SageInvoice } from "@/lib/integrations/sage/client";

const DAY_MS = 24 * 60 * 60 * 1000;

function parseSageDate(raw: string | undefined): string | null {
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

export function deriveStatus(sage: SageInvoice, today: Date = new Date()): CollectionStatus {
  const statusLabel = sage.status?.displayed_as?.toLowerCase() ?? "";

  if (statusLabel === "paid" || statusLabel === "void") return "paid";
  if ((sage.outstanding_amount ?? 0) <= 0) return "paid";

  if (statusLabel === "draft") return "not_due";

  const dueRaw = parseSageDate(sage.due_date);
  if (!dueRaw) return "not_due";

  const today0  = new Date(today.toISOString().slice(0, 10));
  const dueDate = new Date(dueRaw);
  const diffMs  = dueDate.getTime() - today0.getTime();

  if (diffMs < 0) return "overdue";
  if (diffMs <= 7 * DAY_MS) return "due_soon";
  return "not_due";
}

export function calculateDaysOverdue(
  dueDate: string | null,
  today:   Date = new Date(),
): number {
  if (!dueDate) return 0;
  const today0 = new Date(today.toISOString().slice(0, 10));
  const due    = new Date(dueDate);
  const diff   = today0.getTime() - due.getTime();
  return Math.max(0, Math.floor(diff / DAY_MS));
}

export function mapSageInvoice(
  sage:        SageInvoice,
  accountId:   string,
  businessId:  string,
  importedAt:  Date = new Date(),
  rowNumber:   number = 0,
): ZentraInvoice {
  const invoiceDate = parseSageDate(sage.date) ?? importedAt.toISOString().slice(0, 10);
  const dueDate     = parseSageDate(sage.due_date);
  const daysOverdue = calculateDaysOverdue(dueDate, importedAt);
  const status      = deriveStatus(sage, importedAt);

  return {
    id:                 `sage-${sage.id}`,
    businessId:         accountId,
    customerId:         `sage-${sage.contact.id}`,
    customerName:       sage.contact.displayed_as,
    customerEmail:      sage.main_address?.email,
    invoiceNumber:      sage.invoice_number ?? sage.reference ?? sage.displayed_as ?? `SAGE-${sage.id.slice(0, 8)}`,
    invoiceDate,
    dueDate:            dueDate ?? undefined,
    amount:             sage.total_amount,
    amountOutstanding:  sage.outstanding_amount,
    currency:           "GBP",
    status,
    daysOverdue,
    previousChaseCount: 0,
    relationshipType:   "regular customer",
    lineItems:          [],
    activityHistory:    [],
    sourceBatchId:      `sage-sync-${businessId}-${importedAt.toISOString().slice(0, 10)}`,
    importedRowNumber:  rowNumber,
  };
}

export function mapSageInvoices(
  invoices:   SageInvoice[],
  accountId:  string,
  businessId: string,
  importedAt: Date = new Date(),
): ZentraInvoice[] {
  return invoices.map((inv, idx) => mapSageInvoice(inv, accountId, businessId, importedAt, idx + 1));
}
