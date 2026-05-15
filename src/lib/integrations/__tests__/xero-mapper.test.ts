/**
 * Tests for lib/integrations/xero/mapper.ts
 *
 * Mapping bugs would cause invoices to disappear, show wrong amounts, or
 * land in the wrong status bucket. Tests pin down date parsing (Xero uses
 * two formats), status derivation, and days-overdue arithmetic.
 */

import { describe, expect, it } from "vitest";
import {
  calculateDaysOverdue,
  deriveStatus,
  mapXeroInvoice,
  mapXeroInvoices,
} from "@/lib/integrations/xero/mapper";
import type { XeroInvoice } from "@/lib/integrations/xero/client";

const TODAY = new Date("2026-05-15T12:00:00.000Z");

function makeXeroInvoice(overrides: Partial<XeroInvoice> = {}): XeroInvoice {
  return {
    InvoiceID:   "abc-123",
    InvoiceNumber: "INV-001",
    Type:        "ACCREC",
    Contact:     { ContactID: "cust-1", Name: "Acme Ltd", EmailAddress: "ap@acme.test" },
    Date:        "2026-04-15",
    DueDate:     "2026-05-15",
    Status:      "AUTHORISED",
    CurrencyCode: "GBP",
    Total:       1000,
    AmountDue:   1000,
    AmountPaid:  0,
    ...overrides,
  };
}

describe("calculateDaysOverdue", () => {
  it("returns 0 for a future due date", () => {
    expect(calculateDaysOverdue("2026-06-15", TODAY)).toBe(0);
  });
  it("returns 0 when due today", () => {
    expect(calculateDaysOverdue("2026-05-15", TODAY)).toBe(0);
  });
  it("returns days late for a past due date", () => {
    expect(calculateDaysOverdue("2026-04-15", TODAY)).toBe(30);
  });
  it("returns 0 when dueDate is null", () => {
    expect(calculateDaysOverdue(null, TODAY)).toBe(0);
  });
});

describe("deriveStatus", () => {
  it("paid when Xero status is PAID", () => {
    expect(deriveStatus(makeXeroInvoice({ Status: "PAID" }), TODAY)).toBe("paid");
  });
  it("overdue when AUTHORISED + DueDate in past", () => {
    expect(deriveStatus(makeXeroInvoice({ DueDate: "2026-04-01" }), TODAY)).toBe("overdue");
  });
  it("due_soon when AUTHORISED + DueDate within 7 days", () => {
    expect(deriveStatus(makeXeroInvoice({ DueDate: "2026-05-20" }), TODAY)).toBe("due_soon");
  });
  it("not_due when AUTHORISED + DueDate well in the future", () => {
    expect(deriveStatus(makeXeroInvoice({ DueDate: "2026-08-01" }), TODAY)).toBe("not_due");
  });
  it("treats VOIDED and DELETED as paid (closed)", () => {
    expect(deriveStatus(makeXeroInvoice({ Status: "VOIDED" }), TODAY)).toBe("paid");
    expect(deriveStatus(makeXeroInvoice({ Status: "DELETED" }), TODAY)).toBe("paid");
  });
  it("treats DRAFT and SUBMITTED as not_due", () => {
    expect(deriveStatus(makeXeroInvoice({ Status: "DRAFT" }), TODAY)).toBe("not_due");
    expect(deriveStatus(makeXeroInvoice({ Status: "SUBMITTED" }), TODAY)).toBe("not_due");
  });
});

describe("mapXeroInvoice", () => {
  it("prefixes invoice id with xero-", () => {
    const r = mapXeroInvoice(makeXeroInvoice(), "acc-1", "tenant-1", TODAY, 5);
    expect(r.id).toBe("xero-abc-123");
    expect(r.customerId).toBe("xero-cust-1");
  });

  it("preserves invoice number, total, and outstanding", () => {
    const r = mapXeroInvoice(
      makeXeroInvoice({ InvoiceNumber: "INV-42", Total: 1200, AmountDue: 800 }),
      "acc-1", "tenant-1", TODAY, 1,
    );
    expect(r.invoiceNumber).toBe("INV-42");
    expect(r.amount).toBe(1200);
    expect(r.amountOutstanding).toBe(800);
  });

  it("derives daysOverdue from DueDate", () => {
    const r = mapXeroInvoice(
      makeXeroInvoice({ DueDate: "2026-04-01" }),
      "acc-1", "tenant-1", TODAY, 1,
    );
    expect(r.daysOverdue).toBe(44);
    expect(r.status).toBe("overdue");
  });

  it("falls back to a synthesized invoice number when missing", () => {
    const r = mapXeroInvoice(
      makeXeroInvoice({ InvoiceNumber: undefined, InvoiceID: "long-uuid-12345678" }),
      "acc-1", "tenant-1", TODAY, 1,
    );
    expect(r.invoiceNumber).toMatch(/^XERO-/);
  });

  it("handles Xero /Date(...)/ format", () => {
    const ts = new Date("2026-04-15").getTime();
    const r = mapXeroInvoice(
      makeXeroInvoice({ Date: `/Date(${ts}+0000)/`, DueDate: `/Date(${ts}+0000)/` }),
      "acc-1", "tenant-1", TODAY, 1,
    );
    expect(r.invoiceDate).toBe("2026-04-15");
    expect(r.dueDate).toBe("2026-04-15");
  });

  it("uses sourceBatchId scoped to tenant + date", () => {
    const r = mapXeroInvoice(makeXeroInvoice(), "acc-1", "tenant-XYZ", TODAY, 1);
    expect(r.sourceBatchId).toContain("xero-sync-tenant-XYZ");
  });
});

describe("mapXeroInvoices", () => {
  it("preserves order and assigns row numbers from 1", () => {
    const invoices = [
      makeXeroInvoice({ InvoiceID: "a" }),
      makeXeroInvoice({ InvoiceID: "b" }),
      makeXeroInvoice({ InvoiceID: "c" }),
    ];
    const r = mapXeroInvoices(invoices, "acc-1", "tenant-1", TODAY);
    expect(r).toHaveLength(3);
    expect(r[0].id).toBe("xero-a");
    expect(r[0].importedRowNumber).toBe(1);
    expect(r[2].importedRowNumber).toBe(3);
  });
});
