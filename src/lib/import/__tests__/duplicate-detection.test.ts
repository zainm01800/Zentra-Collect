/**
 * Tests for lib/import/duplicate-detection.ts
 */

import { describe, expect, it } from "vitest";
import {
  detectDuplicates,
  levenshtein,
  type InvoiceForDupeCheck,
} from "@/lib/import/duplicate-detection";

function inv(overrides: Partial<InvoiceForDupeCheck> = {}): InvoiceForDupeCheck {
  return {
    invoiceNumber: "INV-001",
    customerName:  "Acme Ltd",
    amount:        1000,
    invoiceDate:   "2026-05-01",
    ...overrides,
  };
}

describe("levenshtein", () => {
  it("returns 0 for identical strings (case-insensitive)", () => {
    expect(levenshtein("HELLO", "hello")).toBe(0);
  });
  it("returns 1 for a single substitution", () => {
    expect(levenshtein("INV-001", "INV-002")).toBe(1);
  });
  it("returns 2 for two-char transposition", () => {
    expect(levenshtein("INV-1234", "INV-1243")).toBe(2);
  });
  it("returns the length when one string is empty", () => {
    expect(levenshtein("", "abcd")).toBe(4);
    expect(levenshtein("xyz", "")).toBe(3);
  });
});

describe("detectDuplicates — rule 1: exact number, different customer", () => {
  it("flags as high confidence", () => {
    const warnings = detectDuplicates(
      [inv({ invoiceNumber: "INV-001", customerName: "New Customer" })],
      [inv({ invoiceNumber: "INV-001", customerName: "Old Customer" })],
    );
    expect(warnings).toHaveLength(1);
    expect(warnings[0].reason).toBe("exact_number_different_customer");
    expect(warnings[0].confidence).toBe("high");
  });

  it("does NOT flag when same invoice + same customer (that's just a re-import)", () => {
    const warnings = detectDuplicates(
      [inv({ invoiceNumber: "INV-001", customerName: "Acme Ltd" })],
      [inv({ invoiceNumber: "INV-001", customerName: "Acme Ltd" })],
    );
    expect(warnings).toHaveLength(0);
  });

  it("is case-insensitive on invoice numbers", () => {
    const warnings = detectDuplicates(
      [inv({ invoiceNumber: "inv-001", customerName: "Customer A" })],
      [inv({ invoiceNumber: "INV-001", customerName: "Customer B" })],
    );
    expect(warnings).toHaveLength(1);
  });
});

describe("detectDuplicates — rule 2: near-match number, same customer", () => {
  it("flags 1-char difference as medium confidence", () => {
    const warnings = detectDuplicates(
      [inv({ invoiceNumber: "INV-1234" })],
      [inv({ invoiceNumber: "INV-1244" })],
    );
    expect(warnings).toHaveLength(1);
    expect(warnings[0].reason).toBe("near_number_same_customer");
    expect(warnings[0].confidence).toBe("medium");
  });

  it("flags 2-char difference", () => {
    const warnings = detectDuplicates(
      [inv({ invoiceNumber: "INV-1234" })],
      [inv({ invoiceNumber: "INV-1243" })],
    );
    expect(warnings).toHaveLength(1);
  });

  it("does NOT flag 3+ char difference", () => {
    // Use different amount + date so rule 3 doesn't fire
    const warnings = detectDuplicates(
      [inv({ invoiceNumber: "INV-1234", amount: 500, invoiceDate: "2026-05-01" })],
      [inv({ invoiceNumber: "INV-9876", amount: 999, invoiceDate: "2026-04-01" })],
    );
    expect(warnings).toHaveLength(0);
  });

  it("does NOT flag very short invoice numbers (avoid false positives on '1' vs '2')", () => {
    // Use different amount + date so rule 3 doesn't fire
    const warnings = detectDuplicates(
      [inv({ invoiceNumber: "1", amount: 500, invoiceDate: "2026-05-01" })],
      [inv({ invoiceNumber: "2", amount: 999, invoiceDate: "2026-04-01" })],
    );
    expect(warnings).toHaveLength(0);
  });
});

describe("detectDuplicates — rule 3: same customer + same amount + close date", () => {
  it("flags when amounts match exactly and dates within 7 days", () => {
    const warnings = detectDuplicates(
      [inv({ invoiceNumber: "INV-NEW", amount: 1500, invoiceDate: "2026-05-05" })],
      [inv({ invoiceNumber: "INV-OLD", amount: 1500, invoiceDate: "2026-05-02" })],
    );
    expect(warnings).toHaveLength(1);
    expect(warnings[0].reason).toBe("same_customer_same_amount_close_date");
  });

  it("does NOT flag when amounts differ", () => {
    const warnings = detectDuplicates(
      [inv({ invoiceNumber: "INV-NEW", amount: 1500 })],
      [inv({ invoiceNumber: "INV-OLD", amount: 1501 })],
    );
    expect(warnings).toHaveLength(0);
  });

  it("does NOT flag when dates more than 7 days apart", () => {
    const warnings = detectDuplicates(
      [inv({ invoiceNumber: "INV-NEW", amount: 1500, invoiceDate: "2026-05-20" })],
      [inv({ invoiceNumber: "INV-OLD", amount: 1500, invoiceDate: "2026-05-01" })],
    );
    expect(warnings).toHaveLength(0);
  });

  it("uses issueDate as a fallback when invoiceDate missing", () => {
    const warnings = detectDuplicates(
      [{ invoiceNumber: "INV-NEW", customerName: "Acme", amount: 1500, issueDate: "2026-05-05" }],
      [{ invoiceNumber: "INV-OLD", customerName: "Acme", amount: 1500, issueDate: "2026-05-02" }],
    );
    expect(warnings).toHaveLength(1);
  });

  it("does NOT flag zero-amount invoices", () => {
    const warnings = detectDuplicates(
      [inv({ invoiceNumber: "INV-NEW", amount: 0, invoiceDate: "2026-05-05" })],
      [inv({ invoiceNumber: "INV-OLD", amount: 0, invoiceDate: "2026-05-02" })],
    );
    expect(warnings).toHaveLength(0);
  });
});

describe("detectDuplicates — priority + edge cases", () => {
  it("most-severe rule wins — exact-number-different-customer beats other matches", () => {
    const warnings = detectDuplicates(
      [inv({ invoiceNumber: "INV-001", customerName: "New", amount: 500 })],
      [
        inv({ invoiceNumber: "INV-001", customerName: "Old", amount: 999 }),
        inv({ invoiceNumber: "INV-002", customerName: "New", amount: 500, invoiceDate: "2026-05-01" }),
      ],
    );
    expect(warnings).toHaveLength(1);
    expect(warnings[0].reason).toBe("exact_number_different_customer");
  });

  it("handles empty inputs", () => {
    expect(detectDuplicates([], [])).toEqual([]);
    expect(detectDuplicates([inv()], [])).toEqual([]);
    expect(detectDuplicates([], [inv()])).toEqual([]);
  });
});
