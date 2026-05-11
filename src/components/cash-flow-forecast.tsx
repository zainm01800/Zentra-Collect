/**
 * cash-flow-forecast.tsx
 *
 * Compact 4-week cash-flow strip.  No chart library — bars are plain divs.
 * No "use client" needed: the component is purely presentational and can be
 * rendered on the server or inside a client tree.
 */

import type { Invoice } from "@/types/zentra";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ManualIncomeItem {
  amount:       number;
  receivedDate: string; // YYYY-MM-DD
  source:       string;
}

interface WeekBucket {
  label:      string;
  total:      number;   // invoices + manual income for the week
  hasOverdue: boolean;  // any invoice with status === "overdue"
  isEmpty:    boolean;  // nothing due / expected this week
}

type TagStatus = "likely" | "overdue" | "uncertain";

// ── Pure calculation helpers ──────────────────────────────────────────────────

function parseUtcDate(iso: string): Date {
  // Slice to YYYY-MM-DD before constructing so comparisons are timezone-neutral.
  return new Date(`${iso.slice(0, 10)}T00:00:00.000Z`);
}

function utcToday(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/** Signed whole-day count from a → b.  Positive when b is in the future. */
function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

/**
 * Map a day offset (relative to referenceDate) into one of the 4 week slots.
 * Returns null for dates in the past or beyond 4 weeks.
 */
function weekBucketIndex(daysFromRef: number): 0 | 1 | 2 | 3 | null {
  if (daysFromRef <  0) return null;
  if (daysFromRef <  7) return 0;
  if (daysFromRef < 14) return 1;
  if (daysFromRef < 21) return 2;
  if (daysFromRef < 28) return 3;
  return null;
}

const WEEK_LABELS = ["This week", "Next week", "Week 3", "Week 4"] as const;

/**
 * Build the four week buckets from invoice and manual-income data.
 *
 * Bucketing rules:
 *  - "paid" and "do_not_chase" invoices are excluded entirely.
 *  - Invoices with status === "overdue" always land in bucket 0 ("This week"),
 *    regardless of their dueDate.  They also set hasOverdue = true.
 *  - All other invoices are bucketed by dueDate falling within the 7-day window.
 *  - Invoices without a dueDate (and not overdue) are skipped.
 *  - Manual income is bucketed by receivedDate; it never sets hasOverdue.
 *  - Items with amount ≤ 0 are skipped to avoid noise.
 */
function buildBuckets(
  invoices:     Invoice[],
  manualIncome: ManualIncomeItem[],
  ref:          Date,
): WeekBucket[] {
  const buckets: WeekBucket[] = WEEK_LABELS.map((label) => ({
    label,
    total:      0,
    hasOverdue: false,
    isEmpty:    true,
  }));

  // ── Invoices ──────────────────────────────────────────────────────────────
  for (const inv of invoices) {
    if (inv.status === "paid" || inv.status === "do_not_chase") continue;

    const amount = inv.amountOutstanding;
    if (amount <= 0) continue;

    // Overdue invoices are always surfaced in "This week".
    if (inv.status === "overdue") {
      buckets[0].total      += amount;
      buckets[0].hasOverdue  = true;
      buckets[0].isEmpty     = false;
      continue;
    }

    // Non-overdue: bucket strictly by dueDate.
    if (!inv.dueDate) continue;

    const daysUntilDue = daysBetween(ref, parseUtcDate(inv.dueDate));
    const idx = weekBucketIndex(daysUntilDue);
    if (idx === null) continue;

    buckets[idx].total  += amount;
    buckets[idx].isEmpty = false;
  }

  // ── Manual income ─────────────────────────────────────────────────────────
  for (const item of manualIncome) {
    if (!item.receivedDate || item.amount <= 0) continue;

    const daysFromRef = daysBetween(ref, parseUtcDate(item.receivedDate));
    const idx = weekBucketIndex(daysFromRef);
    if (idx === null) continue;

    buckets[idx].total  += item.amount;
    buckets[idx].isEmpty = false;
  }

  return buckets;
}

/** Derive the traffic-light status tag for a single bucket. */
function tagStatus(bucket: WeekBucket): TagStatus {
  if (bucket.isEmpty)    return "uncertain";
  if (bucket.hasOverdue) return "overdue";
  return "likely";
}

// ── Formatters ────────────────────────────────────────────────────────────────

function formatGBP(amount: number): string {
  return new Intl.NumberFormat("en-GB", {
    style:                 "currency",
    currency:              "GBP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

// ── Sub-components ────────────────────────────────────────────────────────────

const TAG_CONFIG: Record<TagStatus, { bg: string; color: string; label: string }> = {
  likely:    { bg: "#d6dec5", color: "#4f6b3e", label: "Likely"    }, // safe-soft / safe
  overdue:   { bg: "#efcdc9", color: "#9a3535", label: "Overdue"   }, // risk-soft / risk
  uncertain: { bg: "#f3ecd8", color: "#6b6253", label: "Uncertain" }, // surface-2 / ink-3
};

function StatusTag({ status }: { status: TagStatus }) {
  const { bg, color, label } = TAG_CONFIG[status];
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium leading-none"
      style={{ background: bg, color }}
    >
      {label}
    </span>
  );
}

function WeekColumn({
  bucket,
  maxTotal,
}: {
  bucket:   WeekBucket;
  maxTotal: number;
}) {
  const pct = maxTotal > 0 ? Math.round((bucket.total / maxTotal) * 100) : 0;

  // Bar colour: risk-red when overdue content is present, safe-green otherwise.
  // An empty bucket gets no fill (pct = 0), so the colour doesn't matter much,
  // but we default to the line colour to keep it subtle.
  const barFill = bucket.hasOverdue
    ? "var(--zn-risk)"
    : bucket.isEmpty
      ? "var(--zn-line)"
      : "var(--zn-safe)";

  return (
    <div className="flex flex-col gap-2">
      {/* Week label */}
      <p
        className="text-[11px] font-medium leading-none"
        style={{ color: "var(--zn-ink-3)" }}
      >
        {bucket.label}
      </p>

      {/* Bar track + fill */}
      <div
        className="h-1.5 w-full overflow-hidden rounded-full"
        style={{ background: "var(--zn-surface-2)" }}
        role="presentation"
        aria-hidden
      >
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, background: barFill }}
        />
      </div>

      {/* Amount */}
      <p
        className="text-[13.5px] font-semibold leading-none tracking-tight"
        style={{
          color:              "var(--zn-ink)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {bucket.isEmpty ? "—" : formatGBP(bucket.total)}
      </p>

      {/* Status tag */}
      <StatusTag status={tagStatus(bucket)} />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export interface CashFlowForecastProps {
  invoices:      Invoice[];
  manualIncome:  ManualIncomeItem[];
  referenceDate?: string;
}

export function CashFlowForecast({
  invoices,
  manualIncome,
  referenceDate,
}: CashFlowForecastProps) {
  const ref      = referenceDate ? parseUtcDate(referenceDate) : utcToday();
  const buckets  = buildBuckets(invoices, manualIncome, ref);
  const maxTotal = Math.max(...buckets.map((b) => b.total), 0);
  // Monthly total is the sum across all four buckets in the window.
  const monthlyTotal = buckets.reduce((sum, b) => sum + b.total, 0);

  return (
    <div className="zn-card px-4 py-4">
      {/* ── Header ────────────────────────────────────────────────── */}
      <span className="zn-label">Cash flow forecast</span>

      {/* ── 4-week columns ────────────────────────────────────────── */}
      <div className="mt-4 grid grid-cols-4 gap-3">
        {buckets.map((bucket) => (
          <WeekColumn
            key={bucket.label}
            bucket={bucket}
            maxTotal={maxTotal}
          />
        ))}
      </div>

      {/* ── Divider ───────────────────────────────────────────────── */}
      <div
        className="my-4 h-px w-full"
        style={{ background: "var(--zn-line-soft)" }}
      />

      {/* ── Monthly summary line ───────────────────────────────────── */}
      <p className="text-[13px] leading-none" style={{ color: "var(--zn-ink-3)" }}>
        <span
          className="font-semibold"
          style={{
            color:              monthlyTotal > 0 ? "var(--zn-safe)" : "var(--zn-ink-3)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {monthlyTotal > 0 ? formatGBP(monthlyTotal) : "Nothing"}
        </span>
        {" "}expected this month
      </p>
    </div>
  );
}
