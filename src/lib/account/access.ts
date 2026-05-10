import type {
  BillingAccount as LegacyBillingAccount,
  PlanId as LegacyPlanId,
} from "@/lib/billing/plans";
import {
  canAccessBookkeeperMode,
  canAddClientLedger,
  canImport,
  canUseAIAction,
  getBlockedReason,
  getPlanConfig,
  getPlanLimit,
  getRecommendedUpgrade,
  type AccountState,
  type BlockedAction,
  type PlanId,
  type UsageType,
} from "@/lib/account/plans";
import { getUsageSnapshot, readLocalUsageCounters } from "@/lib/account/usage";

export type PlanAccessAction =
  | "csv_import"
  | "excel_import"
  | "reimport"
  | "ai_draft_generation"
  | "ai_rewrite"
  | "reply_classification"
  | "unknown_import_mapping"
  | "weekly_digest_narrative"
  | "add_client_ledger"
  | "bookkeeper_mode";

export type PlanAccessResult = {
  allowed: boolean;
  reason?: string;
  recommendedPlan?: string;
  limit?: number;
  used?: number;
};

const legacyPlanMap: Record<LegacyPlanId, PlanId> = {
  demo: "DEMO",
  trial: "TRIAL",
  founding_single_business: "FOUNDING_SINGLE",
  founding_bookkeeper: "FOUNDING_BOOKKEEPER",
  single_business: "SINGLE_BUSINESS",
  bookkeeper_starter: "BOOKKEEPER_STARTER",
  bookkeeper_pro: "BOOKKEEPER_PRO",
};

export function requirePlanAccess(
  account: AccountState | LegacyBillingAccount | null | undefined,
  action: PlanAccessAction,
): PlanAccessResult {
  if (!account) {
    return {
      allowed: false,
      reason: "Create an account before using this feature.",
      recommendedPlan: "TRIAL",
    };
  }

  const accountState = toAccountState(account);
  const blockedAction = blockedActionFor(action);
  const usageType = usageTypeFor(action, accountState);
  const usage = usageType ? getUsageSnapshot(accountState) : null;
  const limit = usageType ? getPlanLimit(accountState.planId, usageType) : undefined;
  const used = usageType ? usage?.counters[usageType] ?? 0 : undefined;
  const recommendedPlan = getRecommendedUpgrade(accountState, blockedAction);

  if (action === "bookkeeper_mode") {
    return resultForBoolean(
      canAccessBookkeeperMode(accountState),
      accountState,
      blockedAction,
      recommendedPlan,
      limit,
      used,
    );
  }

  if (action === "add_client_ledger") {
    return resultForBoolean(
      canAddClientLedger(accountState),
      accountState,
      blockedAction,
      recommendedPlan,
      limit,
      used,
    );
  }

  if (isImportAction(action)) {
    return resultForBoolean(
      canImport(accountState),
      accountState,
      blockedAction,
      recommendedPlan,
      limit,
      used,
    );
  }

  return resultForBoolean(
    canUseAIAction(accountState),
    accountState,
    blockedAction,
    recommendedPlan,
    limit,
    used,
  );
}

export function toAccountState(
  account: AccountState | LegacyBillingAccount,
): AccountState {
  if ("id" in account && isCentralPlanId(account.planId)) {
    return account;
  }

  const legacyAccount = account as LegacyBillingAccount;
  const planId = legacyPlanMap[legacyAccount.planId];
  const persistedUsage = readLocalUsageCounters(`local-${legacyAccount.planId}`);

  return {
    id: `local-${legacyAccount.planId}`,
    planId,
    status:
      legacyAccount.subscriptionStatus === "trialing"
        ? "trialing"
        : legacyAccount.subscriptionStatus === "demo"
          ? "demo"
          : legacyAccount.accountType === "founding"
            ? "beta"
            : legacyAccount.subscriptionStatus === "expired"
              ? "expired"
              : "active",
    createdAt: legacyAccount.createdAt,
    trialStartedAt: legacyAccount.trialStartedAt,
    trialEndsAt: legacyAccount.trialEndsAt,
    gracePeriodEndsAt: legacyAccount.graceEndsAt,
    currentPeriodStartedAt:
      legacyAccount.currentPeriodStartedAt ?? legacyAccount.createdAt,
    usage: {
      importsUsedThisMonth:
        persistedUsage?.importsUsedThisMonth ??
        legacyAccount.usage.importsThisMonth ??
        0,
      trialImportsUsed:
        persistedUsage?.trialImportsUsed ??
        legacyAccount.usage.importBatches ??
        0,
      aiActionsUsedThisMonth:
        persistedUsage?.aiActionsUsedThisMonth ??
        legacyAccount.usage.aiActionsThisMonth ??
        0,
      trialAiActionsUsed:
        persistedUsage?.trialAiActionsUsed ??
        legacyAccount.usage.aiActionsThisMonth ??
        0,
      activeInvoiceCount:
        persistedUsage?.activeInvoiceCount ??
        legacyAccount.usage.activeInvoices ??
        0,
      clientLedgerCount:
        persistedUsage?.clientLedgerCount ??
        legacyAccount.usage.clientLedgers ??
        1,
      savedImportMappingCount: persistedUsage?.savedImportMappingCount ?? 0,
      weeklyDigestCountThisMonth:
        persistedUsage?.weeklyDigestCountThisMonth ?? 0,
    },
  };
}

function resultForBoolean(
  allowed: boolean,
  account: AccountState,
  blockedAction: BlockedAction,
  recommendedPlan: PlanId,
  limit?: number | "unlimited",
  used?: number,
): PlanAccessResult {
  if (allowed) {
    return {
      allowed: true,
      limit: limit === "unlimited" ? undefined : limit,
      used,
    };
  }

  return {
    allowed: false,
    reason:
      getBlockedReason(account, blockedAction) ??
      "This action is not available on your current plan.",
    recommendedPlan: getPlanConfig(recommendedPlan).name,
    limit: limit === "unlimited" ? undefined : limit,
    used,
  };
}

function usageTypeFor(
  action: PlanAccessAction,
  account: AccountState,
): UsageType | null {
  if (isImportAction(action)) {
    return account.planId === "TRIAL" ? "trialImportsUsed" : "importsUsedThisMonth";
  }
  if (isAIAction(action)) {
    return account.planId === "TRIAL"
      ? "trialAiActionsUsed"
      : "aiActionsUsedThisMonth";
  }
  if (action === "add_client_ledger") return "clientLedgerCount";
  return null;
}

function blockedActionFor(action: PlanAccessAction): BlockedAction {
  if (isImportAction(action)) return "import";
  if (isAIAction(action)) return "ai_action";
  if (action === "add_client_ledger") return "add_client_ledger";
  return "bookkeeper_mode";
}

function isImportAction(action: PlanAccessAction): boolean {
  return action === "csv_import" || action === "excel_import" || action === "reimport";
}

function isAIAction(action: PlanAccessAction): boolean {
  return (
    action === "ai_draft_generation" ||
    action === "ai_rewrite" ||
    action === "reply_classification" ||
    action === "unknown_import_mapping" ||
    action === "weekly_digest_narrative"
  );
}

function isCentralPlanId(planId: string): planId is PlanId {
  return [
    "DEMO",
    "TRIAL",
    "FOUNDING_SINGLE",
    "FOUNDING_BOOKKEEPER",
    "SINGLE_BUSINESS",
    "BOOKKEEPER_STARTER",
    "BOOKKEEPER_PRO",
  ].includes(planId);
}
