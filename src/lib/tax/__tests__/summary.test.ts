/**
 * Tests for lib/tax/summary.ts
 *
 * This is the single source of truth for "what's the user's taxable
 * income / expenses this year". If it's wrong, the headline Tax & VAT
 * estimate is wrong — so we cover every input that feeds it:
 *   invoices · per-line VAT · direct income · mileage · credit notes
 * and the tax-year boundary (5 Apr vs 6 Apr).
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { totalsForTaxYear } from "@/lib/tax/summary";

interface KeyedJson { [k: string]: unknown }

function installLocalStorage(data: KeyedJson) {
  const store = new Map<string, string>();
  Object.entries(data).forEach(([k, v]) => store.set(k, JSON.stringify(v)));
  (globalThis as unknown as { window: unknown }).window = {
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => { store.set(k, v); },
      removeItem: (k: string) => { store.delete(k); },
    },
    dispatchEvent: () => true,
  };
}

function uninstall() { delete (globalThis as unknown as { window?: unknown }).window; }

const KEYS = {
  invoices:     "zentra.importedInvoices.v1",
  expenses:     "zentra.expenses.v1",
  directIncome: "zentra.directIncome.v1",
  mileage:      "zentra.mileage.v1",
  creditNotes:  "zentra.creditNotes.v1",
};

describe("totalsForTaxYear — empty inputs", () => {
  beforeEach(() => installLocalStorage({}));
  afterEach(() => uninstall());

  it("returns zero totals when nothing exists", () => {
    const t = totalsForTaxYear("2026/27");
    expect(t.income).toBe(0);
    expect(t.expenses).toBe(0);
    expect(t.vatCharged).toBe(0);
    expect(t.invoiceCount).toBe(0);
    expect(t.expenseCount).toBe(0);
  });

  it("returns the correct tax-year range strings", () => {
    const t = totalsForTaxYear("2026/27");
    expect(t.startIso).toBe("2026-04-06");
    expect(t.endIso).toBe("2027-04-05");
  });
});

describe("totalsForTaxYear — invoices and VAT", () => {
  afterEach(() => uninstall());

  it("counts invoices issued within the tax year", () => {
    installLocalStorage({
      [KEYS.invoices]: [
        { id: "i1", invoiceDate: "2026-04-10", amount: 120, lineItems: [{ amount: 100, vatAmount: 20 }] },
        { id: "i2", invoiceDate: "2026-08-15", amount: 240, lineItems: [{ amount: 200, vatAmount: 40 }] },
      ],
    });
    const t = totalsForTaxYear("2026/27");
    expect(t.income).toBe(360);
    expect(t.vatCharged).toBe(60);
    expect(t.invoiceCount).toBe(2);
  });

  it("excludes invoices outside the tax year", () => {
    installLocalStorage({
      [KEYS.invoices]: [
        { id: "i1", invoiceDate: "2025-04-10", amount: 999, lineItems: [] },
        { id: "i2", invoiceDate: "2026-04-10", amount: 100, lineItems: [] },
      ],
    });
    const t = totalsForTaxYear("2026/27");
    expect(t.income).toBe(100);
    expect(t.invoiceCount).toBe(1);
  });

  it("handles invoices without lineItems (older imports)", () => {
    installLocalStorage({
      [KEYS.invoices]: [{ id: "i1", invoiceDate: "2026-04-10", amount: 500 }],
    });
    const t = totalsForTaxYear("2026/27");
    expect(t.income).toBe(500);
    expect(t.vatCharged).toBe(0);
  });
});

describe("totalsForTaxYear — tax-year boundary", () => {
  afterEach(() => uninstall());

  it("treats 5 April as the LAST day of the prior tax year", () => {
    installLocalStorage({
      [KEYS.invoices]: [
        { id: "i1", invoiceDate: "2026-04-05", amount: 100, lineItems: [] },
      ],
    });
    const earlier = totalsForTaxYear("2025/26");
    const later   = totalsForTaxYear("2026/27");
    expect(earlier.income).toBe(100);
    expect(later.income).toBe(0);
  });

  it("treats 6 April as the FIRST day of the new tax year", () => {
    installLocalStorage({
      [KEYS.invoices]: [
        { id: "i1", invoiceDate: "2026-04-06", amount: 100, lineItems: [] },
      ],
    });
    const earlier = totalsForTaxYear("2025/26");
    const later   = totalsForTaxYear("2026/27");
    expect(earlier.income).toBe(0);
    expect(later.income).toBe(100);
  });
});

describe("totalsForTaxYear — direct income", () => {
  afterEach(() => uninstall());

  it("adds tagged bank-feed income to turnover", () => {
    installLocalStorage({
      [KEYS.invoices]:     [{ id: "i1", invoiceDate: "2026-04-10", amount: 500, lineItems: [] }],
      [KEYS.directIncome]: [
        { transactionId: "t1", amount: 150, date: "2026-05-01", description: "Lesson", category: "services", taggedAt: "" },
        { transactionId: "t2", amount: 50,  date: "2026-06-01", description: "Lesson", category: "services", taggedAt: "" },
      ],
    });
    expect(totalsForTaxYear("2026/27").income).toBe(700);
  });
});

describe("totalsForTaxYear — mileage allowance", () => {
  afterEach(() => uninstall());

  it("adds HMRC mileage allowance to expenses", () => {
    installLocalStorage({
      [KEYS.mileage]: [
        { id: "m1", date: "2026-04-10", miles: 100, purpose: "x", createdAt: "" },
      ],
    });
    // 100 miles × 0.45 = 45
    expect(totalsForTaxYear("2026/27").expenses).toBe(45);
  });

  it("splits at the 10k band correctly inside a tax year", () => {
    installLocalStorage({
      [KEYS.mileage]: [
        { id: "m1", date: "2026-04-10", miles: 12_000, purpose: "x", createdAt: "" },
      ],
    });
    // 10000 * 0.45 + 2000 * 0.25 = 5000
    expect(totalsForTaxYear("2026/27").expenses).toBe(5000);
  });
});

describe("totalsForTaxYear — credit notes", () => {
  afterEach(() => uninstall());

  it("reduces income by credit-note net", () => {
    installLocalStorage({
      [KEYS.invoices]:    [{ id: "i1", invoiceDate: "2026-04-10", amount: 1200, lineItems: [{ amount: 1000, vatAmount: 200 }] }],
      [KEYS.creditNotes]: [
        { id: "cn1", creditNoteNumber: "CN-001", customerName: "A", issueDate: "2026-05-01", reason: "refund",
          amountNet: 200, vatRate: 20, vatAmount: 40, amountGross: 240, createdAt: "2026-05-01" },
      ],
    });
    const t = totalsForTaxYear("2026/27");
    // income: 1200 - 200 = 1000; vatCharged: 200 - 40 = 160
    expect(t.income).toBe(1000);
    expect(t.vatCharged).toBe(160);
  });

  it("never lets income or vat go negative", () => {
    installLocalStorage({
      [KEYS.creditNotes]: [
        { id: "cn1", creditNoteNumber: "CN-001", customerName: "A", issueDate: "2026-05-01", reason: "x",
          amountNet: 999, vatRate: 20, vatAmount: 199.8, amountGross: 1198.8, createdAt: "" },
      ],
    });
    const t = totalsForTaxYear("2026/27");
    expect(t.income).toBe(0);
    expect(t.vatCharged).toBe(0);
  });
});

describe("totalsForTaxYear — expenses allowability filter", () => {
  afterEach(() => uninstall());

  it("excludes non-allowable and review expenses", () => {
    installLocalStorage({
      [KEYS.expenses]: [
        { date: "2026-04-10", amount: 50, allowability: "allowable" },
        { date: "2026-04-11", amount: 80, allowability: "not-allowable" },
        { date: "2026-04-12", amount: 70, allowability: "review" },
        { date: "2026-04-13", amount: 30 },  // undefined = allowed
      ],
    });
    const t = totalsForTaxYear("2026/27");
    expect(t.expenses).toBe(80); // 50 + 30
    expect(t.expenseCount).toBe(2);
  });
});
