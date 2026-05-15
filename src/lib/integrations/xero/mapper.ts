/**
 * Map Xero invoices → Zentra invoice schema.
 *
 * Xero status taxonomy ≠ Zentra status. We translate:
 *
 *   Xero AUTHORISED + DueDate in past   → "overdue"
 *   Xero AUTHORISED + DueDate <= 7 days → "due_soon"
 *   Xero AUTHORISED + DueDate >  7 days → "not_due"
 *   Xero PAID                            → "paid"
 *
 * Xero dates come in two flavours: `/Date(1234567890000)/` for some endpoints,
 * `YYYY-MM-DD` for others. We handle both.
 */

import type { Invoice as ZentraInvoice, CollectionStatus } from "@/types/zentra";
import type { XeroInvoice } from "@/lib/integrations/xero/client";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Parse a Xero date — handles both `/Date(...)/` and ISO formats. */
function parseXeroDate(raw: string | undefined): string | null {
  if (!raw) return null;
  const dateMatch = raw.match(/\/Date\((\d+)[+-]?\d*\)\//);
  if (dateMatch) {
    return new Date(Number(dateMatch[1])).toISOString().slice(0, 10);
  }
  // Fallback: assume already ISO-ish
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

/** Determine Zentra collection status from Xero invoice + dates. */
export function deriveStatus(xero: XeroInvoice, today: Date = new Date()): CollectionStatus {
  if (xero.Status === "PAID") return "paid";
  if (xero.Status === "VOIDED" || xero.Status === "DELETED") return "paid"; // treat as closed
  if (xero.Status === "DRAFT" || xero.Status === "SUBMITTED") return "not_due";

  const dueRaw = parseXeroDate(xero.DueDate);
  if (!dueRaw) return "not_due";

  const today0  = new Date(today.toISOString().slice(0, 10));
  const dueDate = new Date(dueRaw);
  const diffMs  = dueDate.getTime() - today0.getTime();

  if (diffMs < 0) return "overdue";
  if (diffMs <= 7 * DAY_MS) return "due_soon";
  return "not_due";
}

/** Calculate days overdue. Negative for not-yet-due invoices. */
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

// ── Main mapper ──────────────────────────────────────────────────────────────

/**
 * Convert a Xero invoice into Zentra's invoice schema.
 *
 * Most metadata (businessId, sourceBatchId, importedRowNumber, etc.) is
 * synthesised from the Xero context — these fields exist for compatibility
 * with the CSV-import flow.
 */
export function mapXeroInvoice(
  xero:           XeroInvoice,
  accountId:      string,
  tenantId:       string,
  importedAt:     Date = new Date(),
  rowNumber:      number = 0,
): ZentraInvoice {
  const invoiceDate = parseXeroDate(xero.Date)    ?? importedAt.toISOString().slice(0, 10);
  const dueDate     = parseXeroDate(xero.DueDate);
  const daysOverdue = calculateDaysOverdue(dueDate, importedAt);
  const status      = deriveStatus(xero, importedAt);

  return {
    id:                 `xero-${xero.InvoiceID}`,
    businessId:         accountId, // map to account scope; bookkeeper view filters by bookkeeperClientId separately
    customerId:         `xero-${xero.Contact.ContactID}`,
    customerName:       xero.Contact.Name,
    customerEmail:      xero.Contact.EmailAddress,
    invoiceNumber:      xero.InvoiceNumber ?? `XERO-${xero.InvoiceID.slice(0, 8)}`,
    invoiceDate,
    dueDate:            dueDate ?? undefined,
    amount:             xero.Total,
    amountOutstanding:  xero.AmountDue,
    currency:           xero.CurrencyCode === "GBP" ? "GBP" : "GBP", // we only model GBP currently
    status,
    daysOverdue,
    previousChaseCount: 0,
    relationshipType:   "regular customer",
    lineItems:          [],
    activityHistory:    [],
    sourceBatchId:      `xero-sync-${tenantId}-${importedAt.toISOString().slice(0, 10)}`,
    importedRowNumber:  rowNumber,
  };
}

/** Batch-map a list of Xero invoices. */
export function mapXeroInvoices(
  invoices:  XeroInvoice[],
  accountId: string,
  tenantId:  string,
  importedAt: Date = new Date(),
): ZentraInvoice[] {
  return invoices.map((inv, idx) => mapXeroInvoice(inv, accountId, tenantId, importedAt, idx + 1));
}
