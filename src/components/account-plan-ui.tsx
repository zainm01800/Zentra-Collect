"use client";

import Link from "next/link";
import { AlertTriangle, BarChart3, Clock3, LockKeyhole, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getPlanConfig,
  getPlanLimit,
  getTrialDaysRemaining,
  getTrialState,
  type AccountState,
  type UsageType,
} from "@/lib/account/plans";
import {
  requirePlanAccess,
  toAccountState,
  type PlanAccessResult,
} from "@/lib/account/access";
import { getUsageSnapshot } from "@/lib/account/usage";
import type { BillingAccount as LegacyBillingAccount } from "@/lib/billing/plans";

type AccountLike = AccountState | LegacyBillingAccount;

export function PlanBadge({ account }: { account: AccountLike }) {
  const accountState = toAccountState(account);
  const plan = getPlanConfig(accountState.planId);

  return (
    <span className="inline-flex items-center rounded-full border border-black/10 dark:border-white/10 bg-white/70 dark:bg-[#28231c] px-3 py-1 text-xs font-medium text-neutral-700 dark:text-[#d8ccb5]">
      {plan.name}
    </span>
  );
}

export function TrialCountdownBadge({ account }: { account: AccountLike }) {
  const accountState = toAccountState(account);
  const trialState = getTrialState(accountState);

  if (accountState.planId === "DEMO") {
    return (
      <span className="inline-flex items-center rounded-full border border-black/10 dark:border-white/10 bg-white/70 dark:bg-[#28231c] px-3 py-1 text-xs font-medium text-neutral-700 dark:text-[#d8ccb5]">
        Demo sample data
      </span>
    );
  }

  if (trialState === "not_trial") return null;

  return (
    <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800">
      {trialState === "active"
        ? `Trial: ${getTrialDaysRemaining(accountState)} days left`
        : trialState === "expired_in_grace"
          ? "Trial ended"
          : "Trial expired"}
    </span>
  );
}

export function UsageMeter({
  account,
  usageType,
  label,
}: {
  account: AccountLike;
  usageType: UsageType;
  label: string;
}) {
  const accountState = toAccountState(account);
  const snapshot = getUsageSnapshot(accountState);
  const used = snapshot.counters[usageType];
  const limit = getPlanLimit(accountState.planId, usageType);
  const percent = limit === "unlimited" ? 0 : Math.min(100, (used / limit) * 100);

  return (
    <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-[#28231c] p-3">
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="font-medium text-neutral-700 dark:text-[#d8ccb5]">{label}</span>
        <span className="text-neutral-500 dark:text-[#8a7d69]">
          {used} / {limit === "unlimited" ? "unlimited" : limit}
        </span>
      </div>
      {limit !== "unlimited" ? (
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-neutral-200 dark:bg-[#2d2820]">
          <div
            className="h-full rounded-full bg-neutral-950"
            style={{ width: `${percent}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}

export function LimitReachedModal({
  open,
  title = "Limit reached",
  result,
  onClose,
}: {
  open: boolean;
  title?: string;
  result?: PlanAccessResult;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-[2rem] border border-black/10 dark:border-white/10 bg-[#fbf8f1] dark:bg-[#211d17] p-5 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-lg font-semibold text-neutral-950 dark:text-[#f0e8d5]">{title}</p>
            <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-[#8a7d69]">
              {result?.reason ??
                "You've reached a plan limit. Upgrade to continue using this feature."}
            </p>
            {typeof result?.limit === "number" ? (
              <p className="mt-3 text-xs text-neutral-500 dark:text-[#8a7d69]">
                Used {result.used ?? 0} of {result.limit}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-black/10 dark:border-white/10 bg-white/70 dark:bg-[#28231c] p-2"
            aria-label="Close limit reached modal"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <Button asChild className="rounded-full bg-neutral-950 text-white hover:bg-neutral-800">
            <Link href="/#pricing">Upgrade</Link>
          </Button>
          <Button asChild variant="outline" className="rounded-full border-black/10 dark:border-white/10 bg-transparent">
            <Link href="/pricing">View pricing</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

export function UpgradePromptCard({
  title = "Upgrade when you're ready",
  description,
  recommendedPlan,
}: {
  title?: string;
  description: string;
  recommendedPlan?: string;
}) {
  return (
    <div className="rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-[#28231c] p-6">
      <p className="text-lg font-semibold text-neutral-950 dark:text-[#f0e8d5]">{title}</p>
      <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-[#8a7d69]">{description}</p>
      {recommendedPlan ? (
        <p className="mt-3 text-xs uppercase tracking-[0.16em] text-neutral-400">
          Recommended: {recommendedPlan}
        </p>
      ) : null}
      <div className="mt-5 flex flex-wrap gap-3">
        <Button asChild className="rounded-full bg-neutral-950 text-white hover:bg-neutral-800">
          <Link href="/#pricing">View pricing</Link>
        </Button>
        <Button asChild variant="outline" className="rounded-full border-black/10 dark:border-white/10 bg-transparent">
          <Link href="/beta-request">Request founding access</Link>
        </Button>
      </div>
    </div>
  );
}

export function DemoModeBanner() {
  return (
    <div className="rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#211d17] px-4 py-3 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-neutral-950 text-white">
            <BarChart3 className="size-3.5" />
          </span>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-neutral-950 dark:text-[#f0e8d5]">Demo workspace</p>
            <p className="hidden text-[12px] text-neutral-500 dark:text-[#8a7d69] sm:block">You&apos;re viewing sample data. Start a trial to upload your own invoices.</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button asChild size="sm" className="h-8 rounded-full bg-neutral-950 px-4 text-[12px] font-semibold text-white hover:bg-neutral-800">
            <Link href="/onboarding">Start 14-day trial</Link>
          </Button>
          <Button asChild size="sm" variant="outline" className="hidden h-8 rounded-full border-black/10 dark:border-white/10 bg-transparent px-4 text-[12px] font-semibold sm:flex">
            <Link href="/#pricing">View pricing</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

export function ActiveTrialBanner({ account }: { account: AccountLike }) {
  const accountState = toAccountState(account);
  const trialState = getTrialState(accountState);
  if (trialState !== "active") return null;

  const daysLeft = getTrialDaysRemaining(accountState);

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-amber-500 text-white">
            <Clock3 className="size-3.5" />
          </span>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-amber-950">Trial: {daysLeft} days left</p>
            <p className="hidden text-[12px] text-amber-800 sm:block">Imports and AI actions are limited during trial.</p>
          </div>
        </div>
        <Button asChild size="sm" className="h-8 shrink-0 rounded-full bg-neutral-950 px-4 text-[12px] font-semibold text-white hover:bg-neutral-800">
          <Link href="/pricing">Upgrade</Link>
        </Button>
      </div>
    </div>
  );
}

export function TrialExpiredBanner({ account }: { account: AccountLike }) {
  const accountState = toAccountState(account);
  const trialState = getTrialState(accountState);
  if (trialState !== "expired_in_grace" && trialState !== "expired_after_grace") {
    return null;
  }
  const afterGrace = trialState === "expired_after_grace";

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <Clock3 className="size-4 shrink-0 text-amber-700" />
          <p className="text-[13px] font-semibold text-amber-950">
            {afterGrace ? "Your trial data is scheduled for deletion." : "Your trial has ended."}
            <span className="ml-2 hidden font-normal text-amber-800 sm:inline">
              {afterGrace
                ? "Export or upgrade to keep it."
                : "You can still view your data, but new imports need an upgrade."}
            </span>
          </p>
        </div>
        <Button asChild size="sm" className="h-8 shrink-0 rounded-full bg-neutral-950 px-4 text-[12px] font-semibold text-white hover:bg-neutral-800">
          <Link href="/#pricing">Upgrade</Link>
        </Button>
      </div>
    </div>
  );
}

export function GracePeriodWarning({ account }: { account: AccountLike }) {
  const accountState = toAccountState(account);
  if (getTrialState(accountState) !== "expired_in_grace") return null;

  const date = accountState.gracePeriodEndsAt
    ? new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(new Date(accountState.gracePeriodEndsAt))
    : "the end of your grace period";

  return (
    <div className="rounded-xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-[#28231c] px-4 py-3">
      <div className="flex items-center gap-2.5">
        <AlertTriangle className="size-4 shrink-0 text-amber-600" />
        <p className="text-[12px] text-neutral-600 dark:text-[#8a7d69]">
          Your trial data remains available until {date}. Export or upgrade to keep using Zentra.
        </p>
      </div>
    </div>
  );
}

export function LockedFeatureCard({
  title = "Feature locked",
  description,
  account,
  action = "bookkeeper_mode",
}: {
  title?: string;
  description: string;
  account?: AccountLike | null;
  action?: Parameters<typeof requirePlanAccess>[1];
}) {
  const result = account ? requirePlanAccess(account, action) : null;

  return (
    <div className="rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-[#28231c] p-6">
      <div className="flex size-10 items-center justify-center rounded-2xl bg-[#fbf8f1] dark:bg-[#211d17] text-neutral-950 dark:text-[#f0e8d5]">
        <LockKeyhole className="size-4" />
      </div>
      <p className="mt-5 text-lg font-semibold text-neutral-950 dark:text-[#f0e8d5]">{title}</p>
      <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-[#8a7d69]">
        {result?.reason ?? description}
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        <Button asChild className="rounded-full bg-neutral-950 text-white hover:bg-neutral-800">
          <Link href="/#pricing">View pricing</Link>
        </Button>
        <Button asChild variant="outline" className="rounded-full border-black/10 dark:border-white/10 bg-transparent">
          <Link href="/beta-request">Request founding access</Link>
        </Button>
      </div>
    </div>
  );
}
