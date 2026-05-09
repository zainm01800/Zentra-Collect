"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, Clock, Loader2 } from "lucide-react";
import type { UsageSnapshot, UsageMeter } from "@/lib/usage/tracker";

// ── Meter bar ─────────────────────────────────────────────────────────────────

function MeterBar({ meter }: { meter: UsageMeter }) {
  if (meter.limit === null) {
    // Unlimited — informational counter only
    return (
      <div className="flex items-center justify-between text-sm">
        <span className="text-neutral-600">{meter.label}</span>
        <span className="font-medium tabular-nums text-neutral-950">{meter.used.toLocaleString("en-GB")}</span>
      </div>
    );
  }

  const pct = meter.percentUsed ?? 0;
  const barColor =
    pct >= 95
      ? "bg-red-500"
      : pct >= 80
      ? "bg-amber-400"
      : "bg-emerald-500";
  const textColor =
    pct >= 95 ? "text-red-600" : pct >= 80 ? "text-amber-600" : "text-neutral-500";

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-neutral-700">{meter.label}</span>
        <span className={`font-medium tabular-nums ${pct >= 80 ? textColor : "text-neutral-500"}`}>
          {meter.used.toLocaleString("en-GB")}
          <span className="font-normal text-neutral-400">
            {" / "}
            {meter.limit.toLocaleString("en-GB")}
          </span>
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
      {meter.resetsMonthly && meter.remaining !== null && (
        <p className="text-xs text-neutral-400">
          {meter.remaining.toLocaleString("en-GB")} remaining this month
        </p>
      )}
    </div>
  );
}

// ── Trial banner ──────────────────────────────────────────────────────────────

function TrialBanner({ snapshot }: { snapshot: UsageSnapshot }) {
  if (!snapshot.isTrial) return null;

  if (snapshot.isExpired) {
    return (
      <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-red-500" />
        <div>
          <p className="text-sm font-semibold text-red-700">Trial expired</p>
          <p className="mt-0.5 text-xs leading-5 text-red-600">
            Your data is still visible. New imports and AI actions require a paid plan.
          </p>
          <Link
            href="/pricing"
            className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-red-700 underline underline-offset-2 hover:text-red-900"
          >
            View plans <ArrowRight className="size-3" />
          </Link>
        </div>
      </div>
    );
  }

  const days = snapshot.trialDaysRemaining ?? 0;
  const urgency = days <= 3;

  return (
    <div
      className={`flex items-start gap-2.5 rounded-xl border px-3.5 py-3 ${
        urgency
          ? "border-amber-200 bg-amber-50"
          : "border-black/8 bg-neutral-50"
      }`}
    >
      <Clock className={`mt-0.5 size-4 shrink-0 ${urgency ? "text-amber-500" : "text-neutral-400"}`} />
      <div>
        <p className={`text-sm font-semibold ${urgency ? "text-amber-800" : "text-neutral-700"}`}>
          {days === 0 ? "Trial ends today" : `${days} day${days === 1 ? "" : "s"} left in trial`}
        </p>
        {urgency && (
          <Link
            href="/pricing"
            className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-amber-700 underline underline-offset-2 hover:text-amber-900"
          >
            Upgrade now <ArrowRight className="size-3" />
          </Link>
        )}
      </div>
    </div>
  );
}

// ── Plan badge ────────────────────────────────────────────────────────────────

function PlanBadge({ snapshot }: { snapshot: UsageSnapshot }) {
  const label =
    snapshot.tier === "free"
      ? "Demo"
      : snapshot.isTrial
      ? "Free trial"
      : snapshot.planName;

  const style =
    snapshot.tier === "paid"
      ? "bg-neutral-950 text-white"
      : "bg-neutral-100 text-neutral-600";

  return (
    <div className="flex items-center justify-between">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-400">
        Plan &amp; usage
      </p>
      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${style}`}>
        {label}
      </span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function UsageMeters() {
  const [snapshot, setSnapshot] = useState<UsageSnapshot | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/api/usage")
      .then((res) => {
        if (!res.ok) throw new Error("Failed");
        return res.json() as Promise<UsageSnapshot>;
      })
      .then(setSnapshot)
      .catch(() => setError(true));
  }, []);

  if (error) {
    return (
      <p className="text-xs text-neutral-400">
        Usage data unavailable.
      </p>
    );
  }

  if (!snapshot) {
    return (
      <div className="flex items-center gap-2 text-xs text-neutral-400">
        <Loader2 className="size-3.5 animate-spin" />
        Loading usage…
      </div>
    );
  }

  const { meters } = snapshot;

  // Meters to always show (core limits)
  const primaryMeters: UsageMeter[] = [
    meters.aiActions,
    meters.imports,
    meters.activeInvoices,
  ];

  // Secondary meters (less critical, still shown)
  const secondaryMeters: UsageMeter[] = [
    meters.clientLedgers,
    meters.savedImportMappings,
    meters.weeklyDigests,
  ];

  // Monthly period display e.g. "May 2026"
  const periodLabel = snapshot.periodKey
    ? new Date(`${snapshot.periodKey}-01`).toLocaleString("en-GB", {
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <div className="space-y-4">
      <PlanBadge snapshot={snapshot} />

      <TrialBanner snapshot={snapshot} />

      {/* Primary meters */}
      <div className="space-y-4">
        {primaryMeters.map((m) => (
          <MeterBar key={m.label} meter={m} />
        ))}
      </div>

      {/* Divider */}
      <div className="border-t border-black/6" />

      {/* Secondary meters */}
      <div className="space-y-3">
        {secondaryMeters.map((m) => (
          <MeterBar key={m.label} meter={m} />
        ))}
      </div>

      {/* Period note */}
      {periodLabel && !snapshot.isTrial && (
        <p className="text-xs text-neutral-400">
          Monthly counters reset at the start of each month.
          Current period: {periodLabel}.
        </p>
      )}

      {/* Upgrade link for non-paid plans */}
      {snapshot.tier !== "paid" && !snapshot.isExpired && (
        <Link
          href="/pricing"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-600 transition-colors hover:text-neutral-950"
        >
          View paid plans <ArrowRight className="size-3.5" />
        </Link>
      )}
    </div>
  );
}
