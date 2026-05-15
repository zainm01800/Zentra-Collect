/**
 * Tests for lib/cash-forecast.ts
 *
 * The cash forecast card sits at the top of the dashboard. Users will
 * make working-capital decisions based on these numbers. Tests cover the
 * window-bucketing, probability decay, and at-risk classification.
 */

import { describe, expect, it } from "vitest";
import { computeCashForecast } from "@/lib/cash-forecast";
import type { Invoice, InvoiceStatus } from "@/types/cashpilot";

function makeInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: `inv-${Math.random()}`,
    customerName: "Acme Ltd",
    customerEmail: "ap@acme.test",
    invoiceNumber: "INV-1",
    amount: 1000,
    currency: "GBP",
    issueDate: "2026-01-01",
    dueDate: "2026-02-01",
    daysOverdue: 0,
    status: "Overdue" as InvoiceStatus,
    lastChasedAt: null,
    promisedPaymentDate: null,
    chaseCount: 0,
    relationshipType: "regular client",
    notes: "",
    paymentLink: "",
    lineItems: [],
    activityHistory: [],
    ...overrides,
  };
}

// ── Helpers for relative dates ────────────────────────────────────────────────

const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();

// ── Top-level behaviours ──────────────────────────────────────────────────────

describe("computeCashForecast — empty input", () => {
  it("returns all zeros for no invoices", () => {
    const f = computeCashForecast([]);
    expect(f.next30).toBe(0);
    expect(f.next60).toBe(0);
    expect(f.next90).toBe(0);
    expect(f.atRisk).toBe(0);
    expect(f.totalOpen).toBe(0);
    expect(f.topPayers).toEqual([]);
  });

  it("excludes paid invoices from totalOpen", () => {
    const f = computeCashForecast([
      makeInvoice({ status: "Paid", amount: 5000 }),
    ]);
    expect(f.totalOpen).toBe(0);
  });
});

describe("computeCashForecast — promise dates", () => {
  it("buckets a near-term promise into the 30-day window", () => {
    const f = computeCashForecast([
      makeInvoice({
        amount: 1000,
        daysOverdue: 10,
        status: "Promised payment",
        promisedPaymentDate: inDays(14),
      }),
    ]);
    expect(f.next30).toBeGreaterThan(0);
    expect(f.next60).toBe(0);
  });

  it("buckets a 45-day-out promise into the 60-day window", () => {
    const f = computeCashForecast([
      makeInvoice({
        amount: 1000,
        daysOverdue: 5,
        status: "Promised payment",
        promisedPaymentDate: inDays(45),
      }),
    ]);
    expect(f.next30).toBe(0);
    expect(f.next60).toBeGreaterThan(0);
  });

  it("excludes a promise more than 90 days out from all windows", () => {
    const f = computeCashForecast([
      makeInvoice({
        amount: 1000,
        daysOverdue: 5,
        status: "Promised payment",
        promisedPaymentDate: inDays(120),
      }),
    ]);
    expect(f.next30 + f.next60 + f.next90).toBe(0);
  });
});

describe("computeCashForecast — probability decay", () => {
  it("on-time invoices get a higher weighting than long-overdue", () => {
    // Same amount, same customer → only difference is overdue length
    const onTime = computeCashForecast([
      makeInvoice({ amount: 1000, daysOverdue: 0, dueDate: inDays(14) }),
    ]);
    const veryLate = computeCashForecast([
      makeInvoice({ amount: 1000, daysOverdue: 200 }),
    ]);
    expect(onTime.next30).toBeGreaterThan(veryLate.next90);
  });

  it("disputed invoices get a very low probability weight", () => {
    const f = computeCashForecast([
      makeInvoice({
        amount: 1000,
        daysOverdue: 30,
        status: "Disputed",
      }),
    ]);
    // Probability is 10% → expected ≈ £100, regardless of window
    const total = f.next30 + f.next60 + f.next90;
    expect(total).toBeLessThan(200);
  });
});

describe("computeCashForecast — at-risk classification", () => {
  it("flags >30d overdue with no promise AND high-risk customer", () => {
    // Build a customer with broken-promise history to make them high risk
    const invoices = [
      makeInvoice({ customerName: "Slow Co", daysOverdue: 100, promisedPaymentDate: inDays(-30) }),
      makeInvoice({ customerName: "Slow Co", daysOverdue: 80,  amount: 5000 }),
    ];
    const f = computeCashForecast(invoices);
    expect(f.atRisk).toBeGreaterThan(0);
  });

  it("does NOT flag overdue invoices when a promise exists", () => {
    const f = computeCashForecast([
      makeInvoice({
        amount: 5000,
        daysOverdue: 60,
        status: "Promised payment",
        promisedPaymentDate: inDays(7),
      }),
    ]);
    expect(f.atRisk).toBe(0);
  });

  it("does NOT flag low-risk customers as at-risk", () => {
    const f = computeCashForecast([
      // A 35-day overdue but otherwise healthy customer
      makeInvoice({ customerName: "Healthy Co", amount: 1000, daysOverdue: 35 }),
    ]);
    expect(f.atRisk).toBe(0);
  });
});

describe("computeCashForecast — top payers", () => {
  it("returns top 3 customers by expected contribution, sorted descending", () => {
    const f = computeCashForecast([
      makeInvoice({ customerName: "Small",  amount: 100,   daysOverdue: 0, dueDate: inDays(10) }),
      makeInvoice({ customerName: "Medium", amount: 1000,  daysOverdue: 0, dueDate: inDays(10) }),
      makeInvoice({ customerName: "Big",    amount: 10000, daysOverdue: 0, dueDate: inDays(10) }),
      makeInvoice({ customerName: "Tiny",   amount: 50,    daysOverdue: 0, dueDate: inDays(10) }),
    ]);
    expect(f.topPayers).toHaveLength(3);
    expect(f.topPayers[0].customerName).toBe("Big");
    expect(f.topPayers[1].customerName).toBe("Medium");
    expect(f.topPayers[2].customerName).toBe("Small");
  });

  it("excludes customers contributing nothing within 90 days", () => {
    const f = computeCashForecast([
      // Way-out-of-window — over 6 months future due date
      makeInvoice({ customerName: "Future Co", amount: 5000, daysOverdue: 0, dueDate: inDays(200) }),
    ]);
    expect(f.topPayers).toHaveLength(0);
  });
});

describe("computeCashForecast — output integrity", () => {
  it("produces non-negative numbers", () => {
    const f = computeCashForecast([
      makeInvoice({ amount: 1000, daysOverdue: 50 }),
      makeInvoice({ amount: 500,  daysOverdue: 0  }),
    ]);
    expect(f.next30).toBeGreaterThanOrEqual(0);
    expect(f.next60).toBeGreaterThanOrEqual(0);
    expect(f.next90).toBeGreaterThanOrEqual(0);
    expect(f.atRisk).toBeGreaterThanOrEqual(0);
  });

  it("includes a generatedAt ISO timestamp", () => {
    const f = computeCashForecast([]);
    expect(() => new Date(f.generatedAt)).not.toThrow();
    expect(new Date(f.generatedAt).getTime()).not.toBeNaN();
  });
});
