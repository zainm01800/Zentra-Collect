"use client";

import {
  CreditCard,
  FileDown,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  PlanBadge,
  TrialCountdownBadge,
  UsageMeter,
  UpgradePromptCard,
} from "@/components/account-plan-ui";
import { useLocalAccount } from "@/lib/billing/use-local-account";
import { toAccountState } from "@/lib/account/access";
import {
  getPlanConfig,
  getPlanLimit,
  getTrialDaysRemaining,
  getTrialState,
  type AccountState,
  type PlanId,
  type UsageType,
} from "@/lib/account/plans";
import { getUsageSnapshot } from "@/lib/account/usage";

const usageMeters: Array<{ label: string; usageType: UsageType }> = [
  { label: "Imports", usageType: "importsUsedThisMonth" },
  { label: "AI actions", usageType: "aiActionsUsedThisMonth" },
  { label: "Active invoices", usageType: "activeInvoiceCount" },
  { label: "Client ledgers", usageType: "clientLedgerCount" },
  { label: "Saved import mappings", usageType: "savedImportMappingCount" },
];

const safetyControls = [
  "Human approval required",
  "Auto-send disabled",
  "No legal advice",
  "Messages must be reviewed before sending",
];

export function AccountPlanSettings() {
  const { account } = useLocalAccount();

  if (!account) {
    return (
      <UpgradePromptCard
        title="No account loaded"
        description="Create an account profile to see plan limits, usage, and trial state."
        recommendedPlan="Trial"
      />
    );
  }

  const accountState = toAccountState(account);
  const plan = getPlanConfig(accountState.planId);
  const trialState = getTrialState(accountState);
  const snapshot = getUsageSnapshot(accountState);
  const recommendedUpgrade = getRecommendedUpgradeForAccount(accountState);

  return (
    <section className="space-y-5">
      <div>
        <p className="text-sm font-medium text-neutral-500 dark:text-[#8a7d69]">Account & plan</p>
        <h2 className="mt-1 text-3xl font-semibold tracking-tight">
          Plan settings
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-600 dark:text-[#8a7d69]">
          Billing is represented by internal plan state for this MVP. Payments
          are not live yet.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          <Card className="rounded-3xl border-black/10 dark:border-white/10 bg-white/70 dark:bg-[#28231c] shadow-none">
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle>Current plan</CardTitle>
                <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-[#8a7d69]">
                  {plan.description}
                </p>
              </div>
              <PlanBadge account={account} />
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <PlanFact label="Plan" value={plan.name} />
              <PlanFact label="Price" value={formatPrice(plan.priceMonthlyGbp)} />
              <PlanFact label="Status" value={formatStatus(accountState)} />
              <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-[#fbf8f1] dark:bg-[#211d17] p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-neutral-500 dark:text-[#8a7d69]">
                  Trial
                </p>
                <div className="mt-2">
                  <TrialCountdownBadge account={account} />
                </div>
              </div>
              {plan.priceLockMonths ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 sm:col-span-2 lg:col-span-4">
                  <p className="text-sm font-semibold text-emerald-950">
                    Founding price lock
                  </p>
                  <p className="mt-1 text-sm leading-6 text-emerald-900">
                    This plan is marked as a founding plan with a{" "}
                    {plan.priceLockMonths}-month price lock in internal plan
                    state.
                  </p>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-black/10 dark:border-white/10 bg-white/70 dark:bg-[#28231c] shadow-none">
            <CardHeader>
              <CardTitle>Usage this month</CardTitle>
              <p className="text-sm leading-6 text-neutral-600 dark:text-[#8a7d69]">
                Usage is tracked locally in this MVP and should move to server
                rollups before production.
              </p>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              {usageMeters.map((item) => (
                <UsageMeter
                  key={item.usageType}
                  account={account}
                  usageType={item.usageType}
                  label={item.label}
                />
              ))}
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-black/10 dark:border-white/10 bg-white/70 dark:bg-[#28231c] shadow-none">
            <CardHeader>
              <CardTitle>Trial & grace period</CardTitle>
            </CardHeader>
            <CardContent>
              {accountState.planId === "TRIAL" ? (
                <div className="grid gap-4 md:grid-cols-3">
                  <PlanFact
                    label="Trial ends"
                    value={formatDate(accountState.trialEndsAt)}
                  />
                  <PlanFact
                    label="Days remaining"
                    value={String(getTrialDaysRemaining(accountState))}
                  />
                  <PlanFact label="Trial state" value={formatTrialState(trialState)} />
                  {trialState !== "active" ? (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950 md:col-span-3">
                      <p className="text-sm font-semibold">View-only mode</p>
                      <p className="mt-1 text-sm leading-6 text-amber-900">
                        Your trial has ended. You can still view existing data,
                        but new imports and AI actions require an upgrade. Grace
                        period ends {formatDate(accountState.gracePeriodEndsAt)}.
                      </p>
                    </div>
                  ) : null}
                </div>
              ) : (
                <p className="text-sm leading-6 text-neutral-600 dark:text-[#8a7d69]">
                  This account is not currently in a trial.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-5">
          <UpgradePromptCard
            title="Upgrade options"
            description={getUpgradeDescription(accountState, snapshot.counters)}
            recommendedPlan={recommendedUpgrade ? getPlanConfig(recommendedUpgrade).name : undefined}
          />

          <Card className="rounded-3xl border-black/10 dark:border-white/10 bg-white/70 dark:bg-[#28231c] shadow-none">
            <CardHeader>
              <CardTitle>Safety controls</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {safetyControls.map((item) => (
                <div key={item} className="flex items-center gap-3 text-sm text-neutral-700 dark:text-[#d8ccb5]">
                  <ShieldCheck className="size-4 text-neutral-950 dark:text-[#f0e8d5]" />
                  <span>{item}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <div
            className="rounded-[14px] p-5"
            style={{
              background: "var(--zn-surface)",
              border: "1px solid var(--zn-line)",
              boxShadow: "var(--zn-shadow-soft)",
            }}
          >
            <div className="flex items-start gap-3">
              <span
                className="size-9 rounded-lg inline-flex items-center justify-center flex-shrink-0"
                style={{ background: "var(--zn-surface-2)", color: "var(--zn-accent)" }}
              >
                <CreditCard className="size-4" />
              </span>
              <div className="min-w-0">
                <div className="zn-label !p-0 mb-1">Billing</div>
                <h3 className="text-[15px] font-semibold text-[#1d1813] dark:text-[#f0e8d5]">
                  Handled by support during beta
                </h3>
                <p className="text-[13px] leading-relaxed mt-1.5" style={{ color: "var(--zn-ink-3)" }}>
                  Trials don&apos;t need a card. When you&apos;re ready to upgrade
                  to a paid plan, email{" "}
                  <a
                    href="mailto:hello@zentracollect.co.uk"
                    className="underline underline-offset-2"
                    style={{ color: "var(--zn-ink)" }}
                  >
                    hello@zentracollect.co.uk
                  </a>{" "}
                  and we&apos;ll set you up.
                </p>
                <p className="text-[12px] mt-3" style={{ color: "var(--zn-ink-3)" }}>
                  Self-serve Stripe checkout and your card history will appear here once we&apos;re out of beta.
                </p>
              </div>
            </div>
          </div>

          <Card className="rounded-3xl border-black/10 dark:border-white/10 bg-white/70 dark:bg-[#28231c] shadow-none">
            <CardHeader>
              <CardTitle>Data controls</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <a
                href="mailto:hello@zentracollect.co.uk?subject=Export%20my%20Zentra%20data"
                className="w-full inline-flex items-center justify-center gap-2 rounded-full border px-4 py-2 text-[13px] font-medium transition-colors hover:bg-[#f3ecd8] dark:hover:bg-[#2d2820]"
                style={{ borderColor: "var(--zn-line)", color: "var(--zn-ink)" }}
              >
                <FileDown className="size-4" />
                Request data export
              </a>
              <p className="text-xs leading-5" style={{ color: "var(--zn-ink-3)" }}>
                During beta, exports and deletion are handled by emailing support.
                Self-serve will appear here once we&apos;re out of beta.
              </p>
            </CardContent>
          </Card>
        </aside>
      </div>
    </section>
  );
}

function PlanFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-[#fbf8f1] dark:bg-[#211d17] p-4">
      <p className="text-xs uppercase tracking-[0.16em] text-neutral-500 dark:text-[#8a7d69]">
        {label}
      </p>
      <p className="mt-2 text-lg font-semibold text-neutral-950 dark:text-[#f0e8d5]">{value}</p>
    </div>
  );
}

function formatPrice(priceMonthlyGbp: number) {
  return priceMonthlyGbp === 0 ? "\u00A30" : `\u00A3${priceMonthlyGbp}/month`;
}

function formatStatus(account: AccountState) {
  if (account.planId === "DEMO") return "demo";
  if (account.planId === "TRIAL") {
    return getTrialState(account) === "active" ? "trial" : "expired";
  }
  if (account.planId === "FOUNDING_SINGLE" || account.planId === "FOUNDING_BOOKKEEPER") {
    return "founding";
  }
  return account.status === "expired" ? "expired" : "active";
}

function formatTrialState(state: ReturnType<typeof getTrialState>) {
  const labels = {
    not_trial: "Not trial",
    active: "Active",
    expired_in_grace: "Expired, grace period",
    expired_after_grace: "Expired",
  };
  return labels[state];
}

function formatDate(date: string | undefined) {
  if (!date) return "Not set";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}

function getRecommendedUpgradeForAccount(account: AccountState): PlanId | null {
  const clientLimit = getPlanLimit(account.planId, "clientLedgerCount");
  const invoiceLimit = getPlanLimit(account.planId, "activeInvoiceCount");

  if (account.planId === "DEMO") return "TRIAL";
  if (account.planId === "TRIAL") return "SINGLE_BUSINESS";
  if (account.planId === "SINGLE_BUSINESS" && account.usage.clientLedgerCount > 1) {
    return "BOOKKEEPER_STARTER";
  }
  if (
    account.planId === "BOOKKEEPER_STARTER" &&
    ((clientLimit !== "unlimited" && account.usage.clientLedgerCount >= clientLimit) ||
      (invoiceLimit !== "unlimited" && account.usage.activeInvoiceCount >= invoiceLimit))
  ) {
    return "BOOKKEEPER_PRO";
  }
  return null;
}

function getUpgradeDescription(
  account: AccountState,
  usage: AccountState["usage"],
) {
  if (account.planId === "DEMO") {
    return "Start a 14-day trial to upload live invoice exports and test Zentra with your own data.";
  }
  if (account.planId === "TRIAL") {
    return "Move to Business when you are ready to keep importing live data and using AI actions.";
  }
  if (account.planId === "SINGLE_BUSINESS" && usage.clientLedgerCount > 1) {
    return "Bookkeeper plans unlock multiple client ledgers and portfolio mode.";
  }
  if (account.planId === "BOOKKEEPER_STARTER") {
    return "Practice Pro is best when client ledger or invoice limits start to feel tight.";
  }
  return "Your current plan covers the main MVP workflow. Compare plans if your usage grows.";
}
