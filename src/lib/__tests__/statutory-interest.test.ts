/**
 * Tests for lib/statutory-interest.ts
 *
 * Critical: this calculator is shown to users with monetary figures attached.
 * Math errors here would be a credibility-destroying bug. Tests cover the
 * three compensation tiers, edge cases, and the 12.5% annual rate.
 */

import { describe, expect, it } from "vitest";
import {
  BOE_BASE_RATE,
  STATUTORY_INTEREST_RATE,
  calculateStatutoryInterest,
  interestPhraseForChase,
  isInterestMaterial,
  statutoryCompensation,
} from "@/lib/statutory-interest";

describe("statutory-interest constants", () => {
  it("derives the statutory rate as BoE base + 8%", () => {
    expect(STATUTORY_INTEREST_RATE).toBe(BOE_BASE_RATE + 8);
  });

  it("BoE base rate is positive", () => {
    expect(BOE_BASE_RATE).toBeGreaterThan(0);
  });
});

describe("statutoryCompensation", () => {
  it("returns £40 for debts under £1,000", () => {
    expect(statutoryCompensation(0)).toBe(40);
    expect(statutoryCompensation(500)).toBe(40);
    expect(statutoryCompensation(999.99)).toBe(40);
  });

  it("returns £70 for debts between £1,000 and £9,999.99", () => {
    expect(statutoryCompensation(1000)).toBe(70);
    expect(statutoryCompensation(5000)).toBe(70);
    expect(statutoryCompensation(9999.99)).toBe(70);
  });

  it("returns £100 for debts £10,000 and above", () => {
    expect(statutoryCompensation(10000)).toBe(100);
    expect(statutoryCompensation(50000)).toBe(100);
    expect(statutoryCompensation(1_000_000)).toBe(100);
  });
});

describe("calculateStatutoryInterest", () => {
  it("computes a sensible figure for a typical 60-day-late B2B invoice", () => {
    // £5,000 owed, 60 days late → ~£102.74 interest at 12.5%/year
    const r = calculateStatutoryInterest(5000, 60);
    expect(r.interest).toBeCloseTo((5000 * STATUTORY_INTEREST_RATE / 100 / 365) * 60, 2);
    expect(r.compensation).toBe(70);
    expect(r.totalRecoverable).toBeCloseTo(5000 + r.interest + r.compensation, 2);
  });

  it("clamps negative debt amounts to 0 (no negative interest)", () => {
    const r = calculateStatutoryInterest(-1000, 30);
    expect(r.interest).toBe(0);
    expect(r.totalRecoverable).toBeGreaterThanOrEqual(0);
  });

  it("clamps negative days overdue to 0 interest (zero before due date)", () => {
    const r = calculateStatutoryInterest(5000, -5);
    expect(r.interest).toBe(0);
    expect(r.compensation).toBe(70); // compensation still applies once dispute exists
  });

  it("returns 0 interest at 0 days overdue (boundary)", () => {
    const r = calculateStatutoryInterest(5000, 0);
    expect(r.interest).toBe(0);
  });

  it("derives dailyRate from the annual rate", () => {
    const r = calculateStatutoryInterest(1000, 1);
    expect(r.dailyRate).toBeCloseTo(STATUTORY_INTEREST_RATE / 100 / 365, 10);
    expect(r.annualRate).toBe(STATUTORY_INTEREST_RATE);
  });

  it("scales linearly with days overdue", () => {
    const a = calculateStatutoryInterest(1000, 30);
    const b = calculateStatutoryInterest(1000, 60);
    expect(b.interest).toBeCloseTo(a.interest * 2, 2);
  });

  it("scales linearly with debt amount", () => {
    const a = calculateStatutoryInterest(1000, 30);
    const b = calculateStatutoryInterest(2000, 30);
    expect(b.interest).toBeCloseTo(a.interest * 2, 2);
  });
});

describe("isInterestMaterial", () => {
  it("is false for invoices that aren't overdue", () => {
    expect(isInterestMaterial(10000, 0)).toBe(false);
    expect(isInterestMaterial(10000, -5)).toBe(false);
  });

  it("is false for zero or negative debt", () => {
    expect(isInterestMaterial(0, 30)).toBe(false);
    expect(isInterestMaterial(-100, 30)).toBe(false);
  });

  it("is false when interest is below £5", () => {
    // £100 at 12.5% APR for 7 days = £100 * 0.125 / 365 * 7 ≈ £0.24
    expect(isInterestMaterial(100, 7)).toBe(false);
  });

  it("is true once interest crosses £5", () => {
    // £10,000 owed, 2 days late → £10,000 * 0.125 / 365 * 2 ≈ £6.85
    expect(isInterestMaterial(10000, 2)).toBe(true);
    // £5,000 owed, 4 days late → £5,000 * 0.125 / 365 * 4 ≈ £6.85
    expect(isInterestMaterial(5000, 4)).toBe(true);
  });
});

describe("interestPhraseForChase", () => {
  it("returns null when interest is not material", () => {
    expect(interestPhraseForChase(100, 0)).toBeNull();
    expect(interestPhraseForChase(0, 30)).toBeNull();
  });

  it("returns a phrase mentioning both interest and compensation", () => {
    const phrase = interestPhraseForChase(10000, 60);
    expect(phrase).not.toBeNull();
    expect(phrase).toMatch(/interest of/i);
    expect(phrase).toMatch(/compensation/i);
    expect(phrase).toMatch(/Late Payment of Commercial Debts/i);
  });

  it("formats currency with two decimals", () => {
    const phrase = interestPhraseForChase(10000, 60);
    expect(phrase).toMatch(/£\d+(,\d{3})*\.\d{2}/);
  });
});
