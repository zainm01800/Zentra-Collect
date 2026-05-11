"use client";

/**
 * src/components/account-billing.tsx
 *
 * Account & Billing settings page — 6 sections:
 *   1. Current plan (name, price, status, trial countdown, founding note)
 *   2. Usage (all meters against plan limits)
 *   3. Upgrade options (smart recommendation based on current usage)
 *   4. Data retention (grace period, deletion warning, export/delete placeholders)
 *   5. Safety controls (static — human approval, auto-send off, no legal advice)
 *   6. Billing (Stripe placeholder, founding access link)
 *
 * Data source: GET /api/usage → UsageSnapshot
 * Plan data: src/lib/billing/plans.ts (never hardcoded here)
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Download,
  Loader2,
  Lock,
  Shield,
  ShieldCheck,
  TrendingUp,
  Trash2,
  UserCheck,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { UsageMeter, UsageSnapshot } from "@/lib/usage/tracker";
import { getPlan, type Plan } from "@/lib/billing/plans";

// ── Upgrade recommendation logic ──────────────────────────────────────────────

interface UpgradeRecommendation {
  plan: Plan;
  reason: string;
  urgency: "normal" | "high";
}

function computeUpgradeRecommendation(
  snapshot: UsageSnapshot,
): UpgradeRecommendation | null {
  const { tier, planId, meters, isExpired } = snapshot;

  // Demo → always suggest trial
  if (tier === "free") {
    return {
      plan: getPlan("trial"),
      reason:
        "Start a 14-day free trial to import your own invoices — no card required.",
      urgency: "normal",
    };
  }

  // Trial → suggest single or bookkeeper starter depending on client count
  if (tier === "trial") {
    const hasMultipleClients = meters.clientLedgers.used > 1;
    return {
      plan: getPlan(
        hasMultipleClients ? "bookkeeper_starter" : "single_business",
      ),
      reason: isExpired
        ? "Your trial has expired. Upgrade to resume imports and AI actions."
        : hasMultipleClients
          ? "You're managing more than one client — Bookkeeper Starter is built for that."
          : "Keep your data and lift the trial limits with Single Business.",
      urgency: isExpired ? "high" : "normal",
    };
  }

  // Single business → suggest Starter if at ledger limit or high usage
  if (planId === "single_business") {
    const atLedgerLimit = meters.clientLedgers.isAtLimit;
    const aiPct = meters.aiActions.percentUsed ?? 0;
    const invoicePct = meters.activeInvoices.percentUsed ?? 0;

    if (atLedgerLimit) {
      return {
        plan: getPlan("bookkeeper_starter"),
        reason:
          "You've reached your client ledger limit. Bookkeeper Starter supports up to 5.",
        urgency: "high",
      };
    }
    if (aiPct >= 75) {
      return {
        plan: getPlan("bookkeeper_starter"),
        reason: `You've used ${aiPct}% of your AI actions this month. Bookkeeper Starter has 2.5× more.`,
        urgency: aiPct >= 90 ? "high" : "normal",
      };
    }
    if (invoicePct >= 80) {
      return {
        plan: getPlan("bookkeeper_starter"),
        reason: `You're at ${invoicePct}% of your active invoice limit. Starter supports 2,000.`,
        urgency: invoicePct >= 95 ? "high" : "normal",
      };
    }
    return null;
  }

  // Bookkeeper Starter → suggest Pro if at ledger limit or high AI usage
  if (planId === "bookkeeper_starter") {
    const atLedgerLimit = meters.clientLedgers.isAtLimit;
    const aiPct = meters.aiActions.percentUsed ?? 0;

    if (atLedgerLimit) {
      return {
        plan: getPlan("bookkeeper_pro"),
        reason:
          "You've reached your ledger limit. Bookkeeper Pro supports up to 20 clients.",
        urgency: "high",
      };
    }
    if (aiPct >= 75) {
      return {
        plan: getPlan("bookkeeper_pro"),
        reason: `You've used ${aiPct}% of your AI actions this month. Bookkeeper Pro has 3× more.`,
        urgency: aiPct >= 90 ? "high" : "normal",
      };
    }
    return null;
  }

  // Already on Pro — no further upgrade available
  return null;
}

// ── Section heading ───────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-400">
      {children}
    </p>
  );
}

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ snapshot }: { snapshot: UsageSnapshot }) {
  if (snapshot.isExpired) {
    return (
      <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700">
        Expired
      </span>
    );
  }
  if (snapshot.isTrial) {
    return (
      <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
        Free trial
      </span>
    );
  }
  if (snapshot.tier === "free") {
    return (
      <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-semibold text-neutral-600">
        Demo
      </span>
    );
  }
  return (
    <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
      Active
    </span>
  );
}

// ── Usage meter row ───────────────────────────────────────────────────────────

function MeterRow({ meter }: { meter: UsageMeter }) {
  // Unlimited (null limit) — informational counter, full green bar
  if (meter.limit === null) {
    return (
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-sm">
          <span className="text-neutral-600">{meter.label}</span>
          <span className="tabular-nums text-neutral-950">
            {meter.used.toLocaleString("en-GB")}
            <span className="text-neutral-400"> / included</span>
          </span>
        </div>
        <div className="h-1 w-full rounded-full bg-neutral-100">
          <div className="h-full w-1/3 rounded-full bg-emerald-200" />
        </div>
      </div>
    );
  }

  const pct = meter.percentUsed ?? 0;
  const barColor =
    pct >= 95 ? "bg-red-500" : pct >= 80 ? "bg-amber-400" : "bg-emerald-500";
  const valueColor =
    pct >= 95 ? "text-red-600" : pct >= 80 ? "text-amber-600" : "text-neutral-950";

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-neutral-600">{meter.label}</span>
        <span className={`tabular-nums font-medium ${pct >= 80 ? valueColor : "text-neutral-950"}`}>
          {meter.used.toLocaleString("en-GB")}
          <span className="font-normal text-neutral-400">
            {" / "}
            {meter.limit.toLocaleString("en-GB")}
          </span>
        </span>
      </div>
      <div className="h-1 w-full overflow-hidden rounded-full bg-neutral-100">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
      {meter.isAtLimit && (
        <p className="text-xs font-medium text-red-600">
          Limit reached — upgrade to continue.
        </p>
      )}
      {!meter.isAtLimit && meter.remaining !== null && pct >= 80 && (
        <p className={`text-xs ${pct >= 95 ? "text-red-500" : "text-amber-600"}`}>
          {meter.remaining.toLocaleString("en-GB")} remaining
        </p>
      )}
    </div>
  );
}

// ── Safety control row ────────────────────────────────────────────────────────

const SAFETY_CONTROLS = [
  {
    Icon: UserCheck,
    label: "Human approval required",
    detail:
      "Every message must be reviewed and copied by you. Nothing is sent on your behalf.",
  },
  {
    Icon: ShieldCheck,
    label: "Auto-send disabled",
    detail:
      "Zentra Flow never sends emails automatically — by design, not just by default.",
  },
  {
    Icon: Shield,
    label: "No legal advice",
    detail:
      "Draft messages do not constitute legal or debt-collection advice. Review before use.",
  },
  {
    Icon: Zap,
    label: "AI drafts require your review",
    detail:
      "AI-generated text is a starting point. Always read it critically before copying.",
  },
] as const;

// ── Main component ────────────────────────────────────────────────────────────

export function AccountBilling() {
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
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
        Could not load account data. Refresh to try again.
      </div>
    );
  }

  if (!snapshot) {
    return (
      <div className="flex items-center gap-2 py-16 text-sm text-neutral-400">
        <Loader2 className="size-4 animate-spin" />
        Loading account…
      </div>
    );
  }

  const currentPlan = getPlan(snapshot.planId);
  const recommendation = computeUpgradeRecommendation(snapshot);
  const periodLabel = snapshot.periodKey
    ? new Date(`${snapshot.periodKey}-01`).toLocaleString("en-GB", {
        month: "long",
        year: "numeric",
      })
    : null;

  // Trial progress: days used out of 14
  const trialDaysUsed =
    snapshot.trialDaysRemaining !== null
      ? Math.max(0, 14 - snapshot.trialDaysRemaining)
      : 0;
  const trialProgressPct = Math.min(100, Math.round((trialDaysUsed / 14) * 100));

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
      {/* ── Left column: Plan + Usage + Upgrade ──────────────────────────────── */}
      <div className="space-y-5">

        {/* 1 ── Current plan ─────────────────────────────────────────────────── */}
        <Card className="rounded-xl border-black/8">
          <CardHeader className="pb-2">
            <SectionLabel>Current plan</SectionLabel>
          </CardHeader>
          <CardContent className="space-y-4">

            {/* Plan name + status */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-2xl font-semibold text-neutral-950">
                  {currentPlan.name}
                </p>
                <p className="mt-0.5 text-sm leading-6 text-neutral-500">
                  {currentPlan.tagline}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2">
                <StatusBadge snapshot={snapshot} />
                {currentPlan.price > 0 && (
                  <p className="tabular-nums text-lg font-semibold text-neutral-950">
                    {currentPlan.priceDisplay}
                    <span className="text-sm font-normal text-neutral-400">
                      {currentPlan.periodDisplay}
                    </span>
                  </p>
                )}
              </div>
            </div>

            {/* Trial countdown bar */}
            {snapshot.isTrial && !snapshot.isExpired && snapshot.trialDaysRemaining !== null && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="size-4 text-amber-600" />
                    <span className="text-sm font-medium text-amber-800">
                      {snapshot.trialDaysRemaining === 0
                        ? "Trial ends today"
                        : `${snapshot.trialDaysRemaining} day${snapshot.trialDaysRemaining === 1 ? "" : "s"} remaining`}
                    </span>
                  </div>
                  <span className="tabular-nums text-xs text-amber-600">
                    {trialDaysUsed} / 14 days used
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-amber-200">
                  <div
                    className="h-full rounded-full bg-amber-500 transition-all"
                    style={{ width: `${trialProgressPct}%` }}
                  />
                </div>
              </div>
            )}

            {/* Trial expired warning */}
            {snapshot.isExpired && (
              <div className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-3">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-red-500" />
                <div>
                  <p className="text-sm font-semibold text-red-700">Trial expired</p>
                  <p className="mt-0.5 text-xs leading-5 text-red-600">
                    Your data is still visible. New imports and AI actions require a
                    paid plan.
                  </p>
                </div>
              </div>
            )}

            {/* Founding price lock (paid plans only) */}
            {snapshot.tier === "paid" && (
              <div className="flex items-center gap-2.5 rounded-lg border border-black/8 bg-neutral-50 px-3.5 py-2.5">
                <Lock className="size-3.5 shrink-0 text-neutral-400" />
                <p className="text-xs text-neutral-600">
                  Founding access —{" "}
                  <span className="font-semibold">
                    {currentPlan.priceDisplay}{currentPlan.periodDisplay}
                  </span>{" "}
                  locked for your account. Price will not change without notice.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 2 ── Usage ────────────────────────────────────────────────────────── */}
        <Card className="rounded-xl border-black/8">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <SectionLabel>Usage</SectionLabel>
              {periodLabel && !snapshot.isTrial && (
                <span className="text-xs text-neutral-400">{periodLabel}</span>
              )}
              {snapshot.isTrial && (
                <span className="text-xs text-neutral-400">Lifetime trial totals</span>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-5">

            {/* Primary counters */}
            <div className="space-y-4">
              <MeterRow meter={snapshot.meters.aiActions} />
              <MeterRow meter={snapshot.meters.imports} />
              <MeterRow meter={snapshot.meters.activeInvoices} />
            </div>

            {/* Secondary counters */}
            <div className="border-t border-black/6 pt-4 space-y-4">
              <MeterRow meter={snapshot.meters.clientLedgers} />
              <MeterRow meter={snapshot.meters.savedImportMappings} />
              <MeterRow meter={snapshot.meters.weeklyDigests} />
            </div>

            {/* Period note */}
            {!snapshot.isTrial && periodLabel && (
              <p className="text-xs leading-5 text-neutral-400">
                AI actions and imports reset monthly. Active invoices, ledgers, and
                templates reflect current state and do not reset.
              </p>
            )}
            {snapshot.isTrial && (
              <p className="text-xs leading-5 text-neutral-400">
                Trial counters are lifetime totals — not monthly. They reset when you
                upgrade to a paid plan.
              </p>
            )}
          </CardContent>
        </Card>

        {/* 3 ── Upgrade options ───────────────────────────────────────────────── */}
        {recommendation && (
          <Card
            className={`rounded-xl ${
              recommendation.urgency === "high"
                ? "border-red-200 bg-red-50/30"
                : "border-neutral-300"
            }`}
          >
            <CardHeader className="pb-2">
              <SectionLabel>
                {recommendation.urgency === "high" ? "Action needed" : "Upgrade path"}
              </SectionLabel>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <div
                  className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${
                    recommendation.urgency === "high"
                      ? "bg-red-100"
                      : "bg-neutral-100"
                  }`}
                >
                  <TrendingUp
                    className={`size-4 ${
                      recommendation.urgency === "high"
                        ? "text-red-600"
                        : "text-neutral-600"
                    }`}
                  />
                </div>
                <div>
                  <div className="flex items-baseline gap-2">
                    <p className="text-base font-semibold text-neutral-950">
                      {recommendation.plan.name}
                    </p>
                    {recommendation.plan.price > 0 && (
                      <span className="text-sm text-neutral-500">
                        {recommendation.plan.priceDisplay}
                        {recommendation.plan.periodDisplay}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-sm leading-6 text-neutral-600">
                    {recommendation.reason}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  asChild
                  className="rounded-full bg-neutral-950 text-white hover:bg-neutral-800"
                >
                  <Link href={recommendation.plan.href}>
                    {recommendation.plan.tier === "trial"
                      ? "Start free trial"
                      : "Request founding access"}
                    <ArrowRight className="size-3.5" />
                  </Link>
                </Button>
                <Link
                  href="/pricing"
                  className="text-sm font-medium text-neutral-500 underline underline-offset-2 hover:text-neutral-800"
                >
                  See all plans
                </Link>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Within limits — no upgrade nudge */}
        {!recommendation && snapshot.tier === "paid" && (
          <div className="flex items-center gap-3 rounded-xl border border-black/8 bg-neutral-50 px-4 py-3">
            <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
            <p className="text-sm text-neutral-600">
              You&apos;re comfortably within your plan limits.{" "}
              <Link
                href="/pricing"
                className="font-medium text-neutral-950 underline underline-offset-2 hover:text-neutral-700"
              >
                Compare plans
              </Link>{" "}
              if your needs change.
            </p>
          </div>
        )}
      </div>

      {/* ── Right column: Data retention + Safety + Billing ──────────────────── */}
      <div className="space-y-5">

        {/* 4 ── Data retention ────────────────────────────────────────────────── */}
        <Card className="rounded-xl border-black/8">
          <CardHeader className="pb-2">
            <SectionLabel>Data &amp; privacy</SectionLabel>
          </CardHeader>
          <CardContent className="space-y-4">

            {/* Trial — grace period explanation */}
            {snapshot.isTrial && !snapshot.isExpired && (
              <div className="space-y-1.5">
                <p className="text-sm font-medium text-neutral-800">
                  Trial grace period
                </p>
                <p className="text-xs leading-5 text-neutral-500">
                  When your trial ends, your imported invoices and chase plan stay
                  visible for{" "}
                  <span className="font-medium text-neutral-700">30 days</span>.
                  New imports and AI actions pause until you upgrade. After 30 days,
                  data is queued for deletion.
                </p>
              </div>
            )}

            {/* Expired — within grace period */}
            {snapshot.isExpired && snapshot.isInGracePeriod && (
              <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-3">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" />
                <div>
                  <p className="text-sm font-semibold text-amber-800">
                    Data retained — upgrade to keep it
                  </p>
                  <p className="mt-0.5 text-xs leading-5 text-amber-700">
                    {snapshot.gracePeriodDaysRemaining === 0
                      ? "Your data is retained until the end of today."
                      : `Your data is retained for ${snapshot.gracePeriodDaysRemaining} more day${snapshot.gracePeriodDaysRemaining === 1 ? "" : "s"}.`}{" "}
                    Upgrade now to keep your imported invoices and chase history.
                  </p>
                </div>
              </div>
            )}

            {/* Expired — grace period over */}
            {snapshot.isExpired && !snapshot.isInGracePeriod && (
              <div className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-3">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-red-500" />
                <div>
                  <p className="text-sm font-semibold text-red-700">
                    Grace period ended
                  </p>
                  <p className="mt-0.5 text-xs leading-5 text-red-600">
                    Your 30-day retention window has closed. Upgrade now to
                    recover your data before the scheduled deletion runs.
                  </p>
                </div>
              </div>
            )}

            {/* Paid — retention assurance */}
            {snapshot.tier === "paid" && (
              <p className="text-xs leading-5 text-neutral-500">
                Data is retained while your plan is active. Cancellation starts a
                30-day wind-down period before any deletion occurs.
              </p>
            )}

            {/* Demo — no personal data */}
            {snapshot.tier === "free" && (
              <p className="text-xs leading-5 text-neutral-500">
                Demo mode uses only pre-loaded sample data. No personal or business
                data is stored or retained.
              </p>
            )}

            {/* Export / delete placeholders */}
            <div className="border-t border-black/6 pt-3 space-y-2">
              <p className="text-xs font-medium text-neutral-500">Account actions</p>
              <Button
                variant="outline"
                size="sm"
                disabled
                className="w-full justify-start gap-2 rounded-lg text-neutral-400 disabled:opacity-60"
              >
                <Download className="size-3.5" />
                Export all data (CSV)
                <span className="ml-auto rounded bg-neutral-100 px-1.5 py-0.5 text-[0.65rem] font-medium text-neutral-400">
                  Coming soon
                </span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled
                className="w-full justify-start gap-2 rounded-lg text-neutral-400 disabled:opacity-60"
              >
                <Trash2 className="size-3.5" />
                Delete account &amp; data
                <span className="ml-auto rounded bg-neutral-100 px-1.5 py-0.5 text-[0.65rem] font-medium text-neutral-400">
                  Coming soon
                </span>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 5 ── Safety controls ────────────────────────────────────────────────── */}
        <Card className="rounded-xl border-black/8">
          <CardHeader className="pb-2">
            <SectionLabel>Safety controls</SectionLabel>
          </CardHeader>
          <CardContent className="space-y-4">
            {SAFETY_CONTROLS.map(({ Icon, label, detail }) => (
              <div key={label} className="flex items-start gap-3">
                <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-neutral-100">
                  <Icon className="size-3.5 text-neutral-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-neutral-800">{label}</p>
                  <p className="text-xs leading-5 text-neutral-500">{detail}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* 6 ── Billing ────────────────────────────────────────────────────────── */}
        <Card className="rounded-xl border-black/8">
          <CardHeader className="pb-2">
            <SectionLabel>Billing</SectionLabel>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm leading-6 text-neutral-500">
              Billing is managed manually during the founding period. You won&apos;t be charged until billing goes live.
            </p>

            {/* Non-paid — show request access CTA */}
            {snapshot.tier !== "paid" && (
              <Button
                asChild
                variant="outline"
                className="w-full rounded-full border-black/15 hover:bg-neutral-50"
              >
                <Link href="/request-access">
                  Request founding access
                  <ArrowRight className="size-3.5" />
                </Link>
              </Button>
            )}

            {/* Paid — managed note */}
            {snapshot.tier === "paid" && (
              <div className="flex items-center gap-2.5 rounded-lg bg-neutral-50 px-3.5 py-2.5">
                <Lock className="size-3.5 shrink-0 text-neutral-400" />
                <p className="text-xs text-neutral-600">
                  Your billing is managed directly.{" "}
                  <a href="mailto:hello@zentra.co" className="underline underline-offset-2 hover:text-neutral-900">
                    Email us
                  </a>{" "}
                  to make changes to your plan.
                </p>
              </div>
            )}

            {/* TODO: Replace with <StripePortalButton accountId={...} /> when Stripe is live */}
            <p className="text-xs text-neutral-400">
              VAT included where applicable · No contract · Cancel anytime
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
