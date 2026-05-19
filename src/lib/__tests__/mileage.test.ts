/**
 * Tests for lib/mileage.ts
 *
 * HMRC AMAP: 45p/mile up to 10,000 then 25p/mile. If we get the band
 * split wrong, the user's Self-Assessment number is wrong — so we test
 * the boundary explicitly.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  calcMileageAllowance,
  HMRC_FIRST_BAND_LIMIT,
  HMRC_RATE_AFTER_10K,
  HMRC_RATE_FIRST_10K,
  totalMileageAllowance,
  type MileageTrip,
} from "@/lib/mileage";

const STORAGE_KEY = "zentra.mileage.v1";

function installLocalStorage(initial: MileageTrip[] = []) {
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

function uninstallLocalStorage() {
  delete (globalThis as unknown as { window?: unknown }).window;
}

describe("calcMileageAllowance — pure", () => {
  it("returns 0 for 0 miles", () => {
    expect(calcMileageAllowance(0).allowance).toBe(0);
  });

  it("clamps negative miles to 0", () => {
    expect(calcMileageAllowance(-50).allowance).toBe(0);
  });

  it("uses 45p for miles within the first band", () => {
    const r = calcMileageAllowance(100);
    expect(r.firstBandMiles).toBe(100);
    expect(r.secondBandMiles).toBe(0);
    expect(r.allowance).toBe(45);
  });

  it("splits exactly at the 10,000 mile boundary", () => {
    const r = calcMileageAllowance(HMRC_FIRST_BAND_LIMIT);
    expect(r.firstBandMiles).toBe(10_000);
    expect(r.secondBandMiles).toBe(0);
    expect(r.allowance).toBe(10_000 * HMRC_RATE_FIRST_10K);
  });

  it("uses 25p for the portion beyond 10,000 miles", () => {
    const r = calcMileageAllowance(12_000);
    expect(r.firstBandMiles).toBe(10_000);
    expect(r.secondBandMiles).toBe(2_000);
    // 10000*0.45 + 2000*0.25 = 4500 + 500 = 5000
    expect(r.allowance).toBe(5000);
  });

  it("handles very high mileage without overflow", () => {
    const r = calcMileageAllowance(100_000);
    expect(r.firstBandMiles).toBe(10_000);
    expect(r.secondBandMiles).toBe(90_000);
    // 4500 + 22500 = 27000
    expect(r.allowance).toBe(27_000);
  });

  it("rounds to 2dp", () => {
    const r = calcMileageAllowance(123.456);
    expect(Number.isInteger(r.allowance * 100)).toBe(true);
  });
});

describe("totalMileageAllowance — date filtering", () => {
  beforeEach(() => uninstallLocalStorage());
  afterEach(() => uninstallLocalStorage());

  it("returns 0 with no trips", () => {
    installLocalStorage([]);
    expect(totalMileageAllowance()).toBe(0);
  });

  it("sums all trips when no range provided", () => {
    installLocalStorage([
      { id: "1", date: "2026-04-10", miles: 100, purpose: "x", createdAt: "" },
      { id: "2", date: "2026-04-11", miles: 200, purpose: "y", createdAt: "" },
    ]);
    expect(totalMileageAllowance()).toBe(135); // 300 * 0.45
  });

  it("excludes trips outside the date range", () => {
    installLocalStorage([
      { id: "1", date: "2025-01-01", miles: 1000, purpose: "old", createdAt: "" },
      { id: "2", date: "2026-04-10", miles: 100, purpose: "in",  createdAt: "" },
    ]);
    const r = totalMileageAllowance({
      from: new Date("2026-04-06"),
      to:   new Date("2027-04-05"),
    });
    expect(r).toBe(45);
  });

  it("applies the 10k band split across summed trips", () => {
    installLocalStorage([
      { id: "1", date: "2026-04-10", miles: 9_000, purpose: "a", createdAt: "" },
      { id: "2", date: "2026-04-11", miles: 3_000, purpose: "b", createdAt: "" },
    ]);
    // 12000 total: 10000*0.45 + 2000*0.25 = 5000
    expect(totalMileageAllowance()).toBe(5000);
  });
});
