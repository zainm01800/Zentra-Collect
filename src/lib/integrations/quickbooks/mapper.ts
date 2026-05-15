/**
 * Map QuickBooks invoices → Zentra invoice schema.
 *
 * QuickBooks status is implicit:
 *   - Balance === 0       → paid
 *   - Balance > 0 + DueDate < today → overdue
 *   - Balance > 0 + DueDate <= today + 7 → due_soon
 *   - Balance > 0 + DueDate > today + 7 → not_due
 */

import type { Invoice as ZentraInvoice, CollectionStatus } from "@/types/zentra";
import type { QBInvoice } from "@/lib/integrations/quickbooks/client";

const DAY_MS = 24 * 60 * 60 * 1000;

function parseQBDate(raw: string | undefined): string | null {
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

export function deriveStatus(qb: QBInvoice, today: Date = new Date()): CollectionStatus {
  if (qb.Balance <= 0) return "paid";

  const dueRaw = parseQBDate(qb.DueDate);
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

export function mapQBInvoice(
  qb:          QBInvoice,
  accountId:   string,
  realmId:     string,
  importedAt:  Date = new Date(),
  rowNumber:   number = 0,
): ZentraInvoice {
  const invoiceDate = parseQBDate(qb.TxnDate) ?? importedAt.toISOString().slice(0, 10);
  const dueDate     = parseQBDate(qb.DueDate);
  const daysOverdue = calculateDaysOverdue(dueDate, importedAt);
  const status      = deriveStatus(qb, importedAt);

  return {
    id:                 `qb-${qb.Id}`,
    businessId:         accountId,
    customerId:         `qb-${qb.CustomerRef.value}`,
    customerName:       qb.CustomerRef.name ?? "Unknown",
    customerEmail:      qb.BillEmail?.Address,
    invoiceNumber:      qb.DocNumber ?? `QB-${qb.Id}`,
    invoiceDate,
    dueDate:            dueDate ?? undefined,
    amount:             qb.TotalAmt,
    amountOutstanding:  qb.Balance,
    currency:           "GBP", // we display GBP; native currency surfaced separately later
    status,
    daysOverdue,
    previousChaseCount: 0,
    relationshipType:   "regular customer",
    lineItems:          [],
    activityHistory:    [],
    sourceBatchId:      `quickbooks-sync-${realmId}-${importedAt.toISOString().slice(0, 10)}`,
    importedRowNumber:  rowNumber,
  };
}

export function mapQBInvoices(
  invoices:   QBInvoice[],
  accountId:  string,
  realmId:    string,
  importedAt: Date = new Date(),
): ZentraInvoice[] {
  return invoices.map((inv, idx) => mapQBInvoice(inv, accountId, realmId, importedAt, idx + 1));
}
