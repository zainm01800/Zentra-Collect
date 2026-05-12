/**
 * src/components/outcome-summary-bar.tsx
 *
 * Server component.  Fetches this month's chase outcome summary and
 * renders a compact stat strip above the chase-plan list.
 *
 * Hidden entirely when nothing has been logged yet — no empty state
 * needed here because the list itself already explains what to do.
 */

import { getOutcomeSummary } from "@/actions/chase-outcomes";

function fmtGBP(n: number): string {
  return new Intl.NumberFormat("en-GB", {
    style:                 "currency",
    currency:              "GBP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

export async function OutcomeSummaryBar() {
  const summary = await getOutcomeSummary();

  // Nothing logged yet — hide completely
  if (summary.totalLogged === 0) return null;

  return (
    <div
      className="mb-5 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-[10px] px-4 py-3"
      style={{
        background: "var(--zn-surface-2)",
        border:     "1px solid var(--zn-line-soft)",
      }}
    >
      {/* Label */}
      <span className="text-[11.5px] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--zn-ink-3)" }}>
        This month
      </span>

      {/* Total logged */}
      <Stat
        label={`${summary.totalLogged} chase${summary.totalLogged === 1 ? "" : "s"} logged`}
        color="var(--zn-ink-2)"
      />

      {/* Recovered */}
      {summary.paidCount > 0 && (
        <Stat
          label={`${fmtGBP(summary.amountPaid)} recovered`}
          dot="var(--zn-safe)"
          color="var(--zn-safe)"
          bold
        />
      )}

      {/* Promises pending */}
      {summary.promisedCount > 0 && (
        <Stat
          label={`${fmtGBP(summary.amountPromised)} promised (${summary.promisedCount})`}
          dot="var(--zn-warn)"
          color="var(--zn-warn)"
        />
      )}
    </div>
  );
}

// ── Sub-component ─────────────────────────────────────────────────────────────

function Stat({
  label,
  dot,
  color,
  bold,
}: {
  label:  string;
  dot?:   string;
  color?: string;
  bold?:  boolean;
}) {
  return (
    <span className="flex items-center gap-1.5">
      {dot && (
        <span
          className="size-1.5 rounded-full flex-shrink-0"
          style={{ background: dot }}
          aria-hidden
        />
      )}
      <span
        className={`text-[12.5px] ${bold ? "font-semibold" : "font-medium"}`}
        style={{ color: color ?? "var(--zn-ink-2)" }}
      >
        {label}
      </span>
    </span>
  );
}
