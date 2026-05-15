import { describe, it, expect } from "vitest";
import {
  calculateDaysOverdue,
  getCustomerOutstandingTotal,
  getCustomerOpenInvoiceCount,
  detectScenario,
  calculatePriorityScore,
  generateReason,
  rankCollectionActions,
} from "../decision-engine";
import type { Invoice, Customer } from "@/types/zentra";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const REF = "2026-05-07"; // same as DEFAULT_REFERENCE_DATE

function makeInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: "inv-001",
    customerId: "cust-001",
    customerName: "Acme Ltd",
    customerEmail: "ap@acme.com",
    invoiceNumber: "INV-001",
    invoiceDate: "2026-01-01",
    dueDate: "2026-02-01",
    amount: 2000,
    amountOutstanding: 2000,
    currency: "GBP",
    daysOverdue: 95,
    status: "overdue",
    previousChaseCount: 2,
    relationshipType: "regular customer",
    lastChasedDate: null,
    paymentClaimed: false,
    remittanceNeeded: false,
    statementNeeded: false,
    promisedPaymentDate: null,
    promiseToPay: null,
    dispute: null,
    activityHistory: [],     // required to avoid spread crash in hasMissingPoSignal
    customerNotes: null,
    disputeReason: null,
    ...overrides,
  } as Invoice;
}

function makeCustomer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: "cust-001",
    name: "Acme Ltd",
    apEmail: "ap@acme.com",
    doNotChase: false,
    relationshipType: "regular customer",
    ...overrides,
  } as Customer;
}

function makeContext(invoice: Invoice, overrides: Record<string, unknown> = {}) {
  return {
    customer: makeCustomer(),
    safetyChecks: [],
    daysSinceLastChase: null,
    customerOutstandingTotal: invoice.amountOutstanding,
    customerOpenInvoiceCount: 1,
    referenceDate: REF,
    ...overrides,
  };
}

// ── calculateDaysOverdue ──────────────────────────────────────────────────────

describe("calculateDaysOverdue", () => {
  it("returns 0 when no due date", () => {
    expect(calculateDaysOverdue(undefined, REF)).toBe(0);
  });

  it("returns 0 for a due date in the future", () => {
    expect(calculateDaysOverdue("2026-06-01", REF)).toBe(0);
  });

  it("calculates correct days for a past due date", () => {
    // Due 2026-02-01, reference 2026-05-07 = 95 days
    expect(calculateDaysOverdue("2026-02-01", REF)).toBe(95);
  });

  it("returns 0 for due date equal to reference date", () => {
    expect(calculateDaysOverdue(REF, REF)).toBe(0);
  });
});

// ── getCustomerOutstandingTotal ───────────────────────────────────────────────

describe("getCustomerOutstandingTotal", () => {
  it("sums outstanding across multiple invoices for same customer", () => {
    const invoices = [
      makeInvoice({ id: "a", customerId: "c1", amountOutstanding: 1000 }),
      makeInvoice({ id: "b", customerId: "c1", amountOutstanding: 500 }),
      makeInvoice({ id: "c", customerId: "c2", amountOutstanding: 9999 }),
    ];
    expect(getCustomerOutstandingTotal(invoices, "c1")).toBe(1500);
  });

  it("returns 0 for customer with no invoices", () => {
    expect(getCustomerOutstandingTotal([], "c1")).toBe(0);
  });
});

// ── getCustomerOpenInvoiceCount ───────────────────────────────────────────────

describe("getCustomerOpenInvoiceCount", () => {
  it("counts only invoices with outstanding balance", () => {
    const invoices = [
      makeInvoice({ id: "a", customerId: "c1", amountOutstanding: 500 }),
      makeInvoice({ id: "b", customerId: "c1", amountOutstanding: 0 }),   // paid
      makeInvoice({ id: "c", customerId: "c1", amountOutstanding: 1000 }),
    ];
    expect(getCustomerOpenInvoiceCount(invoices, "c1")).toBe(2);
  });

  it("returns 0 when all invoices are paid", () => {
    const invoices = [
      makeInvoice({ id: "a", customerId: "c1", amountOutstanding: 0 }),
    ];
    expect(getCustomerOpenInvoiceCount(invoices, "c1")).toBe(0);
  });
});

// ── detectScenario ────────────────────────────────────────────────────────────

describe("detectScenario", () => {
  it("returns DO_NOT_CHASE for paid invoices", () => {
    const inv = makeInvoice({ status: "paid", amountOutstanding: 0 });
    expect(detectScenario(inv, makeContext(inv))).toBe("DO_NOT_CHASE");
  });

  it("returns DO_NOT_CHASE when customer is marked do-not-chase", () => {
    const inv = makeInvoice();
    const ctx = makeContext(inv, { customer: makeCustomer({ doNotChase: true }) });
    expect(detectScenario(inv, ctx)).toBe("DO_NOT_CHASE");
  });

  it("returns ASK_FOR_AP_CONTACT when no email on invoice or customer", () => {
    const inv = makeInvoice({ customerEmail: null });
    const ctx = makeContext(inv, { customer: makeCustomer({ apEmail: null }) });
    expect(detectScenario(inv, ctx)).toBe("ASK_FOR_AP_CONTACT");
  });

  it("returns DISPUTE_RESPONSE for disputed invoices", () => {
    const inv = makeInvoice({ status: "disputed" });
    expect(detectScenario(inv, makeContext(inv))).toBe("DISPUTE_RESPONSE");
  });

  it("returns WAIT for invoice not yet overdue", () => {
    const inv = makeInvoice({ daysOverdue: 0, status: "overdue" });
    // Also no promise, not recently chased
    expect(detectScenario(inv, makeContext(inv))).toBe("WAIT");
  });

  it("returns PROMISE_TO_PAY_FOLLOW_UP for missed promise", () => {
    const inv = makeInvoice({ status: "missed_promise" });
    expect(detectScenario(inv, makeContext(inv))).toBe("PROMISE_TO_PAY_FOLLOW_UP");
  });

  it("returns STATEMENT_OF_ACCOUNT when customer has 3+ open invoices", () => {
    const inv = makeInvoice({ daysOverdue: 30 });
    const ctx = makeContext(inv, { customerOpenInvoiceCount: 3 });
    expect(detectScenario(inv, ctx)).toBe("STATEMENT_OF_ACCOUNT");
  });

  it("returns PAYMENT_REMINDER for a standard overdue invoice", () => {
    const inv = makeInvoice({ daysOverdue: 30, status: "overdue" });
    expect(detectScenario(inv, makeContext(inv))).toBe("PAYMENT_REMINDER");
  });

  it("returns WAIT when chased within the last 2 days", () => {
    const inv = makeInvoice({ daysOverdue: 30, status: "overdue" });
    const ctx = makeContext(inv, { daysSinceLastChase: 1 });
    expect(detectScenario(inv, ctx)).toBe("WAIT");
  });
});

// ── calculatePriorityScore ────────────────────────────────────────────────────

describe("calculatePriorityScore", () => {
  it("returns 0 for DO_NOT_CHASE scenario", () => {
    const inv = makeInvoice({ status: "paid", amountOutstanding: 0 });
    expect(calculatePriorityScore(inv, "DO_NOT_CHASE", makeContext(inv))).toBe(0);
  });

  it("returns higher score for higher daysOverdue", () => {
    // Use matching dueDate so calculateDaysOverdue(dueDate, REF) also differs
    const low  = makeInvoice({ daysOverdue: 5,  dueDate: "2026-05-02", amountOutstanding: 1000 });
    const high = makeInvoice({ daysOverdue: 90, dueDate: "2026-02-06", amountOutstanding: 1000 });
    const scoreL = calculatePriorityScore(low,  "PAYMENT_REMINDER", makeContext(low));
    const scoreH = calculatePriorityScore(high, "PAYMENT_REMINDER", makeContext(high));
    expect(scoreH).toBeGreaterThan(scoreL);
  });

  it("returns higher score for higher amount", () => {
    const small = makeInvoice({ daysOverdue: 30, amountOutstanding: 200 });
    const large = makeInvoice({ daysOverdue: 30, amountOutstanding: 10000 });
    const ctx = (inv: Invoice) => makeContext(inv, { customerOutstandingTotal: inv.amountOutstanding });
    expect(calculatePriorityScore(large, "PAYMENT_REMINDER", ctx(large)))
      .toBeGreaterThan(calculatePriorityScore(small, "PAYMENT_REMINDER", ctx(small)));
  });

  it("PROMISE_TO_PAY_FOLLOW_UP scenario adds significant score boost", () => {
    const inv = makeInvoice({ daysOverdue: 30, amountOutstanding: 1000 });
    const reminder = calculatePriorityScore(inv, "PAYMENT_REMINDER", makeContext(inv));
    const promise  = calculatePriorityScore(inv, "PROMISE_TO_PAY_FOLLOW_UP", makeContext(inv));
    expect(promise).toBeGreaterThan(reminder);
  });

  it("WAIT scenario reduces score significantly", () => {
    const inv = makeInvoice({ daysOverdue: 30, amountOutstanding: 1000 });
    const reminder = calculatePriorityScore(inv, "PAYMENT_REMINDER", makeContext(inv));
    const wait     = calculatePriorityScore(inv, "WAIT", makeContext(inv));
    expect(wait).toBeLessThan(reminder);
  });

  it("score is always between 0 and 100", () => {
    const inv = makeInvoice({ daysOverdue: 200, amountOutstanding: 99999, previousChaseCount: 100 });
    const score = calculatePriorityScore(inv, "PAYMENT_REMINDER", makeContext(inv));
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });
});

// ── generateReason ────────────────────────────────────────────────────────────

describe("generateReason", () => {
  it("includes the outstanding amount", () => {
    const inv = makeInvoice({ amountOutstanding: 2500, daysOverdue: 30 });
    const reason = generateReason(inv, "PAYMENT_REMINDER", makeContext(inv));
    expect(reason).toContain("2,500");
  });

  it("includes days overdue when > 0", () => {
    const inv = makeInvoice({ daysOverdue: 45 });
    const reason = generateReason(inv, "PAYMENT_REMINDER", makeContext(inv));
    expect(reason).toContain("45");
  });

  it("mentions previous chases when > 0", () => {
    const inv = makeInvoice({ previousChaseCount: 3 });
    const reason = generateReason(inv, "PAYMENT_REMINDER", makeContext(inv));
    expect(reason).toContain("3 previous chases");
  });

  it("returns a non-empty string for all scenarios", () => {
    const scenarios = [
      "PAYMENT_REMINDER", "DISPUTE_RESPONSE", "DO_NOT_CHASE",
      "WAIT", "STATEMENT_OF_ACCOUNT", "PROMISE_TO_PAY_FOLLOW_UP",
    ] as const;
    const inv = makeInvoice();
    for (const scenario of scenarios) {
      const reason = generateReason(inv, scenario, makeContext(inv));
      expect(reason.length, `Empty reason for scenario ${scenario}`).toBeGreaterThan(0);
    }
  });
});

// ── rankCollectionActions ─────────────────────────────────────────────────────

describe("rankCollectionActions", () => {
  it("returns an empty array for no invoices", () => {
    const result = rankCollectionActions({ invoices: [], customers: [], referenceDate: REF });
    expect(result).toHaveLength(0);
  });

  it("ranks higher-overdue invoice above lower-overdue invoice", () => {
    const invoices = [
      makeInvoice({ id: "low",  customerId: "c1", daysOverdue: 5,  dueDate: "2026-05-02", amountOutstanding: 1000 }),
      makeInvoice({ id: "high", customerId: "c2", daysOverdue: 90, dueDate: "2026-02-06", amountOutstanding: 1000 }),
    ];
    const customers = [
      makeCustomer({ id: "c1", name: "Low Risk Co" }),
      makeCustomer({ id: "c2", name: "High Risk Co" }),
    ];
    const result = rankCollectionActions({ invoices, customers, referenceDate: REF });
    expect(result[0].invoiceId).toBe("high");
    expect(result[1].invoiceId).toBe("low");
  });

  it("ranks missed-promise invoices very high", () => {
    const invoices = [
      makeInvoice({ id: "normal",  customerId: "c1", daysOverdue: 60, amountOutstanding: 5000, status: "overdue" }),
      makeInvoice({ id: "promise", customerId: "c2", daysOverdue: 10, amountOutstanding: 1000, status: "missed_promise" }),
    ];
    const customers = [
      makeCustomer({ id: "c1" }),
      makeCustomer({ id: "c2", name: "Promise Co" }),
    ];
    const result = rankCollectionActions({ invoices, customers, referenceDate: REF });
    // missed_promise gets a +22 boost — should outrank the higher-overdue invoice
    expect(result[0].invoiceId).toBe("promise");
  });

  it("excludes paid invoices from the top of the plan (DO_NOT_CHASE)", () => {
    const invoices = [
      makeInvoice({ id: "paid",   customerId: "c1", status: "paid", amountOutstanding: 0 }),
      makeInvoice({ id: "active", customerId: "c2", daysOverdue: 30, amountOutstanding: 2000 }),
    ];
    const customers = [makeCustomer({ id: "c1" }), makeCustomer({ id: "c2", name: "Active Co" })];
    const result = rankCollectionActions({ invoices, customers, referenceDate: REF });
    // The paid invoice should be at the end (score 0)
    expect(result[0].invoiceId).toBe("active");
  });

  it("each result has an action, reason, and priorityScore", () => {
    const invoices = [makeInvoice()];
    const customers = [makeCustomer()];
    const [item] = rankCollectionActions({ invoices, customers, referenceDate: REF });
    expect(item.recommendedAction).toBeTruthy();
    expect(item.reason).toBeTruthy();
    expect(typeof item.priorityScore).toBe("number");
    expect(item.priorityScore).toBeGreaterThanOrEqual(0);
    expect(item.priorityScore).toBeLessThanOrEqual(100);
  });
});
