/**
 * Chase streak tracker — local-only habit signal.
 *
 * Records the dates the user logs ≥1 chase outcome, then derives:
 *   - Current streak (consecutive days, ending today or yesterday)
 *   - Best streak ever
 *   - Outcomes logged this week
 *
 * Stored entirely in localStorage. Resets weekly counts on the user's local
 * Monday boundary. No server roundtrip.
 */

const STREAK_KEY = "zentra.chaseStreak.v1";

interface ChaseStreakData {
  /** Per-day count of outcomes logged. Keyed by YYYY-MM-DD. */
  daily: Record<string, number>;
  /** Lifetime best streak achieved. */
  bestStreak: number;
}

// ── Storage helpers ───────────────────────────────────────────────────────────

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function readData(): ChaseStreakData {
  if (typeof window === "undefined") return { daily: {}, bestStreak: 0 };
  const raw = window.localStorage.getItem(STREAK_KEY);
  if (!raw) return { daily: {}, bestStreak: 0 };
  try {
    const parsed = JSON.parse(raw) as ChaseStreakData;
    return {
      daily: parsed.daily ?? {},
      bestStreak: parsed.bestStreak ?? 0,
    };
  } catch {
    return { daily: {}, bestStreak: 0 };
  }
}

function writeData(data: ChaseStreakData) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STREAK_KEY, JSON.stringify(data));
  } catch { /* quota */ }
}

// ── Streak math ──────────────────────────────────────────────────────────────

function daysAgoKey(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

/**
 * Calculate the current consecutive-day streak.
 * Ends today OR yesterday (so you don't lose streak before midnight passes).
 */
export function calculateCurrentStreak(daily: Record<string, number>): number {
  let streak = 0;
  // Allow a single day of grace — check today, then walk backwards.
  // If today has activity, streak starts at 1 and walks back from yesterday.
  // If today is empty but yesterday has activity, streak starts at 0 and
  // walks back from yesterday (so the streak number reflects past days).
  const startsToday = (daily[todayKey()] ?? 0) > 0;
  let cursor = startsToday ? 0 : 1;
  if (startsToday) streak = 1;

  // Walk backwards day-by-day; stop when a day has no activity.
  for (;;) {
    cursor += 1;
    const key = daysAgoKey(cursor - (startsToday ? 0 : 0));
    if ((daily[key] ?? 0) > 0) {
      streak += 1;
    } else {
      break;
    }
    if (streak > 365) break; // safety cap
  }
  return streak;
}

/** Sum outcomes logged in the last 7 days (rolling, inclusive of today). */
export function calculateLastSevenDays(daily: Record<string, number>): number {
  let total = 0;
  for (let i = 0; i < 7; i++) {
    total += daily[daysAgoKey(i)] ?? 0;
  }
  return total;
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface StreakSnapshot {
  currentStreak: number;
  bestStreak:    number;
  thisWeek:      number;
  /** Total outcomes logged today only. */
  today:         number;
}

/** Read the current streak snapshot — safe to call on every render. */
export function readStreakSnapshot(): StreakSnapshot {
  const data = readData();
  const currentStreak = calculateCurrentStreak(data.daily);
  return {
    currentStreak,
    bestStreak: Math.max(data.bestStreak, currentStreak),
    thisWeek:   calculateLastSevenDays(data.daily),
    today:      data.daily[todayKey()] ?? 0,
  };
}

/**
 * Record one outcome. Updates today's counter, recomputes streak, and
 * promotes bestStreak if the current streak just beat it.
 */
export function recordOutcome(): StreakSnapshot {
  const data = readData();
  const key = todayKey();
  data.daily[key] = (data.daily[key] ?? 0) + 1;
  const currentStreak = calculateCurrentStreak(data.daily);
  if (currentStreak > data.bestStreak) {
    data.bestStreak = currentStreak;
  }
  writeData(data);
  return {
    currentStreak,
    bestStreak: data.bestStreak,
    thisWeek:   calculateLastSevenDays(data.daily),
    today:      data.daily[key],
  };
}
