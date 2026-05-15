/**
 * Tests for lib/client-report.ts
 *
 * The client report is something bookkeepers send to their CLIENTS — so the
 * numbers have to be auditable. Tests pin down aged-debt bucketing, top
 * overdue selection, and outstanding totals.
 */

import { describe, expect, it } from "vitest";
import {
  computeClientReport,
  type InvoiceForReport,
} from "@/lib/client-report";

function makeInvoice(overrides: Partial<InvoiceForReport> = {}): InvoiceForReport {
  return {
    id: `inv-${Math.random()}`,
    customerName: "Acme Ltd",
    invoiceNumber: "INV-1",
    amount: 1000,
    daysOverdue: 0,
    status: "Overdue",
    ...overrides,
  };
}

// ── Empty input ───────────────────────────────────────────────────────────────

describe("computeClientReport — empty input", () => {
  it("returns zeros for no invoices", () => {
    const r = computeClientReport([]);
    expect(r.totalOutstanding).toBe(0);
    expect(r.totalOverdue).toBe(0);
    expect(r.customerCount).toBe(0);
    expect(r.openInvoiceCount).toBe(0);
    expect(r.topOverdue).toEqual([]);
    expect(r.topDebtors).toEqual([]);
  });

  it("always returns 5 aged-debt buckets in correct order", () => {
    const r = computeClientReport([]);
    expect(r.agedDebt).toHaveLength(5);
    expect(r.agedDebt.map((b) => b.label)).toEqual([
      "Current",
      "1-30 days",
      "31-60 days",
      "61-90 days",
      "90+ days",
    ]);
  });
});

// ── Aged debt bucketing ───────────────────────────────────────────────────────

describe("computeClientReport — aged debt buckets", () => {
  it("buckets a not-yet-due invoice as Current", () => {
    const r = computeClientReport([makeInvoice({ daysOverdue: 0 })]);
    expect(r.agedDebt[0].amount).toBe(1000);
    expect(r.agedDebt[0].invoiceCount).toBe(1);
  });

  it("buckets 15 days overdue as 1-30 days", () => {
    const r = computeClientReport([makeInvoice({ daysOverdue: 15, amount: 500 })]);
    expect(r.agedDebt[1].amount).toBe(500);
  });

  it("buckets 45 days overdue as 31-60 days", () => {
    const r = computeClientReport([makeInvoice({ daysOverdue: 45, amount: 700 })]);
    expect(r.agedDebt[2].amount).toBe(700);
  });

  it("buckets 75 days overdue as 61-90 days", () => {
    const r = computeClientReport([makeInvoice({ daysOverdue: 75, amount: 900 })]);
    expect(r.agedDebt[3].amount).toBe(900);
  });

  it("buckets 200 days overdue as 90+ days", () => {
    const r = computeClientReport([makeInvoice({ daysOverdue: 200, amount: 1500 })]);
    expect(r.agedDebt[4].amount).toBe(1500);
    expect(r.agedDebt[4].invoiceCount).toBe(1);
  });

  it("places boundary 30d in 1-30, 31d in 31-60", () => {
    const r = computeClientReport([
      makeInvoice({ daysOverdue: 30, amount: 100 }),
      makeInvoice({ daysOverdue: 31, amount: 200 }),
    ]);
    expect(r.agedDebt[1].amount).toBe(100);
    expect(r.agedDebt[2].amount).toBe(200);
  });
});

// ── Outstanding amount handling ──────────────────────────────────────────────

describe("computeClientReport — amountOutstanding preference", () => {
  it("uses amountOutstanding when provided (covers partial payments)", () => {
    const r = computeClientReport([
      makeInvoice({ amount: 1000, amountOutstanding: 250, daysOverdue: 10 }),
    ]);
    expect(r.totalOutstanding).toBe(250);
    expect(r.agedDebt[1].amount).toBe(250);
  });

  it("falls back to amount when amountOutstanding is missing", () => {
    const r = computeClientReport([makeInvoice({ amount: 1500 })]);
    expect(r.totalOutstanding).toBe(1500);
  });
});

// ── Paid invoices excluded ────────────────────────────────────────────────────

describe("computeClientReport — excludes paid", () => {
  it("ignores paid invoices in all totals", () => {
    const r = computeClientReport([
      makeInvoice({ amount: 1000, status: "Paid"     }),
      makeInvoice({ amount: 500,  status: "Overdue", daysOverdue: 10 }),
    ]);
    expect(r.totalOutstanding).toBe(500);
    expect(r.openInvoiceCount).toBe(1);
  });

  it("is case-insensitive for status (zentra uses lowercase)", () => {
    const r = computeClientReport([
      makeInvoice({ amount: 1000, status: "paid" }),
      makeInvoice({ amount: 500,  status: "overdue" }),
    ]);
    expect(r.totalOutstanding).toBe(500);
  });
});

// ── Top overdue ───────────────────────────────────────────────────────────────

describe("computeClientReport — top overdue", () => {
  it("sorts by daysOverdue desc, then by amount desc", () => {
    const r = computeClientReport([
      makeInvoice({ invoiceNumber: "A", daysOverdue: 30, amount: 100  }),
      makeInvoice({ invoiceNumber: "B", daysOverdue: 30, amount: 500  }),
      makeInvoice({ invoiceNumber: "C", daysOverdue: 90, amount: 50   }),
      makeInvoice({ invoiceNumber: "D", daysOverdue: 0,  amount: 9999 }),
    ]);
    expect(r.topOverdue.map((i) => i.invoiceNumber)).toEqual(["C", "B", "A"]);
  });

  it("caps at 10 invoices", () => {
    const invoices = Array.from({ length: 30 }, (_, i) =>
      makeInvoice({ invoiceNumber: `I-${i}`, daysOverdue: 30 + i }),
    );
    const r = computeClientReport(invoices);
    expect(r.topOverdue).toHaveLength(10);
  });

  it("excludes not-yet-due invoices from the top overdue list", () => {
    const r = computeClientReport([
      makeInvoice({ invoiceNumber: "DUE-LATER", daysOverdue: 0 }),
      makeInvoice({ invoiceNumber: "OVERDUE",   daysOverdue: 5 }),
    ]);
    expect(r.topOverdue.map((i) => i.invoiceNumber)).toEqual(["OVERDUE"]);
  });
});

// ── Top debtors ───────────────────────────────────────────────────────────────

describe("computeClientReport — top debtors", () => {
  it("aggregates by customer and sorts by total outstanding", () => {
    const r = computeClientReport([
      makeInvoice({ customerName: "Big Co",   amount: 5000, daysOverdue: 10 }),
      makeInvoice({ customerName: "Big Co",   amount: 3000, daysOverdue: 50 }),
      makeInvoice({ customerName: "Small Co", amount: 200,  daysOverdue: 5  }),
    ]);
    expect(r.topDebtors[0]).toMatchObject({
      customerName: "Big Co",
      totalOutstanding: 8000,
      invoiceCount: 2,
      maxDaysOverdue: 50,
    });
    expect(r.topDebtors[1].customerName).toBe("Small Co");
  });

  it("caps at 5 debtors", () => {
    const r = computeClientReport(
      Array.from({ length: 10 }, (_, i) =>
        makeInvoice({ customerName: `Customer ${i}`, amount: 100 + i, daysOverdue: 5 }),
      ),
    );
    expect(r.topDebtors).toHaveLength(5);
  });
});

// ── Avg / max overdue ────────────────────────────────────────────────────────

describe("computeClientReport — avg/max overdue", () => {
  it("computes averageDaysOverdue only over overdue invoices", () => {
    const r = computeClientReport([
      makeInvoice({ daysOverdue: 0  }),
      makeInvoice({ daysOverdue: 30 }),
      makeInvoice({ daysOverdue: 60 }),
    ]);
    expect(r.averageDaysOverdue).toBe(45);
  });

  it("reports 0 averageDaysOverdue when no invoices are overdue", () => {
    const r = computeClientReport([makeInvoice({ daysOverdue: 0 })]);
    expect(r.averageDaysOverdue).toBe(0);
  });

  it("finds oldestOverdueDays", () => {
    const r = computeClientReport([
      makeInvoice({ daysOverdue: 10  }),
      makeInvoice({ daysOverdue: 100 }),
      makeInvoice({ daysOverdue: 0   }),
    ]);
    expect(r.oldestOverdueDays).toBe(100);
  });
});

// ── Customer count ───────────────────────────────────────────────────────────

describe("computeClientReport — customerCount", () => {
  it("counts distinct customer names with open invoices", () => {
    const r = computeClientReport([
      makeInvoice({ customerName: "A" }),
      makeInvoice({ customerName: "A" }),
      makeInvoice({ customerName: "B" }),
      makeInvoice({ customerName: "C", status: "Paid" }),
    ]);
    expect(r.customerCount).toBe(2);
  });
});
