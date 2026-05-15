/**
 * Tests for lib/dso.ts
 *
 * DSO is the headline AR metric that every bookkeeper will check first.
 * If we round wrong or pick the wrong window, the user notices instantly.
 */

import { describe, expect, it } from "vitest";
import { computeDSO, type InvoiceForDSO } from "@/lib/dso";

const NOW = new Date("2026-05-15T12:00:00.000Z").getTime();
const DAY = 24 * 60 * 60 * 1000;

function makeInvoice(overrides: Partial<InvoiceForDSO> = {}): InvoiceForDSO {
  return {
    amount: 1000,
    amountOutstanding: 1000,
    issueDate: new Date(NOW - 10 * DAY).toISOString(), // 10 days ago by default
    status: "Overdue",
    ...overrides,
  };
}

describe("computeDSO — empty input", () => {
  it("returns null DSOs and unknown trend for no invoices", () => {
    const r = computeDSO([], NOW);
    expect(r.currentDSO).toBeNull();
    expect(r.previousDSO).toBeNull();
    expect(r.deltaDays).toBeNull();
    expect(r.trend).toBe("unknown");
    expect(r.totalAR).toBe(0);
  });
});

describe("computeDSO — basic math", () => {
  it("returns 30d DSO when all AR equals one period of sales", () => {
    // £10k of AR, £10k sold last 30 days → DSO = 30
    const r = computeDSO(
      [
        makeInvoice({ amount: 10000, amountOutstanding: 10000, issueDate: new Date(NOW - 15 * DAY).toISOString() }),
      ],
      NOW,
    );
    expect(r.currentDSO).toBe(30);
  });

  it("returns 60d DSO when AR is double the period's sales", () => {
    // £10k still outstanding from 90 days ago (in AR but not in current sales)
    // + £10k sold this period (in both AR and current sales)
    // → totalAR = £20k, salesPeriod = £10k → DSO = (20000/10000)*30 = 60
    const r = computeDSO(
      [
        makeInvoice({ amount: 10000, amountOutstanding: 10000, issueDate: new Date(NOW - 90 * DAY).toISOString() }),
        makeInvoice({ amount: 10000, amountOutstanding: 10000, issueDate: new Date(NOW - 15 * DAY).toISOString() }),
      ],
      NOW,
    );
    expect(r.currentDSO).toBe(60);
  });

  it("uses amount (not amountOutstanding) for sales total", () => {
    const r = computeDSO(
      [
        // Partial payment: £10k invoice, £4k still outstanding
        makeInvoice({ amount: 10000, amountOutstanding: 4000, issueDate: new Date(NOW - 5 * DAY).toISOString() }),
      ],
      NOW,
    );
    // DSO = (4000 / 10000) * 30 = 12
    expect(r.currentDSO).toBe(12);
  });

  it("excludes paid invoices from AR total", () => {
    const r = computeDSO(
      [
        makeInvoice({ amount: 5000, amountOutstanding: 5000, status: "Paid" }),
        makeInvoice({ amount: 5000, amountOutstanding: 5000, status: "Overdue" }),
      ],
      NOW,
    );
    expect(r.totalAR).toBe(5000);
  });

  it("includes paid invoice's amount in sales total when issued in window", () => {
    const r = computeDSO(
      [
        makeInvoice({ amount: 1000, amountOutstanding: 0, status: "Paid", issueDate: new Date(NOW - 5 * DAY).toISOString() }),
        makeInvoice({ amount: 1000, amountOutstanding: 1000, status: "Overdue", issueDate: new Date(NOW - 5 * DAY).toISOString() }),
      ],
      NOW,
    );
    // AR = 1000, Sales = 2000 → DSO = (1000/2000)*30 = 15
    expect(r.currentDSO).toBe(15);
  });
});

describe("computeDSO — windowing", () => {
  it("excludes invoices issued before the period from current-period sales", () => {
    const r = computeDSO(
      [
        // 100 days ago — not in current or previous window
        makeInvoice({ amount: 5000, issueDate: new Date(NOW - 100 * DAY).toISOString() }),
        // 5 days ago — in current window
        makeInvoice({ amount: 1000, issueDate: new Date(NOW - 5 * DAY).toISOString() }),
      ],
      NOW,
    );
    expect(r.salesPeriod).toBe(1000);
  });

  it("classifies a 45-day-old invoice into previous-period sales", () => {
    const r = computeDSO(
      [
        // Both in current period for AR; one is in current, one in previous for sales
        makeInvoice({ amount: 1000, amountOutstanding: 500, issueDate: new Date(NOW - 5  * DAY).toISOString() }),
        makeInvoice({ amount: 2000, amountOutstanding: 800, issueDate: new Date(NOW - 45 * DAY).toISOString() }),
      ],
      NOW,
    );
    expect(r.salesPeriod).toBe(1000); // current
    // Previous DSO uses same totalAR (= 500 + 800 = 1300) divided by previous sales (2000)
    // = (1300 / 2000) * 30 = 19.5
    expect(r.previousDSO).toBe(19.5);
  });
});

describe("computeDSO — trend classification", () => {
  it("marks 'improving' when current DSO is at least 1 day better", () => {
    // current AR / current sales < previous AR / previous sales
    // To get current DSO smaller: more current sales than previous sales with same AR
    const r = computeDSO(
      [
        makeInvoice({ amount: 10000, amountOutstanding: 1000, issueDate: new Date(NOW - 5 * DAY).toISOString() }),
        makeInvoice({ amount: 1000,  amountOutstanding: 1000, issueDate: new Date(NOW - 45 * DAY).toISOString() }),
      ],
      NOW,
    );
    // totalAR = 2000
    // current sales = 10000, previous sales = 1000
    // current DSO = (2000/10000)*30 = 6, previous DSO = (2000/1000)*30 = 60
    expect(r.trend).toBe("improving");
    expect(r.deltaDays).toBeLessThan(-1);
  });

  it("marks 'worsening' when current DSO is at least 1 day worse", () => {
    const r = computeDSO(
      [
        makeInvoice({ amount: 1000,  amountOutstanding: 1000, issueDate: new Date(NOW - 5 * DAY).toISOString() }),
        makeInvoice({ amount: 10000, amountOutstanding: 1000, issueDate: new Date(NOW - 45 * DAY).toISOString() }),
      ],
      NOW,
    );
    // current sales = 1000, previous sales = 10000, AR = 2000
    // current DSO = 60, previous DSO = 6
    expect(r.trend).toBe("worsening");
  });

  it("marks 'unknown' when previous period has no sales", () => {
    const r = computeDSO(
      [
        makeInvoice({ amount: 1000, issueDate: new Date(NOW - 5 * DAY).toISOString() }),
      ],
      NOW,
    );
    expect(r.previousDSO).toBeNull();
    expect(r.trend).toBe("unknown");
  });
});

describe("computeDSO — defensiveness", () => {
  it("ignores invoices with no date", () => {
    const r = computeDSO(
      [
        // @ts-expect-error — testing defensive behaviour
        { amount: 1000, amountOutstanding: 1000, status: "Overdue" },
      ],
      NOW,
    );
    expect(r.salesPeriod).toBe(0);
    expect(r.currentDSO).toBeNull();
  });

  it("ignores invoices with an unparseable date", () => {
    const r = computeDSO(
      [
        makeInvoice({ issueDate: "not-a-date" }),
      ],
      NOW,
    );
    expect(r.salesPeriod).toBe(0);
  });
});
