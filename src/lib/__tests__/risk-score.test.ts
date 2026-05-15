/**
 * Tests for lib/risk-score.ts
 *
 * Risk scoring feeds the badges shown on every chase queue row and the
 * customer profile page. Bugs here would mislead users about who to
 * prioritise. These tests pin down the "worst signal wins" semantics and
 * each individual scoring rule.
 */

import { describe, expect, it } from "vitest";
import {
  computeCustomerRisk,
  computeCustomerRiskMap,
  type InvoiceForRisk,
} from "@/lib/risk-score";

// ── Test fixtures ─────────────────────────────────────────────────────────────

function makeInvoice(overrides: Partial<InvoiceForRisk> = {}): InvoiceForRisk {
  return {
    customerName: "Acme Ltd",
    amount: 1000,
    daysOverdue: 0,
    status: "Overdue",
    chaseCount: 0,
    relationshipType: "regular client",
    ...overrides,
  };
}

const futureDate = new Date(Date.now() + 7 * 86_400_000).toISOString();
const pastDate   = new Date(Date.now() - 7 * 86_400_000).toISOString();

// ── Score level tests ─────────────────────────────────────────────────────────

describe("computeCustomerRisk — level 1 (Low)", () => {
  it("returns Low for an on-time payer with one open invoice", () => {
    const r = computeCustomerRisk("Acme", [makeInvoice({ daysOverdue: 0 })]);
    expect(r.level).toBe(1);
    expect(r.label).toBe("Low");
  });

  it("returns level 1 with no open invoices", () => {
    const r = computeCustomerRisk("Acme", [makeInvoice({ status: "Paid" })]);
    expect(r.level).toBe(1);
    expect(r.stats.openInvoiceCount).toBe(0);
  });
});

describe("computeCustomerRisk — overdue thresholds", () => {
  it("escalates to level 3 at 30 days overdue", () => {
    const r = computeCustomerRisk("Acme", [makeInvoice({ daysOverdue: 35 })]);
    expect(r.level).toBe(3);
  });

  it("escalates to level 4 at 60 days overdue", () => {
    const r = computeCustomerRisk("Acme", [makeInvoice({ daysOverdue: 65 })]);
    expect(r.level).toBe(4);
  });

  it("escalates to level 5 at 90 days overdue", () => {
    const r = computeCustomerRisk("Acme", [makeInvoice({ daysOverdue: 95 })]);
    expect(r.level).toBe(5);
    expect(r.label).toBe("Critical");
  });
});

describe("computeCustomerRisk — broken promises (dominant signal)", () => {
  it("level 4 for 1 broken promise (even with otherwise OK record)", () => {
    const r = computeCustomerRisk("Acme", [
      makeInvoice({
        daysOverdue: 5,
        promisedPaymentDate: pastDate, // promise date in past + still overdue
      }),
    ]);
    expect(r.level).toBe(4);
    expect(r.reason).toMatch(/1 broken promise/i);
  });

  it("level 5 for 2+ broken promises", () => {
    const r = computeCustomerRisk("Acme", [
      makeInvoice({ daysOverdue: 5,  promisedPaymentDate: pastDate }),
      makeInvoice({ daysOverdue: 10, promisedPaymentDate: pastDate }),
    ]);
    expect(r.level).toBe(5);
    expect(r.reason).toMatch(/broken promises/i);
  });

  it("does NOT count future-dated promises as broken", () => {
    const r = computeCustomerRisk("Acme", [
      makeInvoice({ daysOverdue: 10, promisedPaymentDate: futureDate }),
    ]);
    expect(r.stats.brokenPromises).toBe(0);
  });
});

describe("computeCustomerRisk — chase count", () => {
  it("level 3 at 3 chases", () => {
    const r = computeCustomerRisk("Acme", [
      makeInvoice({ daysOverdue: 10, chaseCount: 3 }),
    ]);
    expect(r.level).toBe(3);
  });

  it("level 4 at 5+ chases", () => {
    const r = computeCustomerRisk("Acme", [
      makeInvoice({ daysOverdue: 10, chaseCount: 6 }),
    ]);
    expect(r.level).toBe(4);
  });

  it("accepts previousChaseCount (zentra schema) as a fallback", () => {
    const r = computeCustomerRisk("Acme", [
      { ...makeInvoice({ daysOverdue: 10 }), chaseCount: undefined, previousChaseCount: 5 },
    ]);
    expect(r.stats.totalChaseCount).toBe(5);
  });
});

describe("computeCustomerRisk — problematic payer tag", () => {
  it("escalates to level 4 when any invoice has relationshipType=problematic payer", () => {
    const r = computeCustomerRisk("Acme", [
      makeInvoice({ relationshipType: "problematic payer" }),
    ]);
    expect(r.level).toBe(4);
    expect(r.reason).toMatch(/problematic payer/i);
  });
});

describe("computeCustomerRisk — disputed invoices", () => {
  it("escalates to level 3 with one disputed invoice", () => {
    const r = computeCustomerRisk("Acme", [
      makeInvoice({ status: "Disputed" }),
    ]);
    expect(r.level).toBe(3);
    expect(r.stats.disputedInvoices).toBe(1);
  });

  it("case-insensitive — works for zentra lowercase status", () => {
    const r = computeCustomerRisk("Acme", [
      makeInvoice({ status: "disputed" }),
    ]);
    expect(r.stats.disputedInvoices).toBe(1);
  });
});

describe("computeCustomerRisk — worst signal wins", () => {
  it("90+ days overdue beats a 1-broken-promise signal", () => {
    const r = computeCustomerRisk("Acme", [
      makeInvoice({ daysOverdue: 100, promisedPaymentDate: pastDate }),
    ]);
    expect(r.level).toBe(5);
  });

  it("never returns level > 5", () => {
    const r = computeCustomerRisk("Acme", [
      makeInvoice({
        daysOverdue: 365,
        chaseCount: 50,
        promisedPaymentDate: pastDate,
        relationshipType: "problematic payer",
      }),
      makeInvoice({ daysOverdue: 200, promisedPaymentDate: pastDate, status: "Disputed" }),
    ]);
    expect(r.level).toBe(5);
  });
});

describe("computeCustomerRisk — stats", () => {
  it("computes totalOutstanding from open invoices only (not paid)", () => {
    const r = computeCustomerRisk("Acme", [
      makeInvoice({ amount: 1000, status: "Overdue" }),
      makeInvoice({ amount: 500,  status: "Paid"    }),
      makeInvoice({ amount: 300,  status: "Disputed" }),
    ]);
    expect(r.stats.totalOutstanding).toBe(1300);
  });

  it("excludes negative daysOverdue from averageDaysOverdue", () => {
    const r = computeCustomerRisk("Acme", [
      makeInvoice({ daysOverdue: -5 }),
      makeInvoice({ daysOverdue: 30 }),
    ]);
    expect(r.stats.averageDaysOverdue).toBe(15); // (0 + 30) / 2
  });
});

describe("computeCustomerRiskMap", () => {
  it("groups invoices by customer name", () => {
    const map = computeCustomerRiskMap([
      makeInvoice({ customerName: "Acme",       daysOverdue: 100 }),
      makeInvoice({ customerName: "BluePeak",   daysOverdue: 5   }),
      makeInvoice({ customerName: "Acme",       daysOverdue: 50  }),
    ]);
    expect(map.size).toBe(2);
    expect(map.get("Acme")?.level).toBe(5);
    expect(map.get("BluePeak")?.level).toBe(1);
  });
});
