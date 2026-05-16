/**
 * UK self-employed tax estimate — pure deterministic math.
 *
 * SCOPE: Income Tax + Class 4 NIC for sole traders (Self Assessment).
 *
 * NOT IN SCOPE — never crosses regulated lines:
 *   - We do NOT file Self Assessment to HMRC
 *   - We do NOT calculate VAT (different schemes, partial exemption, etc.)
 *   - We do NOT handle Class 2 NIC (largely abolished from 2024/25;
 *     voluntary only for those below £6,725 SPT and treated as auto-paid
 *     between £6,725 and £12,570 for State Pension credit)
 *   - We do NOT handle the personal allowance taper above £100k
 *     (matters for very high earners — surface a flag, don't auto-apply)
 *   - We do NOT handle Scottish income tax rates (different bands)
 *
 * Output is labelled "estimate" and always paired with a "file via HMRC
 * or your accountant" disclaimer in the UI.
 *
 * Figures effective from 6 April 2025 (tax year 2025/26).
 */

// ── 2025/26 tax constants ────────────────────────────────────────────────────

const PERSONAL_ALLOWANCE         = 12_570;
const BASIC_RATE_UPPER           = 50_270;  // top of basic rate band
const HIGHER_RATE_UPPER          = 125_140; // top of higher rate band
const ADDITIONAL_RATE_THRESHOLD  = 125_140; // 45% applies above

const BASIC_RATE                 = 0.20;
const HIGHER_RATE                = 0.40;
const ADDITIONAL_RATE            = 0.45;

const TRADING_ALLOWANCE          = 1_000;

// Class 4 NIC (2024/25 onwards)
const NIC_LOWER_PROFITS_LIMIT    = 12_570;
const NIC_UPPER_PROFITS_LIMIT    = 50_270;
const NIC_MAIN_RATE              = 0.06;
const NIC_UPPER_RATE             = 0.02;

// ── UK tax year helpers ──────────────────────────────────────────────────────

/**
 * Returns the UK tax year an ISO date falls into.
 * 2025/26 runs from 6 April 2025 to 5 April 2026.
 * Output format: "2025/26".
 */
export function ukTaxYearForDate(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return ukTaxYearForDate(new Date());
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth(); // 0 = Jan
  const day = d.getUTCDate();
  // Before 6 April → previous tax year
  if (m < 3 || (m === 3 && day < 6)) {
    return `${y - 1}/${String(y).slice(2)}`;
  }
  return `${y}/${String(y + 1).slice(2)}`;
}

/** Returns the ISO date range of a tax year string ("2025/26"). */
export function ukTaxYearRange(taxYear: string): { startIso: string; endIso: string } {
  const startYear = parseInt(taxYear.slice(0, 4), 10);
  return {
    startIso: `${startYear}-04-06`,
    endIso:   `${startYear + 1}-04-05`,
  };
}

/** Current UK tax year as "YYYY/YY". */
export function currentUkTaxYear(): string {
  return ukTaxYearForDate(new Date());
}

// ── Tax estimate ─────────────────────────────────────────────────────────────

export interface TaxEstimateInput {
  /** Gross trading income for the tax year in £. */
  income:             number;
  /** Total allowable expenses for the tax year in £. */
  expenses:           number;
  /**
   * If true, use the £1,000 trading allowance instead of actual expenses
   * (only beneficial when expenses < £1,000).
   */
  useTradingAllowance?: boolean;
  /**
   * Other taxable income in the year (e.g. employment, dividends) that
   * affects which tax band the trading profit falls into. Defaults to 0.
   */
  otherTaxableIncome?: number;
}

export interface TaxEstimateBreakdown {
  taxYear:           string;
  taxableProfit:     number;
  /** Personal allowance applied to this estimate (0 if other income consumed it). */
  personalAllowanceApplied: number;
  incomeTax: {
    basic:      { taxable: number; tax: number };
    higher:     { taxable: number; tax: number };
    additional: { taxable: number; tax: number };
    total:      number;
  };
  nic: {
    main:      { profits: number; nic: number };
    upper:     { profits: number; nic: number };
    total:     number;
  };
  /** Sum of incomeTax.total + nic.total. */
  estimatedTaxOwed:  number;
  /** Net profit after expenses (before tax). */
  netProfit:         number;
  /** Warnings to surface (taper threshold, Scottish rates, etc.). */
  warnings:          string[];
}

export function estimateUkSelfEmployedTax(
  input: TaxEstimateInput,
  taxYear: string = currentUkTaxYear(),
): TaxEstimateBreakdown {
  const income   = Math.max(0, input.income);
  const expenses = Math.max(0, input.expenses);
  const other    = Math.max(0, input.otherTaxableIncome ?? 0);
  const useTrading = input.useTradingAllowance ?? false;

  // Net profit after deducting expenses or trading allowance
  const deduction = useTrading
    ? Math.min(income, TRADING_ALLOWANCE)
    : expenses;
  const netProfit = Math.max(0, income - deduction);

  // Total income for tax-band purposes
  const totalIncome = netProfit + other;

  // Personal allowance is shared across all income. Other-income consumes
  // it first (in practice it doesn't matter for the trading-tax estimate,
  // but it's accurate this way).
  const paApplied = Math.min(PERSONAL_ALLOWANCE, totalIncome);
  const taxableTotal = Math.max(0, totalIncome - paApplied);

  // The trading profit's share of taxable income (what we attribute tax to)
  const taxableProfit = Math.max(0, netProfit - Math.max(0, paApplied - other));

  // Income tax — slice the total taxable income into bands, then attribute
  // the proportion that comes from trading.
  const basicBandSize      = BASIC_RATE_UPPER - PERSONAL_ALLOWANCE;
  const higherBandSize     = HIGHER_RATE_UPPER - BASIC_RATE_UPPER;
  const basicTaxable       = Math.min(taxableTotal, basicBandSize);
  const higherTaxable      = Math.min(Math.max(0, taxableTotal - basicBandSize), higherBandSize);
  const additionalTaxable  = Math.max(0, taxableTotal - basicBandSize - higherBandSize);

  const basicTax      = basicTaxable      * BASIC_RATE;
  const higherTax     = higherTaxable     * HIGHER_RATE;
  const additionalTax = additionalTaxable * ADDITIONAL_RATE;

  // Class 4 NIC — only on trading profit (not other income)
  const profitOverLowerLimit = Math.max(0, netProfit - NIC_LOWER_PROFITS_LIMIT);
  const nicMainProfits   = Math.min(profitOverLowerLimit, NIC_UPPER_PROFITS_LIMIT - NIC_LOWER_PROFITS_LIMIT);
  const nicUpperProfits  = Math.max(0, netProfit - NIC_UPPER_PROFITS_LIMIT);
  const nicMain  = nicMainProfits  * NIC_MAIN_RATE;
  const nicUpper = nicUpperProfits * NIC_UPPER_RATE;

  const warnings: string[] = [];
  if (totalIncome > 100_000) {
    warnings.push(
      "Personal allowance tapers by £1 for every £2 of income over £100,000 — not applied here. Use your actual figures from HMRC.",
    );
  }
  if (useTrading && expenses > TRADING_ALLOWANCE) {
    warnings.push(
      `Trading allowance (£${TRADING_ALLOWANCE.toLocaleString("en-GB")}) is lower than your expenses — claiming actual expenses would reduce your tax.`,
    );
  }
  if (additionalTaxable > 0) {
    warnings.push(
      "Income in the 45% additional rate band — double-check with an accountant before filing.",
    );
  }

  const round2 = (n: number) => Math.round(n * 100) / 100;

  return {
    taxYear,
    taxableProfit:            round2(taxableProfit),
    personalAllowanceApplied: round2(paApplied),
    incomeTax: {
      basic:      { taxable: round2(basicTaxable),      tax: round2(basicTax) },
      higher:     { taxable: round2(higherTaxable),     tax: round2(higherTax) },
      additional: { taxable: round2(additionalTaxable), tax: round2(additionalTax) },
      total:      round2(basicTax + higherTax + additionalTax),
    },
    nic: {
      main:      { profits: round2(nicMainProfits),  nic: round2(nicMain) },
      upper:     { profits: round2(nicUpperProfits), nic: round2(nicUpper) },
      total:     round2(nicMain + nicUpper),
    },
    estimatedTaxOwed: round2(basicTax + higherTax + additionalTax + nicMain + nicUpper),
    netProfit:        round2(netProfit),
    warnings,
  };
}
