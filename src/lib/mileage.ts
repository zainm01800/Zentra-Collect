/**
 * Mileage tracking for sole-trader Self-Assessment.
 *
 * UK HMRC "approved mileage allowance payments" (AMAP) for cars and vans
 * (rates current at time of writing, 2024/25):
 *   - 45p per mile for the first 10,000 business miles in a tax year
 *   - 25p per mile after that
 *
 * Motorcycles and bicycles have different rates and are out of scope here.
 *
 * Storage: localStorage "zentra.mileage.v1" — one entry per trip.
 * Aggregates feed into lib/tax/summary.ts as allowable expense.
 */

const STORAGE_KEY = "zentra.mileage.v1";

export const HMRC_RATE_FIRST_10K   = 0.45;  // first 10,000 miles/tax year
export const HMRC_RATE_AFTER_10K   = 0.25;  // beyond that
export const HMRC_FIRST_BAND_LIMIT = 10_000;

export interface MileageTrip {
  id:       string;
  date:     string;   // YYYY-MM-DD
  miles:    number;
  purpose:  string;   // free-text, e.g. "Site visit — BluePeak"
  fromTo?:  string;   // optional, e.g. "Reading → Slough"
  createdAt: string;
}

// ── Storage helpers ──────────────────────────────────────────────────────────

function safeRead(): MileageTrip[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as MileageTrip[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function safeWrite(items: MileageTrip[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent("zentra:mileage-change"));
  } catch {
    /* quota / SSR */
  }
}

export function readTrips(): MileageTrip[] {
  return safeRead().sort((a, b) => b.date.localeCompare(a.date));
}

export function addTrip(input: Omit<MileageTrip, "id" | "createdAt">): MileageTrip {
  const trip: MileageTrip = {
    ...input,
    id:        `trip-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
  };
  safeWrite([...safeRead(), trip]);
  return trip;
}

export function deleteTrip(id: string): void {
  safeWrite(safeRead().filter((t) => t.id !== id));
}

// ── Calc ──────────────────────────────────────────────────────────────────────

/**
 * HMRC allowable mileage cost for a given mileage total.
 * Pure function — testable in isolation.
 */
export function calcMileageAllowance(totalMiles: number): {
  miles:         number;
  firstBandMiles: number;
  secondBandMiles: number;
  allowance:     number;
} {
  const miles = Math.max(0, totalMiles);
  const firstBandMiles  = Math.min(miles, HMRC_FIRST_BAND_LIMIT);
  const secondBandMiles = Math.max(0, miles - HMRC_FIRST_BAND_LIMIT);
  const allowance =
    Math.round(
      (firstBandMiles * HMRC_RATE_FIRST_10K +
       secondBandMiles * HMRC_RATE_AFTER_10K) * 100,
    ) / 100;
  return { miles, firstBandMiles, secondBandMiles, allowance };
}

/**
 * Total mileage allowance in a date range (inclusive). Defaults to
 * "all trips" if no range is provided.
 */
export function totalMileageAllowance(opts?: { from?: Date; to?: Date }): number {
  const trips = safeRead();
  if (!trips.length) return 0;

  const fromMs = opts?.from?.getTime() ?? -Infinity;
  const toMs   = opts?.to?.getTime() ?? Infinity;

  const totalMiles = trips.reduce((sum, t) => {
    const ts = new Date(t.date).getTime();
    if (!Number.isFinite(ts) || ts < fromMs || ts > toMs) return sum;
    return sum + (Number.isFinite(t.miles) ? t.miles : 0);
  }, 0);

  return calcMileageAllowance(totalMiles).allowance;
}
