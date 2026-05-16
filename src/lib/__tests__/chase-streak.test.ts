/**
 * Tests for lib/chase-streak.ts — streak math only.
 *
 * Skips the localStorage I/O paths since vitest runs in Node and doesn't
 * have a window object; readStreakSnapshot()/recordOutcome() are covered
 * by manual browser verification.
 */

import { describe, expect, it } from "vitest";
import {
  calculateCurrentStreak,
  calculateLastSevenDays,
} from "@/lib/chase-streak";

function dateKey(daysAgo: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

describe("calculateCurrentStreak", () => {
  it("returns 0 for empty data", () => {
    expect(calculateCurrentStreak({})).toBe(0);
  });

  it("returns 1 when only today has activity", () => {
    expect(calculateCurrentStreak({ [dateKey(0)]: 1 })).toBe(1);
  });

  it("counts consecutive days back from today", () => {
    const daily = {
      [dateKey(0)]: 2,
      [dateKey(1)]: 1,
      [dateKey(2)]: 3,
      [dateKey(3)]: 1,
    };
    expect(calculateCurrentStreak(daily)).toBe(4);
  });

  it("stops counting at the first gap", () => {
    const daily = {
      [dateKey(0)]: 1,
      [dateKey(1)]: 1,
      // gap at day 2
      [dateKey(3)]: 1,
      [dateKey(4)]: 1,
    };
    expect(calculateCurrentStreak(daily)).toBe(2);
  });

  it("ignores days with zero count even if key exists", () => {
    const daily = {
      [dateKey(0)]: 1,
      [dateKey(1)]: 0, // explicit zero — same as a gap
      [dateKey(2)]: 1,
    };
    expect(calculateCurrentStreak(daily)).toBe(1);
  });
});

describe("calculateLastSevenDays", () => {
  it("returns 0 for empty data", () => {
    expect(calculateLastSevenDays({})).toBe(0);
  });

  it("sums outcomes across the last 7 days inclusive", () => {
    const daily: Record<string, number> = {};
    for (let i = 0; i < 7; i++) daily[dateKey(i)] = i + 1; // 1+2+3+4+5+6+7 = 28
    expect(calculateLastSevenDays(daily)).toBe(28);
  });

  it("ignores days older than 7", () => {
    const daily = {
      [dateKey(0)]: 1,
      [dateKey(6)]: 1,
      [dateKey(7)]: 99,  // outside the window
      [dateKey(30)]: 99, // way outside
    };
    expect(calculateLastSevenDays(daily)).toBe(2);
  });
});
