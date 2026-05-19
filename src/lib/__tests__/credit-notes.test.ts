/**
 * Tests for lib/credit-notes.ts
 *
 * Credit notes reduce taxable income AND output VAT. Both calcs feed
 * the headline Tax & VAT estimate — if VAT reversal is wrong the user
 * underclaims or overclaims VAT, which HMRC notices.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createCreditNote,
  totalCreditedNet,
  totalCreditedVat,
  type CreditNote,
} from "@/lib/credit-notes";

const STORAGE_KEY = "zentra.creditNotes.v1";

function installLocalStorage(initial: CreditNote[] = []) {
  const store = new Map<string, string>();
  if (initial.length) store.set(STORAGE_KEY, JSON.stringify(initial));
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

describe("createCreditNote — VAT maths", () => {
  beforeEach(() => installLocalStorage());
  afterEach(() => uninstall());

  it("computes 20% VAT correctly", () => {
    const cn = createCreditNote({
      customerName: "Acme",
      issueDate:    "2026-04-10",
      reason:       "Refund",
      amountNet:    100,
      vatRate:      20,
    });
    expect(cn.amountNet).toBe(100);
    expect(cn.vatAmount).toBe(20);
    expect(cn.amountGross).toBe(120);
  });

  it("handles 5% reduced rate", () => {
    const cn = createCreditNote({
      customerName: "Acme",
      issueDate:    "2026-04-10",
      reason:       "x",
      amountNet:    200,
      vatRate:      5,
    });
    expect(cn.vatAmount).toBe(10);
    expect(cn.amountGross).toBe(210);
  });

  it("handles 0% VAT (non-VAT-registered)", () => {
    const cn = createCreditNote({
      customerName: "Acme",
      issueDate:    "2026-04-10",
      reason:       "x",
      amountNet:    100,
      vatRate:      0,
    });
    expect(cn.vatAmount).toBe(0);
    expect(cn.amountGross).toBe(100);
  });

  it("rounds VAT to pennies", () => {
    const cn = createCreditNote({
      customerName: "Acme",
      issueDate:    "2026-04-10",
      reason:       "x",
      amountNet:    33.33,
      vatRate:      20,
    });
    expect(cn.vatAmount).toBe(6.67); // 6.666 rounds up
  });

  it("clamps negative net to 0", () => {
    const cn = createCreditNote({
      customerName: "Acme",
      issueDate:    "2026-04-10",
      reason:       "x",
      amountNet:    -50,
      vatRate:      20,
    });
    expect(cn.amountNet).toBe(0);
  });

  it("assigns sequential CN numbers", () => {
    createCreditNote({ customerName: "A", issueDate: "2026-04-10", reason: "x", amountNet: 10, vatRate: 0 });
    const second = createCreditNote({ customerName: "B", issueDate: "2026-04-10", reason: "x", amountNet: 10, vatRate: 0 });
    expect(second.creditNoteNumber).toBe("CN-002");
  });
});

describe("totalCreditedNet / totalCreditedVat — date filtering", () => {
  beforeEach(() => uninstall());
  afterEach(() => uninstall());

  const fixture: CreditNote[] = [
    {
      id: "1", creditNoteNumber: "CN-001", customerName: "Acme",
      issueDate: "2026-04-10", reason: "x",
      amountNet: 100, vatRate: 20, vatAmount: 20, amountGross: 120,
      createdAt: "2026-04-10T00:00:00Z",
    },
    {
      id: "2", creditNoteNumber: "CN-002", customerName: "Acme",
      issueDate: "2025-01-01", reason: "old",
      amountNet: 999, vatRate: 20, vatAmount: 199.8, amountGross: 1198.8,
      createdAt: "2025-01-01T00:00:00Z",
    },
  ];

  it("sums all when no range", () => {
    installLocalStorage(fixture);
    expect(totalCreditedNet()).toBe(1099);
  });

  it("filters to a tax year", () => {
    installLocalStorage(fixture);
    const range = { from: new Date("2026-04-06"), to: new Date("2027-04-05") };
    expect(totalCreditedNet(range)).toBe(100);
    expect(totalCreditedVat(range)).toBe(20);
  });

  it("returns 0 when no credit notes", () => {
    installLocalStorage([]);
    expect(totalCreditedNet()).toBe(0);
    expect(totalCreditedVat()).toBe(0);
  });
});
