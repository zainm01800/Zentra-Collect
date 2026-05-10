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
    <span className="inline-flex items-center rounded-full border border-[#d4c9ae] bg-[#faf5e8] px-3 py-1 text-xs font-medium text-[#3d3428]">
      {plan.name}
    </span>
  );
}

export function TrialCountdownBadge({ account }: { account: AccountLike }) {
  const accountState = toAccountState(account);
  const trialState = getTrialState(accountState);

  if (accountState.planId === "DEMO") {
    return (
      <span className="inline-flex items-center rounded-full border border-[#d4c9ae] bg-[#faf5e8] px-3 py-1 text-xs font-medium text-[#3d3428]">
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
    <div className="rounded-2xl border border-[#d4c9ae] bg-[#faf5e8] p-3">
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="font-medium text-[#3d3428]">{label}</span>
        <span className="text-[#8d8472]">
          {used} / {limit === "unlimited" ? "unlimited" : limit}
        </span>
      </div>
      {limit !== "unlimited" ? (
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-neutral-200">
          <div
            className="h-full rounded-full bg-[#1d1813]"
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
      <div className="w-full max-w-md rounded-[2rem] border border-[#d4c9ae] bg-[#faf5e8] p-5 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-lg font-semibold text-[#1d1813]">{title}</p>
            <p className="mt-2 text-sm leading-6 text-[#6b6253]">
              {result?.reason ??
                "You've reached a plan limit. Upgrade to continue using this feature."}
            </p>
            {typeof result?.limit === "number" ? (
              <p className="mt-3 text-xs text-[#8d8472]">
                Used {result.used ?? 0} of {result.limit}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-[#d4c9ae] bg-[#faf5e8] p-2"
            aria-label="Close limit reached modal"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <Button asChild className="rounded-full bg-[#1d1813] text-white hover:bg-[#3d3428]">
            <Link href="/#pricing">Upgrade</Link>
          </Button>
          <Button asChild variant="outline" className="rounded-full border-[#d4c9ae] bg-transparent">
            <Link href="/#pricing">View pricing</Link>
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
    <div className="rounded-3xl border border-[#d4c9ae] bg-[#faf5e8] p-6">
      <p className="text-lg font-semibold text-[#1d1813]">{title}</p>
      <p className="mt-2 text-sm leading-6 text-[#6b6253]">{description}</p>
      {recommendedPlan ? (
        <p className="mt-3 text-xs uppercase tracking-[0.16em] text-[#a09885]">
          Recommended: {recommendedPlan}
        </p>
      ) : null}
      <div className="mt-5 flex flex-wrap gap-3">
        <Button asChild className="rounded-full bg-[#1d1813] text-white hover:bg-[#3d3428]">
          <Link href="/#pricing">View pricing</Link>
        </Button>
        <Button asChild variant="outline" className="rounded-full border-[#d4c9ae] bg-transparent">
          <Link href="/beta-request">Request founding access</Link>
        </Button>
      </div>
    </div>
  );
}

export function DemoModeBanner() {
  return (
    <div className="rounded-2xl border border-[#d4c9ae] bg-[#faf5e8] p-3 text-[#1d1813] shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#1d1813] text-white">
            <BarChart3 className="size-4" />
          </span>
          <div>
            <p className="text-sm font-semibold">Demo workspace</p>
            <p className="mt-1 text-sm leading-6 text-[#6b6253]">
              Sample data only: {"\u00A3"}18,420 needing attention, 7 actions,
              3 exceptions, and 2 promises to check.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button asChild size="sm" className="rounded-full bg-[#1d1813] text-white hover:bg-[#3d3428]">
            <Link href="/onboarding">Start 14-day trial</Link>
          </Button>
          <Button asChild size="sm" variant="outline" className="rounded-full border-[#d4c9ae] bg-transparent">
            <Link href="/beta-request">Request bookkeeper beta</Link>
          </Button>
          <Button asChild size="sm" variant="ghost" className="rounded-full text-[#6b6253]">
            <Link href="/#pricing">View pricing</Link>
          </Button>
        </div>
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
    <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-amber-950">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-3">
          <Clock3 className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="font-semibold">
              {afterGrace ? "Your trial data is scheduled for deletion." : "Your trial has ended."}
            </p>
            <p className="mt-1 text-sm leading-6 text-amber-900">
              {afterGrace
                ? "Export or upgrade to keep it. New imports and AI actions require an upgrade."
                : "You can still view your data, but new imports and AI actions require an upgrade."}
            </p>
          </div>
        </div>
        <Button asChild className="rounded-full bg-[#1d1813] text-white hover:bg-[#3d3428]">
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
    <div className="rounded-3xl border border-[#d4c9ae] bg-[#faf5e8] p-4">
      <div className="flex gap-3">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-700" />
        <p className="text-sm leading-6 text-[#6b6253]">
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
    <div className="rounded-3xl border border-[#d4c9ae] bg-[#faf5e8] p-6">
      <div className="flex size-10 items-center justify-center rounded-2xl bg-[#faf5e8] text-[#1d1813]">
        <LockKeyhole className="size-4" />
      </div>
      <p className="mt-5 text-lg font-semibold text-[#1d1813]">{title}</p>
      <p className="mt-2 text-sm leading-6 text-[#6b6253]">
        {result?.reason ?? description}
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        <Button asChild className="rounded-full bg-[#1d1813] text-white hover:bg-[#3d3428]">
          <Link href="/#pricing">View pricing</Link>
        </Button>
        <Button asChild variant="outline" className="rounded-full border-[#d4c9ae] bg-transparent">
          <Link href="/beta-request">Request founding access</Link>
        </Button>
      </div>
    </div>
  );
}
