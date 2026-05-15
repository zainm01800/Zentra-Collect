/**
 * UK Statutory Late Payment Interest — shared module.
 *
 * Under the Late Payment of Commercial Debts (Interest) Act 1998:
 *   - B2B invoices only (not consumer debts)
 *   - Statutory rate = Bank of England Base Rate + 8%
 *   - Fixed compensation per invoice:
 *       £40  if debt < £1,000
 *       £70  if debt £1,000–£9,999.99
 *       £100 if debt ≥ £10,000
 *
 * This is a calculator, not legal advice. Always shown alongside a disclaimer
 * when surfaced to the user.
 */

// ── Rate ──────────────────────────────────────────────────────────────────────

/** Bank of England base rate as of Q1 2026. Update when BoE changes rate. */
export const BOE_BASE_RATE = 4.5;

/** Statutory rate = BoE base + 8%. Recomputed if BOE_BASE_RATE changes. */
export const STATUTORY_INTEREST_RATE = BOE_BASE_RATE + 8; // = 12.5% as of Q1 2026

// ── Compensation ──────────────────────────────────────────────────────────────

/** Fixed statutory compensation per invoice — tiered by debt amount. */
export function statutoryCompensation(debtAmount: number): number {
  if (debtAmount < 1000)  return 40;
  if (debtAmount < 10000) return 70;
  return 100;
}

// ── Result type ───────────────────────────────────────────────────────────────

export interface StatutoryInterestResult {
  /** Interest accrued so far (in £), excluding fixed compensation. */
  interest:         number;
  /** Fixed statutory compensation amount (in £). */
  compensation:     number;
  /** Daily interest as a decimal (e.g. 0.000342). */
  dailyRate:        number;
  /** Annual statutory rate as a percentage (e.g. 12.5). */
  annualRate:       number;
  /** Total the creditor is legally entitled to recover: debt + interest + compensation. */
  totalRecoverable: number;
}

// ── Core calculation ──────────────────────────────────────────────────────────

/**
 * Calculate the statutory interest position on an overdue B2B invoice.
 *
 * Returns { interest, compensation, totalRecoverable } — all in £.
 * Safe for any debt amount and any days overdue (negative values clamped to 0).
 */
export function calculateStatutoryInterest(
  debtAmount: number,
  daysOverdue: number,
): StatutoryInterestResult {
  const safeDebt = Math.max(0, debtAmount);
  const safeDays = Math.max(0, daysOverdue);
  const dailyRate = STATUTORY_INTEREST_RATE / 100 / 365;
  const interest  = safeDebt * dailyRate * safeDays;
  const compensation = statutoryCompensation(safeDebt);
  return {
    interest,
    compensation,
    dailyRate,
    annualRate: STATUTORY_INTEREST_RATE,
    totalRecoverable: safeDebt + interest + compensation,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * True if statutory interest is worth mentioning to the customer
 * (at least £5 of interest has accrued — below this it's noise).
 */
export function isInterestMaterial(debtAmount: number, daysOverdue: number): boolean {
  if (daysOverdue <= 0 || debtAmount <= 0) return false;
  const { interest } = calculateStatutoryInterest(debtAmount, daysOverdue);
  return interest >= 5;
}

/**
 * One-line summary phrase suitable for embedding in a chase message.
 * Returns null when interest isn't material.
 *
 * Example:
 *   "Statutory interest of £62.50 plus £100 compensation has accrued under
 *    the Late Payment of Commercial Debts Act."
 */
export function interestPhraseForChase(
  debtAmount: number,
  daysOverdue: number,
): string | null {
  if (!isInterestMaterial(debtAmount, daysOverdue)) return null;
  const { interest, compensation } = calculateStatutoryInterest(debtAmount, daysOverdue);
  const fmt = (n: number) =>
    `£${n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return `Statutory interest of ${fmt(interest)} plus ${fmt(compensation)} compensation has accrued under the Late Payment of Commercial Debts Act.`;
}
