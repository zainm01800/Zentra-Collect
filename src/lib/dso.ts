/**
 * Days Sales Outstanding (DSO) — the universal AR health metric.
 *
 * Definition: average number of days it takes to collect cash after a sale.
 *
 *   DSO = (Total AR / Total Sales in Period) × Number of Days in Period
 *
 * We compute two figures:
 *   - currentDSO  — last 30 days
 *   - previousDSO — the 30-day window before that (for trend)
 *
 * The trend tells the user whether collections are getting faster or slower.
 *
 * Notes on accuracy:
 *   - "Total Sales" = sum of invoice `amount` for invoices issued in the window.
 *     This is approximate for businesses that recognise revenue differently,
 *     but it's the industry-standard SMB definition.
 *   - "Total AR" = sum of outstanding amount for open (non-Paid) invoices at
 *     the end of the window. We approximate "at the end of the window" with
 *     current state, which is accurate when computed daily.
 *   - DSO is undefined when there are no sales in the period — we return null.
 *
 * Pure function. Works with both cashpilot.Invoice and zentra.Invoice via a
 * minimal interface.
 */

export interface InvoiceForDSO {
  amount:             number;
  amountOutstanding?: number;
  issueDate?:         string;
  invoiceDate?:       string;
  status:             string;
}

export interface DSOResult {
  /** DSO for the last 30 days. null when there are no sales. */
  currentDSO:  number | null;
  /** DSO for the 30-day window before the current one. null when no sales. */
  previousDSO: number | null;
  /** Delta in days (current - previous). null when either side is null. */
  deltaDays:   number | null;
  /** "improving" (delta <= -1), "stable" (-1 < delta < 1), "worsening" (delta >= 1). */
  trend:       "improving" | "stable" | "worsening" | "unknown";
  /** Total AR (outstanding) at compute time. */
  totalAR:     number;
  /** Total sales in the current period. */
  salesPeriod: number;
  /** Days in the period used (currently always 30). */
  periodDays:  number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000;

function outstandingOf(inv: InvoiceForDSO): number {
  return inv.amountOutstanding ?? inv.amount;
}

function isPaid(inv: InvoiceForDSO): boolean {
  return inv.status.toLowerCase() === "paid";
}

function issuedAt(inv: InvoiceForDSO): number | null {
  const raw = inv.issueDate ?? inv.invoiceDate;
  if (!raw) return null;
  const t = new Date(raw).getTime();
  return Number.isNaN(t) ? null : t;
}

// ── Main ──────────────────────────────────────────────────────────────────────

/**
 * Compute DSO over a 30-day window with the previous 30-day window for trend.
 *
 * Pass `now` to make tests deterministic. Defaults to Date.now() in production.
 */
export function computeDSO(
  invoices: InvoiceForDSO[],
  now: number = Date.now(),
  periodDays: number = 30,
): DSOResult {
  const periodMs = periodDays * DAY_MS;
  const currentStart  = now - periodMs;
  const previousStart = now - 2 * periodMs;

  // Total AR = sum of outstanding on open invoices
  let totalAR = 0;
  for (const inv of invoices) {
    if (!isPaid(inv)) totalAR += outstandingOf(inv);
  }

  // Sales in current period = invoices issued in [now - 30d, now)
  let salesCurrent = 0;
  // Sales in previous period = invoices issued in [now - 60d, now - 30d)
  let salesPrevious = 0;

  for (const inv of invoices) {
    const issued = issuedAt(inv);
    if (issued === null) continue;
    if (issued >= currentStart && issued < now) {
      salesCurrent += inv.amount;
    } else if (issued >= previousStart && issued < currentStart) {
      salesPrevious += inv.amount;
    }
  }

  const currentDSO  = salesCurrent  > 0 ? (totalAR / salesCurrent)  * periodDays : null;
  const previousDSO = salesPrevious > 0 ? (totalAR / salesPrevious) * periodDays : null;

  const deltaDays =
    currentDSO !== null && previousDSO !== null ? currentDSO - previousDSO : null;

  const trend: DSOResult["trend"] =
    deltaDays === null
      ? "unknown"
      : deltaDays <= -1
        ? "improving"
        : deltaDays >= 1
          ? "worsening"
          : "stable";

  return {
    currentDSO:  currentDSO  !== null ? roundTo(currentDSO,  1) : null,
    previousDSO: previousDSO !== null ? roundTo(previousDSO, 1) : null,
    deltaDays:   deltaDays   !== null ? roundTo(deltaDays,   1) : null,
    trend,
    totalAR:     Math.round(totalAR),
    salesPeriod: Math.round(salesCurrent),
    periodDays,
  };
}

function roundTo(n: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(n * factor) / factor;
}
