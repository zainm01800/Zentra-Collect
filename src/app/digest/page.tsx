/**
 * src/app/digest/page.tsx
 *
 * Weekly digest page — two sections:
 *
 *   Section 1 — "Your money this week"  (NEW, server-rendered)
 *     Safe to Spend, cash expected this week, tax set aside this month,
 *     and a one-line status.  Data comes from getFinancialSettings() +
 *     getInvoices() + getMonthlyIncomeSummary().
 *
 *   Section 2 — "Collections this week"  (EXISTING, unchanged)
 *     The ZentraWeeklyDigest client component renders exactly as before.
 *     Nothing about it — its props, its data fetching, its internals —
 *     has been changed.
 */

import { AppShell }          from "@/components/app-shell";
import { ZentraWeeklyDigest } from "@/components/zentra-weekly-digest";
import {
  getFinancialSettings,
  getMonthlyIncomeSummary,
} from "@/actions/financial-settings";
import { getInvoices }       from "@/lib/api/db";
import {
  calculateSafeToSpend,
  estimateTaxSetAside,
} from "@/lib/finance/safe-to-spend";
import type { Metadata } from "next";

// ── Metadata ──────────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title:       "Zentra Flow — Weekly Digest",
  description: "A Monday-ready summary for owners and bookkeepers.",
};

// ── Shared formatter ──────────────────────────────────────────────────────────

function fmtGBP(n: number): string {
  return new Intl.NumberFormat("en-GB", {
    style:                 "currency",
    currency:              "GBP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

// ── Status mapping ────────────────────────────────────────────────────────────

type StatusKey = "safe" | "caution" | "low";

const STATUS_CONFIG = {
  safe: {
    label:  "On track",
    symbol: "✓",
    color:  "var(--zn-safe)",
    bg:     "var(--zn-safe-soft)",
  },
  caution: {
    label:  "Watch your spending",
    symbol: "→",
    color:  "var(--zn-warn)",
    bg:     "var(--zn-warn-soft)",
  },
  low: {
    label:  "Chase invoices",
    symbol: "↑",
    color:  "var(--zn-risk)",
    bg:     "var(--zn-risk-soft)",
  },
} satisfies Record<StatusKey, { label: string; symbol: string; color: string; bg: string }>;

// ── Section 1 sub-components (server-only, no "use client") ──────────────────

/** Single labelled stat — used for the three secondary figures. */
function StatCell({
  label,
  value,
  sub,
  empty = false,
}: {
  label:  string;
  value:  string;
  sub?:   string;
  empty?: boolean;
}) {
  return (
    <div>
      <p className="zn-label">{label}</p>
      <p
        className="mt-1.5 text-[20px] font-semibold leading-none tracking-tight"
        style={{
          color:              empty ? "var(--zn-ink-3)" : "var(--zn-ink)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </p>
      {sub && (
        <p className="mt-1 text-[11px]" style={{ color: "var(--zn-ink-3)" }}>
          {sub}
        </p>
      )}
    </div>
  );
}

/** Coloured status pill. */
function StatusPill({ statusKey }: { statusKey: StatusKey }) {
  const cfg = STATUS_CONFIG[statusKey];
  return (
    <div>
      <p className="zn-label">Status</p>
      <div
        className="mt-1.5 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 leading-none"
        style={{ background: cfg.bg }}
      >
        <span
          className="text-[13px] font-bold"
          aria-hidden
          style={{ color: cfg.color }}
        >
          {cfg.symbol}
        </span>
        <span
          className="text-[13px] font-medium"
          style={{ color: cfg.color }}
        >
          {cfg.label}
        </span>
      </div>
    </div>
  );
}

/**
 * The full "Your money this week" card.
 *
 * When no bank balance is set yet, renders a gentle prompt rather than
 * zeroed-out numbers (which would look alarming and be meaningless).
 */
function MoneySummaryCard({
  safeToSpend,
  expectedThisWeek,
  taxThisMonth,
  statusKey,
  hasBankBalance,
}: {
  safeToSpend:      number;
  expectedThisWeek: number;
  taxThisMonth:     number;
  statusKey:        StatusKey | null;
  hasBankBalance:   boolean;
}) {
  if (!hasBankBalance) {
    return (
      <div
        className="zn-card flex flex-col items-center gap-3 px-5 py-8 text-center"
      >
        <p
          className="text-[14px] font-medium"
          style={{ color: "var(--zn-ink-2)" }}
        >
          Add your bank balance to see your financial position here.
        </p>
        <a
          href="/dashboard"
          className="zn-pill"
          style={{ fontSize: 12.5, height: 30, padding: "0 14px" }}
        >
          Add bank balance
        </a>
      </div>
    );
  }

  return (
    <div className="zn-card px-5 py-5">
      {/* ── Hero: safe to spend ─────────────────────────────────────── */}
      <div
        className="pb-4 mb-4"
        style={{ borderBottom: "1px solid var(--zn-line-soft)" }}
      >
        <p className="zn-label">Safe to spend right now</p>
        <p
          className="mt-2 leading-none tracking-tight"
          style={{
            fontSize:           "clamp(32px, 5vw, 42px)",
            fontWeight:         700,
            color:              "var(--zn-ink)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {fmtGBP(safeToSpend)}
        </p>
      </div>

      {/* ── Secondary stats ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-y-5 gap-x-4 sm:grid-cols-3">
        <StatCell
          label="Cash due this week"
          value={expectedThisWeek > 0 ? fmtGBP(expectedThisWeek) : "—"}
          sub={expectedThisWeek > 0 ? "from invoices due soon" : "no invoices due this week"}
          empty={expectedThisWeek <= 0}
        />
        <StatCell
          label="Tax this month"
          value={taxThisMonth > 0 ? fmtGBP(taxThisMonth) : "—"}
          sub={taxThisMonth > 0 ? "estimated from income" : "no income recorded"}
          empty={taxThisMonth <= 0}
        />
        {statusKey && <StatusPill statusKey={statusKey} />}
      </div>
    </div>
  );
}

// ── Section separator ─────────────────────────────────────────────────────────

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <p className="zn-label flex-shrink-0">{label}</p>
      <div className="flex-1 h-px" style={{ background: "var(--zn-line-soft)" }} />
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function DigestPage() {
  // Fetch all data sources in parallel.
  const [settings, invoices, monthlyIncome] = await Promise.all([
    getFinancialSettings(),
    getInvoices(),
    getMonthlyIncomeSummary(),
  ]);

  // ── Derive financial position ────────────────────────────────────────────

  const taxRatePercent  = settings?.taxRatePercent ?? 20;
  const hasBankBalance  = Boolean(settings?.bankBalanceUpdatedAt);

  const sts = hasBankBalance
    ? calculateSafeToSpend({
        bankBalance:    settings!.bankBalance,
        invoices,
        taxRatePercent,
        manualBills:    [],
      })
    : null;

  // Tax to set aside from THIS month's income (invoice + manual).
  const taxThisMonth = estimateTaxSetAside(monthlyIncome.totalThisMonth, taxRatePercent);

  const statusKey: StatusKey | null = sts?.statusLabel ?? null;

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <AppShell>
      <div className="space-y-8">

        {/* ══ Section 1 — Your money this week ══════════════════════════ */}

        <section aria-labelledby="money-heading">
          <SectionDivider label="Your money this week" />
          <h2
            id="money-heading"
            className="mt-2 mb-4 text-[18px] font-semibold tracking-[-0.015em]"
            style={{ color: "var(--zn-ink)" }}
          >
            Financial position
          </h2>
          <MoneySummaryCard
            safeToSpend={sts?.safeToSpend       ?? 0}
            expectedThisWeek={sts?.expectedThisWeek ?? 0}
            taxThisMonth={taxThisMonth}
            statusKey={statusKey}
            hasBankBalance={hasBankBalance}
          />
        </section>

        {/* ══ Section 2 — Collections this week (unchanged) ═════════════ */}

        <section aria-labelledby="collections-heading">
          <SectionDivider label="Collections this week" />
          {/*
            ZentraWeeklyDigest is rendered exactly as before.
            It is a "use client" component that reads from localStorage;
            its props, data fetching, and internal structure are untouched.
          */}
          <ZentraWeeklyDigest />
        </section>

      </div>
    </AppShell>
  );
}
