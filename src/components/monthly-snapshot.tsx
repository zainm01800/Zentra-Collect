/**
 * monthly-snapshot.tsx
 *
 * Compact card showing income totals for the current calendar month.
 * Designed to sit beside <CashFlowForecast> in a 2-column grid —
 * both cards share the same height rhythm and visual weight.
 *
 * No "use client" needed — purely presentational, all data comes from props.
 */

// ── Formatter ─────────────────────────────────────────────────────────────────

function formatGBP(amount: number): string {
  return new Intl.NumberFormat("en-GB", {
    style:                 "currency",
    currency:              "GBP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

// ── Sub-components ────────────────────────────────────────────────────────────

/**
 * A single breakdown column (label + value).
 * Matches the column sub-component used in SafeToSpendCard.
 */
function BreakdownColumn({
  label,
  value,
  empty = false,
}: {
  label:  string;
  value:  string;
  empty?: boolean;
}) {
  return (
    <div>
      <p
        className="mb-1 text-[10px] font-medium uppercase tracking-[0.08em] leading-none"
        style={{ color: "var(--zn-ink-3)" }}
      >
        {label}
      </p>
      <p
        className="text-[13.5px] font-semibold leading-none tracking-tight"
        style={{
          color:              empty ? "var(--zn-ink-3)" : "var(--zn-ink)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </p>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export interface MonthlySnapshotProps {
  /** Total income received this calendar month (invoices + manual). */
  totalThisMonth: number;
  /** Total income received last calendar month — used for the trend delta. */
  totalLastMonth: number;
  /** Invoice income component of totalThisMonth. */
  invoiceIncome:  number;
  /** Manual income component of totalThisMonth. */
  manualIncome:   number;
}

export function MonthlySnapshot({
  totalThisMonth,
  totalLastMonth,
  invoiceIncome,
  manualIncome,
}: MonthlySnapshotProps) {
  const isEmpty = totalThisMonth <= 0;
  const delta   = totalThisMonth - totalLastMonth;

  // Trend colour: green when up, red when down, neutral when flat or no history.
  const trendColor =
    totalLastMonth <= 0 || delta === 0
      ? "var(--zn-ink-3)"
      : delta > 0
        ? "var(--zn-safe)"
        : "var(--zn-risk)";

  // Human-readable trend string.
  const trendLabel = (() => {
    if (totalLastMonth <= 0) return null;
    if (delta === 0)         return "Same as last month";
    const sign = delta > 0 ? "+" : "";
    return `${sign}${formatGBP(delta)} vs last month`;
  })();

  return (
    <div className="zn-card px-4 py-4">
      {/* ── Header ────────────────────────────────────────────────── */}
      <span className="zn-label">This month</span>

      {/* ── Hero total ────────────────────────────────────────────── */}
      <p
        className="mt-3 leading-none tracking-tight"
        style={{
          fontSize:           "clamp(24px, 4vw, 32px)",
          fontWeight:         600,
          color:              isEmpty ? "var(--zn-ink-3)" : "var(--zn-ink)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {isEmpty ? "—" : formatGBP(totalThisMonth)}
      </p>

      {/* ── Trend vs last month ────────────────────────────────────── */}
      <div className="mt-1.5 min-h-[18px]">
        {!isEmpty && trendLabel ? (
          <p
            className="text-[12px] leading-none"
            style={{ color: trendColor }}
          >
            {trendLabel}
          </p>
        ) : (
          <p
            className="text-[12px] leading-none"
            style={{ color: "var(--zn-muted)" }}
          >
            {isEmpty ? "Nothing recorded yet" : "No data for last month"}
          </p>
        )}
      </div>

      {/* ── Divider ───────────────────────────────────────────────── */}
      <div
        className="my-4 h-px w-full"
        style={{ background: "var(--zn-line-soft)" }}
      />

      {/* ── Breakdown: invoice + manual ───────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        <BreakdownColumn
          label="Invoice income"
          value={invoiceIncome > 0 ? formatGBP(invoiceIncome) : "—"}
          empty={invoiceIncome <= 0}
        />
        <BreakdownColumn
          label="Other income"
          value={manualIncome > 0 ? formatGBP(manualIncome) : "—"}
          empty={manualIncome <= 0}
        />
      </div>
    </div>
  );
}
