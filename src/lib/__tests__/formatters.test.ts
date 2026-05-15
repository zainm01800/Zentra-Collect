import { describe, it, expect } from "vitest";
import { formatCurrency, formatDate, formatShortDate } from "../formatters";

describe("formatCurrency", () => {
  it("formats a round number as GBP with no decimals", () => {
    expect(formatCurrency(1250)).toBe("£1,250");
  });

  it("formats zero as £0", () => {
    expect(formatCurrency(0)).toBe("£0");
  });

  it("rounds down fractions (no decimal places)", () => {
    // Intl rounds to nearest integer — 1249.4 → £1,249, 1249.5 → £1,250
    expect(formatCurrency(1249)).toBe("£1,249");
  });

  it("formats large amounts with commas", () => {
    expect(formatCurrency(100000)).toBe("£100,000");
  });

  it("formats negative values with a minus sign", () => {
    expect(formatCurrency(-500)).toContain("500");
  });
});

describe("formatDate", () => {
  it("returns 'Not chased' for null", () => {
    expect(formatDate(null)).toBe("Not chased");
  });

  it("formats a date string in en-GB full format", () => {
    const result = formatDate("2026-05-15");
    // Expects something like "15 May 2026"
    expect(result).toMatch(/\d{1,2}\s\w+\s\d{4}/);
    expect(result).toContain("2026");
    expect(result).toContain("May");
  });

  it("formats a Date object", () => {
    const result = formatDate(new Date("2026-01-07"));
    expect(result).toContain("2026");
  });
});

describe("formatShortDate", () => {
  it("formats a date without the year", () => {
    const result = formatShortDate("2026-05-15");
    expect(result).toContain("May");
    expect(result).not.toContain("2026");
  });

  it("formats a Date object without the year", () => {
    const result = formatShortDate(new Date("2026-01-07"));
    expect(result).toContain("Jan");
    expect(result).not.toContain("2026");
  });
});
