/**
 * Map FreeAgent invoices → Zentra Invoice shape.
 *
 * Resolves the contact link per invoice into a name + email so the chase
 * plan has the data it needs. Contact lookups are cached during a single
 * mapping run to avoid N hits to /v2/contacts/{id}.
 */

import type { FaContact, FaInvoice } from "./client";
import { fetchContact } from "./client";
import type { Invoice as ZentraInvoice } from "@/types/zentra";

const DAY_MS = 1000 * 60 * 60 * 24;

function statusOf(fa: FaInvoice): ZentraInvoice["status"] {
  if (fa.status === "Paid") return "paid";
  if (fa.status === "Overdue") return "overdue";
  if (fa.status === "Cancelled" || fa.status === "Written off") return "do_not_chase";
  return "due_soon";
}

function contactName(c: FaContact | null): string {
  if (!c) return "Unknown";
  if (c.organisation_name) return c.organisation_name;
  return [c.first_name, c.last_name].filter(Boolean).join(" ") || "Unknown";
}

export async function mapFreeAgentInvoices(
  faInvoices: FaInvoice[],
  accountId:  string,
  businessId: string,
): Promise<ZentraInvoice[]> {
  const contactCache = new Map<string, FaContact | null>();
  const out: ZentraInvoice[] = [];
  const now = Date.now();

  for (const fa of faInvoices) {
    let contact: FaContact | null = contactCache.get(fa.contact) ?? null;
    if (!contactCache.has(fa.contact)) {
      contact = await fetchContact(accountId, fa.contact);
      contactCache.set(fa.contact, contact);
    }

    const amountOutstanding = parseFloat(fa.due_value || "0");
    const amount            = parseFloat(fa.total_value || "0");
    const daysOverdue = Math.max(
      0,
      Math.floor((now - new Date(fa.due_on).getTime()) / DAY_MS),
    );

    out.push({
      id:                 `freeagent-${fa.url.split("/").pop() ?? fa.reference}`,
      businessId,
      customerId:         `freeagent-${fa.contact.split("/").pop() ?? "unknown"}`,
      customerName:       contactName(contact),
      customerEmail:      contact?.email,
      invoiceNumber:      fa.reference,
      invoiceDate:        fa.dated_on,
      dueDate:            fa.due_on,
      amount,
      amountOutstanding,
      currency:           fa.currency === "GBP" ? "GBP" : "GBP",
      status:             statusOf(fa),
      daysOverdue,
      previousChaseCount: 0,
      relationshipType:   "regular customer",
      lineItems:          [],
      activityHistory:    [],
      sourceBatchId:      `freeagent-sync-${new Date().toISOString().slice(0, 10)}`,
      importedRowNumber:  out.length + 1,
    });
  }

  return out;
}
