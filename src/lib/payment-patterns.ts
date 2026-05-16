/**
 * Day-of-week payment patterns.
 *
 * Analyses paid invoices to find which day(s) of the week the user's
 * customers tend to settle. Surfaces actionable insight like:
 *   "Customers pay 38% more often on Tuesdays — chase Mondays for best results."
 *
 * Pure function. Works from an invoice list — no external data needed.
 */

// ── Input type — permissive ──────────────────────────────────────────────────

export interface InvoiceForPaymentPattern {
  status:       string;
  /** When the invoice was marked paid. Uses lastChasedAt as a proxy fallback. */
  paidAt?:      string;
  lastChasedAt?: string | null;
  /** Used as a last-resort fallback for "settled" date estimation. */
  invoiceDate?: string;
  issueDate?:   string;
}

// ── Result types ──────────────────────────────────────────────────────────────

export type WeekdayName =
  | "Monday"
  | "Tuesday"
  | "Wednesday"
  | "Thursday"
  | "Friday"
  | "Saturday"
  | "Sunday";

const WEEKDAYS: WeekdayName[] = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export interface DayBucket {
  day:   WeekdayName;
  count: number;
  /** Share of all paid invoices that landed on this weekday (0–1). */
  share: number;
}

export interface PaymentPatternResult {
  /** True when enough paid invoices exist to compute meaningful insights. */
  hasEnoughData: boolean;
  /** Total paid invoices analysed. */
  totalPaid:      number;
  /** Per-weekday breakdown — always 7 items in Mon–Sun order. */
  byWeekday:      DayBucket[];
  /** Day with the highest share. */
  topDay:         WeekdayName | null;
  /** How much more often the top day fires vs the average (e.g. 0.38 = +38%). */
  topDayLiftVsAverage: number;
  /** One-sentence summary suitable for surfacing in the UI. */
  summary:        string;
  /** Actionable tip — when to chase given the pattern. */
  tip:            string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function paidDateOf(inv: InvoiceForPaymentPattern): string | null {
  if (inv.paidAt) return inv.paidAt;
  // lastChasedAt is the next-best proxy — chases typically immediately precede
  // payment for the cases where we capture the chase outcome.
  if (inv.lastChasedAt) return inv.lastChasedAt;
  return null;
}

function weekdayOf(iso: string): WeekdayName | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return WEEKDAYS[d.getUTCDay()];
}

// ── Main ──────────────────────────────────────────────────────────────────────

/**
 * Compute payment patterns from a list of invoices.
 * Needs at least 5 paid invoices with dates to produce a confident pattern.
 */
export function computePaymentPatterns(
  invoices: InvoiceForPaymentPattern[],
): PaymentPatternResult {
  // Init Mon-Sun buckets
  const order: WeekdayName[] = [
    "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday",
  ];
  const counts = new Map<WeekdayName, number>(order.map((d) => [d, 0]));

  let totalPaid = 0;
  for (const inv of invoices) {
    if (inv.status.toLowerCase() !== "paid") continue;
    const dateStr = paidDateOf(inv);
    if (!dateStr) continue;
    const day = weekdayOf(dateStr);
    if (!day) continue;
    counts.set(day, (counts.get(day) ?? 0) + 1);
    totalPaid += 1;
  }

  const byWeekday: DayBucket[] = order.map((day) => ({
    day,
    count: counts.get(day) ?? 0,
    share: totalPaid > 0 ? (counts.get(day) ?? 0) / totalPaid : 0,
  }));

  const hasEnoughData = totalPaid >= 5;

  if (!hasEnoughData) {
    return {
      hasEnoughData: false,
      totalPaid,
      byWeekday,
      topDay: null,
      topDayLiftVsAverage: 0,
      summary: `${totalPaid} paid invoice${totalPaid === 1 ? "" : "s"} on record — need at least 5 to spot a pattern.`,
      tip:     "Mark more invoices as paid to unlock day-of-week insights.",
    };
  }

  // Find top day
  let topDay: WeekdayName = order[0];
  let topCount = 0;
  for (const bucket of byWeekday) {
    if (bucket.count > topCount) {
      topCount = bucket.count;
      topDay = bucket.day;
    }
  }

  const averageShare = 1 / 7;
  const topShare = topCount / totalPaid;
  const lift = (topShare - averageShare) / averageShare; // e.g. 0.38 = +38%

  const liftPct = Math.round(lift * 100);
  const summary =
    lift > 0
      ? `Customers pay ${liftPct}% more often on ${topDay}s than on an average weekday.`
      : `Your payments are spread fairly evenly across the week (no day stands out).`;

  // Suggest the best day to chase — the day BEFORE the top payment day,
  // wrapping around (so Tuesday → chase Monday). For Monday-heavy patterns
  // we recommend chasing Friday because B2B AP runs settle over the weekend.
  const chaseBefore: Record<WeekdayName, WeekdayName> = {
    Monday:    "Friday",
    Tuesday:   "Monday",
    Wednesday: "Tuesday",
    Thursday:  "Wednesday",
    Friday:    "Thursday",
    Saturday:  "Friday",
    Sunday:    "Friday",
  };
  const chaseDay = chaseBefore[topDay];

  const tip =
    lift > 0
      ? `Send chase emails on ${chaseDay} — by the next ${topDay}, more invoices typically clear.`
      : "Send chase emails on Tuesday or Thursday — both are above-average payment days for most UK businesses.";

  return {
    hasEnoughData: true,
    totalPaid,
    byWeekday,
    topDay,
    topDayLiftVsAverage: Math.round(lift * 100) / 100,
    summary,
    tip,
  };
}
