/**
 * Tests for lib/integrations/quickbooks/mapper.ts
 *
 * QuickBooks status is implicit (Balance > 0 = unpaid). Tests pin down the
 * implicit-status logic, days-overdue derivation, and handling of missing
 * fields like DueDate.
 */

import { describe, expect, it } from "vitest";
import {
  calculateDaysOverdue,
  deriveStatus,
  mapQBInvoice,
  mapQBInvoices,
} from "@/lib/integrations/quickbooks/mapper";
import type { QBInvoice } from "@/lib/integrations/quickbooks/client";

const TODAY = new Date("2026-05-15T12:00:00.000Z");

function makeQBInvoice(overrides: Partial<QBInvoice> = {}): QBInvoice {
  return {
    Id:           "501",
    DocNumber:    "INV-1001",
    TxnDate:      "2026-04-15",
    DueDate:      "2026-05-15",
    CustomerRef:  { value: "23", name: "BluePeak Design" },
    BillEmail:    { Address: "ap@bluepeak.test" },
    TotalAmt:     1500,
    Balance:      1500,
    CurrencyRef:  { value: "GBP" },
    ...overrides,
  };
}

describe("calculateDaysOverdue (QB)", () => {
  it("returns days late for past dueDate", () => {
    expect(calculateDaysOverdue("2026-03-15", TODAY)).toBe(61);
  });
  it("returns 0 when not yet due", () => {
    expect(calculateDaysOverdue("2026-06-15", TODAY)).toBe(0);
  });
  it("returns 0 when dueDate is null", () => {
    expect(calculateDaysOverdue(null, TODAY)).toBe(0);
  });
});

describe("deriveStatus (QB)", () => {
  it("paid when Balance is 0", () => {
    expect(deriveStatus(makeQBInvoice({ Balance: 0 }), TODAY)).toBe("paid");
  });
  it("paid when Balance is negative (credit)", () => {
    expect(deriveStatus(makeQBInvoice({ Balance: -100 }), TODAY)).toBe("paid");
  });
  it("overdue when Balance > 0 + DueDate in past", () => {
    expect(deriveStatus(makeQBInvoice({ DueDate: "2026-04-01" }), TODAY)).toBe("overdue");
  });
  it("due_soon when Balance > 0 + DueDate within 7 days", () => {
    expect(deriveStatus(makeQBInvoice({ DueDate: "2026-05-20" }), TODAY)).toBe("due_soon");
  });
  it("not_due when Balance > 0 + DueDate well in future", () => {
    expect(deriveStatus(makeQBInvoice({ DueDate: "2026-08-01" }), TODAY)).toBe("not_due");
  });
  it("not_due when Balance > 0 but DueDate missing", () => {
    expect(deriveStatus(makeQBInvoice({ DueDate: undefined }), TODAY)).toBe("not_due");
  });
});

describe("mapQBInvoice", () => {
  it("prefixes invoice id with qb-", () => {
    const r = mapQBInvoice(makeQBInvoice(), "acc-1", "realm-1", TODAY, 1);
    expect(r.id).toBe("qb-501");
    expect(r.customerId).toBe("qb-23");
  });

  it("preserves DocNumber as invoice number", () => {
    const r = mapQBInvoice(
      makeQBInvoice({ DocNumber: "QB-INV-99" }),
      "acc-1", "realm-1", TODAY, 1,
    );
    expect(r.invoiceNumber).toBe("QB-INV-99");
  });

  it("falls back to QB-{id} when DocNumber missing", () => {
    const r = mapQBInvoice(
      makeQBInvoice({ DocNumber: undefined, Id: "789" }),
      "acc-1", "realm-1", TODAY, 1,
    );
    expect(r.invoiceNumber).toBe("QB-789");
  });

  it("preserves total and outstanding from TotalAmt and Balance", () => {
    const r = mapQBInvoice(
      makeQBInvoice({ TotalAmt: 2500, Balance: 1200 }),
      "acc-1", "realm-1", TODAY, 1,
    );
    expect(r.amount).toBe(2500);
    expect(r.amountOutstanding).toBe(1200);
  });

  it("derives daysOverdue from DueDate", () => {
    const r = mapQBInvoice(
      makeQBInvoice({ DueDate: "2026-03-15" }),
      "acc-1", "realm-1", TODAY, 1,
    );
    expect(r.daysOverdue).toBe(61);
    expect(r.status).toBe("overdue");
  });

  it("uses BillEmail address when present", () => {
    const r = mapQBInvoice(
      makeQBInvoice({ BillEmail: { Address: "billing@test.com" } }),
      "acc-1", "realm-1", TODAY, 1,
    );
    expect(r.customerEmail).toBe("billing@test.com");
  });

  it("handles missing BillEmail gracefully", () => {
    const r = mapQBInvoice(
      makeQBInvoice({ BillEmail: undefined }),
      "acc-1", "realm-1", TODAY, 1,
    );
    expect(r.customerEmail).toBeUndefined();
  });

  it("uses Unknown when CustomerRef.name is missing", () => {
    const r = mapQBInvoice(
      makeQBInvoice({ CustomerRef: { value: "12" } }),
      "acc-1", "realm-1", TODAY, 1,
    );
    expect(r.customerName).toBe("Unknown");
  });

  it("uses sourceBatchId scoped to realm + date", () => {
    const r = mapQBInvoice(makeQBInvoice(), "acc-1", "realm-XYZ", TODAY, 1);
    expect(r.sourceBatchId).toContain("quickbooks-sync-realm-XYZ");
  });
});

describe("mapQBInvoices", () => {
  it("assigns row numbers from 1", () => {
    const r = mapQBInvoices(
      [makeQBInvoice({ Id: "1" }), makeQBInvoice({ Id: "2" })],
      "acc-1",
      "realm-1",
      TODAY,
    );
    expect(r[0].importedRowNumber).toBe(1);
    expect(r[1].importedRowNumber).toBe(2);
  });
});
