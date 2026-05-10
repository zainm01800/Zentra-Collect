"use client";

import Link from "next/link";
import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getPlanConfig,
  getRemainingUsage,
  getTrialState,
  type BillingAccount,
  type PlanFeature,
  type UsageType,
} from "@/lib/billing/plans";
import { formatAccountExpiry, type DemoUser } from "@/lib/demo-auth";

export function PlanBadge({ account }: { account: BillingAccount }) {
  const plan = getPlanConfig(account.planId);
  return (
    <span className="inline-flex items-center rounded-full border border-[#d4c9ae] bg-[#faf5e8] px-3 py-1 text-xs font-medium text-[#3d3428]">
      {plan.name}
    </span>
  );
}

export function TrialCountdownBadge({
  user,
  account,
}: {
  user: DemoUser;
  account: BillingAccount;
}) {
  const [now] = useState(() => Date.now());
  if (account.planId === "demo") {
    return (
      <span className="inline-flex items-center rounded-full border border-[#d4c9ae] bg-[#faf5e8] px-3 py-1 text-xs font-medium text-[#3d3428]">
        Demo sample data
      </span>
    );
  }

  if (account.planId !== "trial" || !user.trialEndsAt) return null;

  const daysLeft = Math.ceil(
    (new Date(user.trialEndsAt).getTime() - now) / 86_400_000,
  );
  const trialState = getTrialState(account);

  return (
    <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800">
      {trialState === "active"
        ? `Trial: ${Math.max(0, daysLeft)} days left`
        : user.graceEndsAt
          ? `Grace until ${formatAccountExpiry(user.graceEndsAt)}`
          : "Trial expired"}
    </span>
  );
}

export function UsageMeter({
  account,
  usageType,
  label,
}: {
  account: BillingAccount;
  usageType: UsageType;
  label: string;
}) {
  const limit = getPlanConfig(account.planId).limits[usageType];
  const used = account.usage[usageType];
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
          <div className="h-full rounded-full bg-[#1d1813]" style={{ width: `${percent}%` }} />
        </div>
      ) : null}
    </div>
  );
}

export function UsageLimitBanner({
  title,
  description,
  actionLabel = "View plans",
}: {
  title: string;
  description: string;
  actionLabel?: string;
}) {
  return (
    <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-amber-950">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-semibold">{title}</p>
          <p className="mt-1 text-sm leading-6 text-amber-900">{description}</p>
        </div>
        <Button asChild className="rounded-full bg-[#1d1813] text-white hover:bg-[#3d3428]">
          <Link href="/#pricing">{actionLabel}</Link>
        </Button>
      </div>
    </div>
  );
}

export function UpgradePromptModal({
  open,
  title,
  description,
  onClose,
}: {
  open: boolean;
  title: string;
  description: string;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-[2rem] border border-[#d4c9ae] bg-[#faf5e8] p-5 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-lg font-semibold text-[#1d1813]">{title}</p>
            <p className="mt-2 text-sm leading-6 text-[#6b6253]">{description}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-[#d4c9ae] bg-[#faf5e8] p-2"
            aria-label="Close upgrade prompt"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="mt-5 flex gap-3">
          <Button asChild className="rounded-full bg-[#1d1813] text-white hover:bg-[#3d3428]">
            <Link href="/#pricing">View plans</Link>
          </Button>
          <Button type="button" variant="outline" className="rounded-full border-[#d4c9ae] bg-transparent" onClick={onClose}>
            Keep viewing
          </Button>
        </div>
      </div>
    </div>
  );
}

export function LockedFeatureCard({
  title,
  description,
  feature,
}: {
  title: string;
  description: string;
  feature?: PlanFeature;
}) {
  return (
    <div className="rounded-3xl border border-[#d4c9ae] bg-[#faf5e8] p-6">
      <p className="text-lg font-semibold text-[#1d1813]">{title}</p>
      <p className="mt-2 text-sm leading-6 text-[#6b6253]">{description}</p>
      {feature ? (
        <p className="mt-4 text-xs uppercase tracking-[0.16em] text-[#a09885]">
          Locked feature: {feature.replaceAll("_", " ")}
        </p>
      ) : null}
      <Button asChild className="mt-5 rounded-full bg-[#1d1813] text-white hover:bg-[#3d3428]">
        <Link href="/#pricing">Compare plans</Link>
      </Button>
    </div>
  );
}

export function remainingUsageText(account: BillingAccount, usageType: UsageType) {
  const remaining = getRemainingUsage(account, usageType);
  return remaining === "unlimited" ? "unlimited remaining" : `${remaining} remaining`;
}
