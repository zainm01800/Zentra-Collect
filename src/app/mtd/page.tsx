/**
 * src/app/mtd/page.tsx
 *
 * Making Tax Digital — quarterly submission tracker.
 *
 * MTD for Income Tax Self Assessment (ITSA) mandates digital record-keeping
 * and quarterly updates to HMRC.  Mandatory from April 2026 for income
 * above £50,000; April 2027 for £30,000+.
 *
 * This page shows:
 *   1. Current tax year + mandate status for the user's income level
 *   2. Four quarter cards — income to date, deadline, status
 *   3. A submission checklist (what HMRC needs each quarter)
 *   4. A note to connect via the HMRC MTD API when ready (future feature)
 *
 * Income figures come from the existing monthly income series (paid invoices
 * + manual income). Quarterly boundaries are approximate (calendar months)
 * rather than the exact Apr 6 – Jul 5 tax-year dates — good enough for planning.
 */

import { AppShell }                from "@/components/app-shell";
import {
  getFinancialSettings,
  getMonthlyIncomeSeries,
  type MonthlyIncomeSeries,
} from "@/actions/financial-settings";
import { CalendarCheck, CheckCircle2, Circle, Clock, Info } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Zentra Flow — MTD tracker",
  description: "Track your Making Tax Digital quarterly submission deadlines.",
};

// ── Types ─────────────────────────────────────────────────────────────────────

type QuarterStatus = "submitted" | "due_soon" | "current" | "upcoming" | "overdue";

interface MTDQuarter {
  number:   1 | 2 | 3 | 4;
  label:    string;   // "Q1 · Apr – Jun"
  period:   string;   // "6 Apr – 5 Jul 2025"
  deadline: string;   // "5 Aug 2025"
  deadlineDate: Date;
  income:   number;
  status:   QuarterStatus;
}

// ── UK tax year helpers ───────────────────────────────────────────────────────

/** Tax year that started on 6 April `year` */
function taxYearLabel(year: number) {
  return `${year}/${String(year + 1).slice(2)}`;
}

/** Which tax year are we in? Returns the start year (e.g. 2025 for 2025/26) */
function currentTaxYearStart(today: Date): number {
  const y = today.getFullYear();
  // Tax year starts 6 April; if today is before 6 Apr we're in the previous year's tax year
  if (today.getMonth() < 3 || (today.getMonth() === 3 && today.getDate() < 6)) {
    return y - 1;
  }
  return y;
}

/**
 * Build the four quarter objects for the given tax year start,
 * summing income from the monthly series.
 *
 * UK MTD quarters (approximate — using calendar months for simplicity):
 *   Q1: Apr, May, Jun  → deadline 5 Aug
 *   Q2: Jul, Aug, Sep  → deadline 5 Nov
 *   Q3: Oct, Nov, Dec  → deadline 5 Feb (next calendar year)
 *   Q4: Jan, Feb, Mar  → deadline 5 May (next calendar year)
 */
function buildQuarters(
  taxYearStart: number,
  today:        Date,
  series:       MonthlyIncomeSeries[],
): MTDQuarter[] {
  // Income lookup by yearMonth key "YYYY-MM"
  const incomeByMonth: Record<string, number> = {};
  for (const s of series) incomeByMonth[s.yearMonth] = s.income;

  function monthIncome(year: number, month: number /* 1-based */): number {
    const key = `${year}-${String(month).padStart(2, "0")}`;
    return incomeByMonth[key] ?? 0;
  }

  function sumIncome(months: [number, number][]): number {
    return months.reduce((sum, [y, m]) => sum + monthIncome(y, m), 0);
  }

  const nextYear = taxYearStart + 1;

  const quarters: Omit<MTDQuarter, "status">[] = [
    {
      number:   1,
      label:    "Q1 · Apr – Jun",
      period:   `6 Apr – 5 Jul ${taxYearStart}`,
      deadline: `5 Aug ${taxYearStart}`,
      deadlineDate: new Date(taxYearStart, 7, 5),  // month is 0-indexed
      income:   sumIncome([[taxYearStart, 4], [taxYearStart, 5], [taxYearStart, 6]]),
    },
    {
      number:   2,
      label:    "Q2 · Jul – Sep",
      period:   `6 Jul – 5 Oct ${taxYearStart}`,
      deadline: `5 Nov ${taxYearStart}`,
      deadlineDate: new Date(taxYearStart, 10, 5),
      income:   sumIncome([[taxYearStart, 7], [taxYearStart, 8], [taxYearStart, 9]]),
    },
    {
      number:   3,
      label:    "Q3 · Oct – Dec",
      period:   `6 Oct ${taxYearStart} – 5 Jan ${nextYear}`,
      deadline: `5 Feb ${nextYear}`,
      deadlineDate: new Date(nextYear, 1, 5),
      income:   sumIncome([[taxYearStart, 10], [taxYearStart, 11], [taxYearStart, 12]]),
    },
    {
      number:   4,
      label:    "Q4 · Jan – Mar",
      period:   `6 Jan – 5 Apr ${nextYear}`,
      deadline: `5 May ${nextYear}`,
      deadlineDate: new Date(nextYear, 4, 5),
      income:   sumIncome([[nextYear, 1], [nextYear, 2], [nextYear, 3]]),
    },
  ];

  const msPerDay = 24 * 60 * 60 * 1000;

  return quarters.map((q) => {
    const daysUntilDeadline = Math.ceil(
      (q.deadlineDate.getTime() - today.getTime()) / msPerDay,
    );

    let status: QuarterStatus;
    if (daysUntilDeadline < 0) {
      // Deadline has passed
      status = "overdue";
    } else if (daysUntilDeadline <= 14) {
      status = "due_soon";
    } else if (daysUntilDeadline <= 90) {
      // Quarter has ended (deadline is in the future) — ready to submit
      status = "current";
    } else {
      status = "upcoming";
    }

    return { ...q, status };
  });
}

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_CFG: Record<QuarterStatus, {
  label:  string;
  color:  string;
  bg:     string;
  icon:   typeof Clock;
}> = {
  submitted: { label: "Submitted",  color: "var(--zn-safe)",   bg: "var(--zn-safe-soft)",  icon: CheckCircle2 },
  due_soon:  { label: "Due soon",   color: "var(--zn-risk)",   bg: "var(--zn-risk-soft)",  icon: Clock },
  current:   { label: "Ready",      color: "var(--zn-warn)",   bg: "var(--zn-warn-soft)",  icon: CalendarCheck },
  upcoming:  { label: "Upcoming",   color: "var(--zn-ink-3)",  bg: "var(--zn-surface-2)",  icon: Circle },
  overdue:   { label: "Overdue",    color: "var(--zn-risk)",   bg: "var(--zn-risk-soft)",  icon: Clock },
};

// ── Formatters ────────────────────────────────────────────────────────────────

function fmtGBP(n: number): string {
  return new Intl.NumberFormat("en-GB", {
    style:                 "currency",
    currency:              "GBP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

// ── Mandate threshold check ───────────────────────────────────────────────────

function getMandateStatus(annualIncome: number): {
  applies: boolean;
  message: string;
} {
  if (annualIncome >= 50_000) {
    return {
      applies: true,
      message: `Your income (${fmtGBP(annualIncome)}) is above £50,000 — MTD for ITSA applies from April 2026.`,
    };
  }
  if (annualIncome >= 30_000) {
    return {
      applies: false,
      message: `Your income (${fmtGBP(annualIncome)}) is above £30,000 — MTD for ITSA applies from April 2027.`,
    };
  }
  return {
    applies: false,
    message: `Your income (${fmtGBP(annualIncome)}) is currently below the £30,000 MTD threshold. Check gov.uk for updates.`,
  };
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function MTDPage() {
  const today = new Date();
  const taxYearStart = currentTaxYearStart(today);

  // Fetch 16 months of income data to cover the full tax year
  const [settings, series] = await Promise.all([
    getFinancialSettings(),
    getMonthlyIncomeSeries(16),
  ]);

  const quarters = buildQuarters(taxYearStart, today, series);

  // Annual income = sum of all series income
  const annualIncome = series.reduce((sum, s) => sum + s.income, 0);
  const mandate = getMandateStatus(annualIncome);

  const taxRate = settings?.taxRatePercent ?? 20;
  const isGB    = (settings?.countryCode ?? "GB") === "GB";

  return (
    <AppShell>
      <div className="space-y-8 max-w-2xl">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div>
          <p className="zn-label">Compliance</p>
          <h1
            className="mt-1 text-[26px] font-semibold tracking-[-0.02em]"
            style={{ color: "var(--zn-ink)" }}
          >
            Making Tax Digital
          </h1>
          <p className="mt-1 text-[14px]" style={{ color: "var(--zn-ink-2)" }}>
            Tax year {taxYearLabel(taxYearStart)} · Quarterly submission tracker
          </p>
        </div>

        {/* ── Mandate status banner ───────────────────────────────────────── */}
        <div
          className="flex items-start gap-3 rounded-[10px] px-4 py-3"
          style={{
            background: mandate.applies ? "var(--zn-warn-soft)" : "var(--zn-surface-2)",
            border:     `1px solid ${mandate.applies ? "var(--zn-warn)" : "var(--zn-line-soft)"}`,
          }}
        >
          <Info
            className="size-4 flex-shrink-0 mt-0.5"
            style={{ color: mandate.applies ? "var(--zn-warn)" : "var(--zn-ink-3)" }}
          />
          <p
            className="text-[13px]"
            style={{ color: mandate.applies ? "var(--zn-warn)" : "var(--zn-ink-2)" }}
          >
            {mandate.message}
          </p>
        </div>

        {/* ── Quarter cards ───────────────────────────────────────────────── */}
        <section>
          <p
            className="mb-4 text-[11px] font-semibold uppercase tracking-[0.1em]"
            style={{ color: "var(--zn-ink-3)" }}
          >
            Quarterly updates
          </p>
          <div className="space-y-3">
            {quarters.map((q) => {
              const cfg = STATUS_CFG[q.status];
              const StatusIcon = cfg.icon;
              return (
                <div
                  key={q.number}
                  className="zn-card px-5 py-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    {/* Left: quarter info */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className="text-[11px] font-bold uppercase tracking-[0.08em] font-mono"
                          style={{ color: "var(--zn-ink-3)" }}
                        >
                          {q.label}
                        </span>
                      </div>
                      <p
                        className="mt-1 text-[18px] font-semibold tabular-nums"
                        style={{ color: "var(--zn-ink)" }}
                      >
                        {q.income > 0 ? fmtGBP(q.income) : "—"}
                      </p>
                      <p className="mt-0.5 text-[12px]" style={{ color: "var(--zn-ink-3)" }}>
                        {q.period}
                      </p>
                      <p className="mt-1 text-[12px]" style={{ color: "var(--zn-ink-3)" }}>
                        Deadline: <span style={{ color: "var(--zn-ink-2)" }}>{q.deadline}</span>
                      </p>
                    </div>

                    {/* Right: status badge */}
                    <div
                      className="flex-shrink-0 flex items-center gap-1.5 rounded-full px-2.5 py-1"
                      style={{ background: cfg.bg }}
                    >
                      <StatusIcon className="size-3" style={{ color: cfg.color }} />
                      <span className="text-[12px] font-semibold" style={{ color: cfg.color }}>
                        {cfg.label}
                      </span>
                    </div>
                  </div>

                  {/* Tax estimate for this quarter */}
                  {q.income > 0 && (
                    <div
                      className="mt-3 flex items-center justify-between rounded-[8px] px-3 py-2"
                      style={{ background: "var(--zn-bg-2)", border: "1px solid var(--zn-line-soft)" }}
                    >
                      <span className="text-[12px]" style={{ color: "var(--zn-ink-3)" }}>
                        Estimated tax ({taxRate}%)
                      </span>
                      <span
                        className="text-[12px] font-semibold tabular-nums"
                        style={{ color: "var(--zn-warn)" }}
                      >
                        {fmtGBP(q.income * (taxRate / 100))}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* ── Submission checklist ────────────────────────────────────────── */}
        <section>
          <div className="zn-card px-5 py-5">
            <p
              className="text-[13.5px] font-semibold mb-4"
              style={{ color: "var(--zn-ink)" }}
            >
              What HMRC needs each quarter
            </p>
            <div className="space-y-3">
              {[
                {
                  item: "Total income",
                  detail: "Sum of all invoices paid and cash received in the quarter.",
                  done: true,
                },
                {
                  item: "Total expenses",
                  detail: "Allowable business expenses (software, equipment, mileage, etc.). Not tracked in Zentra yet.",
                  done: false,
                },
                ...(isGB ? [{
                  item: "Class 2 / Class 4 NI",
                  detail: "Calculated automatically by HMRC — you don't submit this quarterly.",
                  done: true,
                }] : []),
                {
                  item: "Digital records",
                  detail: "HMRC requires records kept in compatible software. Zentra exports your income data.",
                  done: true,
                },
              ].map(({ item, detail, done }) => (
                <div key={item} className="flex items-start gap-3">
                  <span className="mt-0.5 flex-shrink-0">
                    {done
                      ? <CheckCircle2 className="size-4" style={{ color: "var(--zn-safe)" }} />
                      : <Circle       className="size-4" style={{ color: "var(--zn-ink-3)" }} />
                    }
                  </span>
                  <div>
                    <p className="text-[13px] font-medium" style={{ color: "var(--zn-ink)" }}>
                      {item}
                    </p>
                    <p className="text-[12px] mt-0.5" style={{ color: "var(--zn-ink-3)" }}>
                      {detail}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── HMRC API note ───────────────────────────────────────────────── */}
        <div
          className="flex items-start gap-3 rounded-[10px] px-4 py-3"
          style={{ background: "var(--zn-surface-2)", border: "1px solid var(--zn-line-soft)" }}
        >
          <Info className="size-4 flex-shrink-0 mt-0.5" style={{ color: "var(--zn-ink-3)" }} />
          <div>
            <p className="text-[13px] font-medium" style={{ color: "var(--zn-ink)" }}>
              Direct HMRC submission coming soon
            </p>
            <p className="mt-0.5 text-[12px]" style={{ color: "var(--zn-ink-3)" }}>
              A future update will connect directly to the HMRC MTD API so you
              can submit quarterly updates without leaving Zentra. Until then,
              use{" "}
              <a
                href="https://www.gov.uk/guidance/find-software-thats-compatible-with-making-tax-digital-for-income-tax"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                compatible MTD software
              </a>{" "}
              or work with your accountant.
            </p>
          </div>
        </div>

      </div>
    </AppShell>
  );
}
