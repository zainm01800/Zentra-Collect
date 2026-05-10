import {
  canUseAIAction,
  createEmptyUsageCounters,
  getPlanConfig,
  getPlanLimit,
  isTrialExpired,
  type AccountState,
  type LimitValue,
  type PlanConfig,
  type UsageCounters,
  type UsageType,
} from "@/lib/account/plans";

export type AIActionType =
  | "draft_generation"
  | "rewrite_message"
  | "classify_reply"
  | "unknown_import_mapping"
  | "customer_behaviour_summary"
  | "weekly_digest_narrative";

export type UsageSnapshot = {
  accountId: string;
  plan: PlanConfig;
  currentPeriodStartedAt: string;
  counters: UsageCounters;
  limits: Record<UsageType, LimitValue>;
  trialStartedAt?: string;
  trialEndsAt?: string;
  gracePeriodEndsAt?: string;
  trialExpired: boolean;
};

export const trackedAIActionTypes: AIActionType[] = [
  "draft_generation",
  "rewrite_message",
  "classify_reply",
  "unknown_import_mapping",
  "customer_behaviour_summary",
  "weekly_digest_narrative",
];

export const nonBillableDeterministicActions = [
  "ranking_invoices",
  "calculating_days_overdue",
  "sorting_filtering",
  "deterministic_import_validation",
  "reimport_diffing",
  "safety_checks",
  "dashboard_viewing",
] as const;

export const accountUsageStorageKey = "zentra.accountUsage.v1";

export function getUsageSnapshot(account: AccountState): UsageSnapshot {
  const normalisedAccount = normaliseUsageAccount(account);
  const plan = getPlanConfig(normalisedAccount.planId);

  return {
    accountId: normalisedAccount.id,
    plan,
    currentPeriodStartedAt:
      normalisedAccount.currentPeriodStartedAt ?? normalisedAccount.createdAt,
    counters: normalisedAccount.usage,
    limits: plan.limits,
    trialStartedAt: normalisedAccount.trialStartedAt,
    trialEndsAt: normalisedAccount.trialEndsAt,
    gracePeriodEndsAt: normalisedAccount.gracePeriodEndsAt,
    trialExpired: isTrialExpired(normalisedAccount),
  };
}

export function incrementImportUsage(account: AccountState): AccountState {
  const nextAccount = resetMonthlyUsageIfNeeded(account);
  if (hasReachedImportLimit(nextAccount)) return nextAccount;

  return persistUsageUpdate({
    ...nextAccount,
    usage: {
      ...nextAccount.usage,
      importsUsedThisMonth: nextAccount.usage.importsUsedThisMonth + 1,
      trialImportsUsed:
        nextAccount.planId === "TRIAL"
          ? nextAccount.usage.trialImportsUsed + 1
          : nextAccount.usage.trialImportsUsed,
    },
  });
}

export function incrementAIUsage(
  account: AccountState,
  aiActionType: AIActionType,
): AccountState {
  const nextAccount = resetMonthlyUsageIfNeeded(account);
  if (!trackedAIActionTypes.includes(aiActionType)) return nextAccount;
  if (hasReachedAIActionLimit(nextAccount)) return nextAccount;

  return persistUsageUpdate({
    ...nextAccount,
    usage: {
      ...nextAccount.usage,
      aiActionsUsedThisMonth: nextAccount.usage.aiActionsUsedThisMonth + 1,
      trialAiActionsUsed:
        nextAccount.planId === "TRIAL"
          ? nextAccount.usage.trialAiActionsUsed + 1
          : nextAccount.usage.trialAiActionsUsed,
    },
  });
}

export function incrementClientLedgerUsage(account: AccountState): AccountState {
  const nextAccount = resetMonthlyUsageIfNeeded(account);
  if (hasReachedClientLedgerLimit(nextAccount)) return nextAccount;

  return persistUsageUpdate({
    ...nextAccount,
    usage: {
      ...nextAccount.usage,
      clientLedgerCount: nextAccount.usage.clientLedgerCount + 1,
    },
  });
}

export function incrementSavedImportMappingUsage(
  account: AccountState,
): AccountState {
  const nextAccount = resetMonthlyUsageIfNeeded(account);
  const limit = getPlanLimit(nextAccount.planId, "savedImportMappingCount");
  if (limit !== "unlimited" && nextAccount.usage.savedImportMappingCount >= limit) {
    return nextAccount;
  }

  return persistUsageUpdate({
    ...nextAccount,
    usage: {
      ...nextAccount.usage,
      savedImportMappingCount: nextAccount.usage.savedImportMappingCount + 1,
    },
  });
}

export function incrementWeeklyDigestUsage(account: AccountState): AccountState {
  const nextAccount = resetMonthlyUsageIfNeeded(account);
  const limit = getPlanLimit(nextAccount.planId, "weeklyDigestCountThisMonth");
  if (limit !== "unlimited" && nextAccount.usage.weeklyDigestCountThisMonth >= limit) {
    return nextAccount;
  }

  return persistUsageUpdate({
    ...nextAccount,
    usage: {
      ...nextAccount.usage,
      weeklyDigestCountThisMonth:
        nextAccount.usage.weeklyDigestCountThisMonth + 1,
    },
  });
}

export function resetMonthlyUsageIfNeeded(account: AccountState): AccountState {
  const normalisedAccount = normaliseUsageAccount(account);
  const periodStartedAt =
    normalisedAccount.currentPeriodStartedAt ?? normalisedAccount.createdAt;

  if (isSameUtcMonth(new Date(periodStartedAt), new Date())) {
    return normalisedAccount;
  }

  return persistUsageUpdate({
    ...normalisedAccount,
    currentPeriodStartedAt: new Date().toISOString(),
    usage: {
      ...normalisedAccount.usage,
      importsUsedThisMonth: 0,
      aiActionsUsedThisMonth: 0,
      weeklyDigestCountThisMonth: 0,
    },
  });
}

export function hasReachedImportLimit(account: AccountState): boolean {
  const normalisedAccount = normaliseUsageAccount(account);
  if (normalisedAccount.planId === "DEMO") return true;
  if (normalisedAccount.planId === "TRIAL" && isTrialExpired(normalisedAccount)) {
    return true;
  }
  if (normalisedAccount.planId === "TRIAL") {
    return (
      hasReachedUsageLimit(normalisedAccount, "importsUsedThisMonth") ||
      hasReachedUsageLimit(normalisedAccount, "trialImportsUsed")
    );
  }
  return hasReachedUsageLimit(normalisedAccount, "importsUsedThisMonth");
}

export function hasReachedAIActionLimit(account: AccountState): boolean {
  const normalisedAccount = normaliseUsageAccount(account);
  if (!canUseAIAction(normalisedAccount)) return true;
  if (normalisedAccount.planId === "DEMO") {
    return hasReachedUsageLimit(normalisedAccount, "aiActionsUsedThisMonth");
  }
  if (normalisedAccount.planId === "TRIAL") {
    return (
      hasReachedUsageLimit(normalisedAccount, "aiActionsUsedThisMonth") ||
      hasReachedUsageLimit(normalisedAccount, "trialAiActionsUsed")
    );
  }
  return hasReachedUsageLimit(normalisedAccount, "aiActionsUsedThisMonth");
}

export function hasReachedInvoiceLimit(account: AccountState): boolean {
  return hasReachedUsageLimit(normaliseUsageAccount(account), "activeInvoiceCount");
}

export function hasReachedClientLedgerLimit(account: AccountState): boolean {
  return hasReachedUsageLimit(normaliseUsageAccount(account), "clientLedgerCount");
}

export function readLocalUsageCounters(accountId: string): UsageCounters | null {
  if (typeof window === "undefined") return null;
  const stored = window.localStorage.getItem(accountUsageStorageKey);
  if (!stored) return null;

  try {
    const allUsage = JSON.parse(stored) as Record<string, Partial<UsageCounters>>;
    return createEmptyUsageCounters(allUsage[accountId] ?? {});
  } catch {
    window.localStorage.removeItem(accountUsageStorageKey);
    return null;
  }
}

export function writeLocalUsageCounters(
  accountId: string,
  usage: UsageCounters,
): void {
  if (typeof window === "undefined") return;

  const stored = window.localStorage.getItem(accountUsageStorageKey);
  let allUsage: Record<string, UsageCounters> = {};
  if (stored) {
    try {
      allUsage = JSON.parse(stored) as Record<string, UsageCounters>;
    } catch {
      allUsage = {};
    }
  }

  allUsage[accountId] = usage;
  window.localStorage.setItem(accountUsageStorageKey, JSON.stringify(allUsage));
}

function normaliseUsageAccount(account: AccountState): AccountState {
  const persistedUsage = readLocalUsageCounters(account.id);
  return {
    ...account,
    currentPeriodStartedAt:
      account.currentPeriodStartedAt ?? account.createdAt,
    usage: createEmptyUsageCounters({
      ...account.usage,
      ...persistedUsage,
    }),
  };
}

function persistUsageUpdate(account: AccountState): AccountState {
  // TODO: Replace this mock persistence with a server-side usage_events table
  // and account_usage_rollups in Supabase/Postgres before real users.
  writeLocalUsageCounters(account.id, account.usage);
  return account;
}

function hasReachedUsageLimit(
  account: AccountState,
  usageType: UsageType,
): boolean {
  const limit = getPlanLimit(account.planId, usageType);
  if (limit === "unlimited") return false;
  return account.usage[usageType] >= limit;
}

function isSameUtcMonth(left: Date, right: Date): boolean {
  return (
    left.getUTCFullYear() === right.getUTCFullYear() &&
    left.getUTCMonth() === right.getUTCMonth()
  );
}
