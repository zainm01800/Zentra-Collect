/**
 * Tests for lib/quotes.ts — VAT carry-through and status transitions.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createQuote,
  setQuoteStatus,
  markConverted,
  nextQuoteNumber,
  quoteGrossTotal,
  quoteNetTotal,
  quoteVatTotal,
} from "@/lib/quotes";

const STORAGE_KEY = "zentra.quotes.v1";

function installLocalStorage() {
  const store = new Map<string, string>();
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

describe("createQuote", () => {
  beforeEach(() => installLocalStorage());
  afterEach(() => uninstall());

  it("creates a draft quote with correct net/VAT/gross", () => {
    const q = createQuote({
      customerName: "Acme",
      issueDate:    "2026-04-10",
      amountNet:    200,
      vatRate:      20,
      description:  "Consulting",
    });
    expect(q.status).toBe("draft");
    expect(quoteNetTotal(q)).toBe(200);
    expect(quoteVatTotal(q)).toBe(40);
    expect(quoteGrossTotal(q)).toBe(240);
  });

  it("assigns QTE-001 as the first quote number", () => {
    expect(nextQuoteNumber()).toBe("QTE-001");
  });

  it("increments quote numbers sequentially", () => {
    createQuote({ customerName: "A", issueDate: "2026-04-10", amountNet: 100, vatRate: 0, description: "x" });
    createQuote({ customerName: "B", issueDate: "2026-04-10", amountNet: 100, vatRate: 0, description: "x" });
    expect(nextQuoteNumber()).toBe("QTE-003");
  });

  it("defaults description to 'Quote' when blank", () => {
    const q = createQuote({
      customerName: "A", issueDate: "2026-04-10",
      amountNet: 100, vatRate: 0, description: "   ",
    });
    expect(q.lineItems[0].description).toBe("Quote");
  });
});

describe("status transitions", () => {
  beforeEach(() => installLocalStorage());
  afterEach(() => uninstall());

  it("moves draft → sent → accepted", () => {
    const q = createQuote({
      customerName: "A", issueDate: "2026-04-10",
      amountNet: 100, vatRate: 0, description: "x",
    });
    const sent = setQuoteStatus(q.id, "sent");
    expect(sent?.status).toBe("sent");
    const accepted = setQuoteStatus(q.id, "accepted");
    expect(accepted?.status).toBe("accepted");
  });

  it("marks as converted with linked invoice id", () => {
    const q = createQuote({
      customerName: "A", issueDate: "2026-04-10",
      amountNet: 100, vatRate: 0, description: "x",
    });
    const converted = markConverted(q.id, "inv-123");
    expect(converted?.status).toBe("converted");
    expect(converted?.convertedToInvoiceId).toBe("inv-123");
  });

  it("returns null for unknown id", () => {
    expect(setQuoteStatus("nope", "sent")).toBeNull();
    expect(markConverted("nope", "inv-1")).toBeNull();
  });
});
