/**
 * Tests for lib/payment-patterns.ts
 */

import { describe, expect, it } from "vitest";
import {
  computePaymentPatterns,
  type InvoiceForPaymentPattern,
} from "@/lib/payment-patterns";

function paid(date: string): InvoiceForPaymentPattern {
  return { status: "paid", paidAt: date };
}

describe("computePaymentPatterns — not enough data", () => {
  it("returns hasEnoughData=false with under 5 paid invoices", () => {
    const r = computePaymentPatterns([
      paid("2026-05-04"), // Monday
      paid("2026-05-05"), // Tuesday
    ]);
    expect(r.hasEnoughData).toBe(false);
    expect(r.totalPaid).toBe(2);
    expect(r.topDay).toBeNull();
    expect(r.summary).toMatch(/2 paid invoices/);
  });

  it("ignores unpaid invoices in the count", () => {
    const r = computePaymentPatterns([
      paid("2026-05-04"),
      { status: "overdue", paidAt: "2026-05-04" },
      { status: "disputed", paidAt: "2026-05-04" },
    ]);
    expect(r.totalPaid).toBe(1);
  });
});

describe("computePaymentPatterns — pattern detection", () => {
  it("identifies the most common payment day", () => {
    const r = computePaymentPatterns([
      paid("2026-05-05"), // Tuesday
      paid("2026-05-12"), // Tuesday
      paid("2026-05-19"), // Tuesday
      paid("2026-05-04"), // Monday
      paid("2026-05-07"), // Thursday
    ]);
    expect(r.hasEnoughData).toBe(true);
    expect(r.totalPaid).toBe(5);
    expect(r.topDay).toBe("Tuesday");
    expect(r.topDayLiftVsAverage).toBeGreaterThan(0);
  });

  it("computes correct lift over average", () => {
    // 10 paid invoices, all Mondays → 100% on Monday, average is ~14.3%
    // lift = (1 - 1/7) / (1/7) = 6
    const r = computePaymentPatterns(
      Array.from({ length: 10 }, () => paid("2026-05-04")), // all Mondays
    );
    expect(r.topDay).toBe("Monday");
    expect(r.topDayLiftVsAverage).toBeCloseTo(6, 1);
  });

  it("falls back to lastChasedAt when paidAt is missing", () => {
    const r = computePaymentPatterns([
      { status: "paid", lastChasedAt: "2026-05-05" }, // Tuesday
      { status: "paid", lastChasedAt: "2026-05-12" }, // Tuesday
      { status: "paid", lastChasedAt: "2026-05-19" }, // Tuesday
      { status: "paid", lastChasedAt: "2026-05-26" }, // Tuesday
      { status: "paid", lastChasedAt: "2026-05-04" }, // Monday
    ]);
    expect(r.topDay).toBe("Tuesday");
  });
});

describe("computePaymentPatterns — output shape", () => {
  it("always returns 7 weekday buckets in Mon-Sun order", () => {
    const r = computePaymentPatterns([]);
    expect(r.byWeekday).toHaveLength(7);
    expect(r.byWeekday.map((b) => b.day)).toEqual([
      "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday",
    ]);
  });

  it("shares sum to ~1 when there are paid invoices", () => {
    const r = computePaymentPatterns([
      paid("2026-05-04"),
      paid("2026-05-05"),
      paid("2026-05-06"),
      paid("2026-05-07"),
      paid("2026-05-08"),
    ]);
    const total = r.byWeekday.reduce((s, b) => s + b.share, 0);
    expect(total).toBeCloseTo(1, 5);
  });

  it("provides actionable tip with chase day suggestion", () => {
    const r = computePaymentPatterns([
      paid("2026-05-05"), // Tuesday
      paid("2026-05-12"),
      paid("2026-05-19"),
      paid("2026-05-26"),
      paid("2026-06-02"),
    ]);
    expect(r.tip).toMatch(/Monday/);
    expect(r.tip).toMatch(/Tuesday/);
  });
});

describe("computePaymentPatterns — defensive", () => {
  it("ignores invoices with unparseable dates", () => {
    const r = computePaymentPatterns([
      paid("2026-05-04"),
      paid("not-a-date"),
      paid("2026-05-05"),
    ]);
    expect(r.totalPaid).toBe(2);
  });

  it("ignores invoices without any date", () => {
    const r = computePaymentPatterns([
      { status: "paid" },
      paid("2026-05-04"),
    ]);
    expect(r.totalPaid).toBe(1);
  });
});
