export type PlanId =
  | "DEMO"
  | "TRIAL"
  | "STARTER_SOLO"
  | "FOUNDING_SINGLE"
  | "FOUNDING_BOOKKEEPER"
  | "SINGLE_BUSINESS"
  | "BOOKKEEPER_STARTER"
  | "BOOKKEEPER_PRO";

export type TrialState =
  | "not_trial"
  | "active"
  | "expired_in_grace"
  | "expired_after_grace";

export type UsageType =
  | "importsUsedThisMonth"
  | "trialImportsUsed"
  | "aiActionsUsedThisMonth"
  | "trialAiActionsUsed"
  | "activeInvoiceCount"
  | "clientLedgerCount"
  | "savedImportMappingCount"
  | "weeklyDigestCountThisMonth";

export type FeatureKey =
  | "sampleData"
  | "realData"
  | "persistentRealImports"
  | "aiDrafts"
  | "copyOnlyMessages"
  | "bookkeeperMode"
  | "priceLock"
  | "viewExistingDataAfterTrial"
  | "emailSending"
  | "emailSendingAddon";

export type LimitValue = number | "unlimited";

export type AccountStatus =
  | "demo"
  | "trialing"
  | "active"
  | "beta"
  | "expired"
  | "cancelled";

export type BlockedAction =
  | "import"
  | "ai_action"
  | "add_client_ledger"
  | "bookkeeper_mode"
  | "save_real_data";

export type UsageCounters = Record<UsageType, number>;

export type AccountState = {
  id: string;
  planId: PlanId;
  status: AccountStatus;
  createdAt: string;
  trialStartedAt?: string;
  trialEndsAt?: string;
  gracePeriodEndsAt?: string;
  currentPeriodStartedAt?: string;
  usage: UsageCounters;
};

export type PlanConfig = {
  id: PlanId;
  name: string;
  priceMonthlyGbp: number;
  description: string;
  trialDays?: number;
  gracePeriodDays?: number;
  priceLockMonths?: number;
  limits: Record<UsageType, LimitValue>;
  features: Record<FeatureKey, boolean>;
};

const noUsage: UsageCounters = {
  importsUsedThisMonth: 0,
  trialImportsUsed: 0,
  aiActionsUsedThisMonth: 0,
  trialAiActionsUsed: 0,
  activeInvoiceCount: 0,
  clientLedgerCount: 0,
  savedImportMappingCount: 0,
  weeklyDigestCountThisMonth: 0,
};

const defaultFeatures: Record<FeatureKey, boolean> = {
  sampleData: false,
  realData: false,
  persistentRealImports: false,
  aiDrafts: true,
  copyOnlyMessages: true,
  bookkeeperMode: false,
  priceLock: false,
  viewExistingDataAfterTrial: false,
  emailSending: false,
  emailSendingAddon: false,
};

const defaultLimits: Record<UsageType, LimitValue> = {
  importsUsedThisMonth: 0,
  trialImportsUsed: 0,
  aiActionsUsedThisMonth: 0,
  trialAiActionsUsed: 0,
  activeInvoiceCount: 0,
  clientLedgerCount: 1,
  savedImportMappingCount: 0,
  weeklyDigestCountThisMonth: 0,
};

export const planConfigs: Record<PlanId, PlanConfig> = {
  DEMO: {
    id: "DEMO",
    name: "Demo",
    priceMonthlyGbp: 0,
    description: "Sample-data demo with no expiry and three sample AI drafts.",
    limits: {
      ...defaultLimits,
      aiActionsUsedThisMonth: 3,
      activeInvoiceCount: "unlimited",
      clientLedgerCount: 1,
    },
    features: {
      ...defaultFeatures,
      sampleData: true,
    },
  },
  STARTER_SOLO: {
    id: "STARTER_SOLO",
    name: "Solo",
    priceMonthlyGbp: 29,
    description: "For sole traders, freelancers, and micro businesses chasing a small invoice book.",
    limits: {
      ...defaultLimits,
      importsUsedThisMonth: 5,
      trialImportsUsed: "unlimited",
      aiActionsUsedThisMonth: 75,
      trialAiActionsUsed: "unlimited",
      activeInvoiceCount: 50,
      clientLedgerCount: 1,
      savedImportMappingCount: 0,
      weeklyDigestCountThisMonth: 0,
    },
    features: {
      ...defaultFeatures,
      realData: true,
      persistentRealImports: true,
      emailSendingAddon: true,
    },
  },
  TRIAL: {
    id: "TRIAL",
    name: "14-day Trial",
    priceMonthlyGbp: 0,
    description: "No-card trial for one business using real invoice exports.",
    trialDays: 14,
    gracePeriodDays: 30,
    limits: {
      ...defaultLimits,
      importsUsedThisMonth: 2,
      trialImportsUsed: 2,
      aiActionsUsedThisMonth: 25,
      trialAiActionsUsed: 25,
      activeInvoiceCount: 100,
      clientLedgerCount: 1,
    },
    features: {
      ...defaultFeatures,
      realData: true,
      persistentRealImports: true,
      viewExistingDataAfterTrial: true,
    },
  },
  FOUNDING_SINGLE: {
    id: "FOUNDING_SINGLE",
    name: "Founding Single Business",
    priceMonthlyGbp: 29,
    description: "Founding single-business plan with a 12-month price lock.",
    priceLockMonths: 12,
    limits: {
      ...defaultLimits,
      importsUsedThisMonth: 10,
      trialImportsUsed: "unlimited",
      aiActionsUsedThisMonth: 150,
      trialAiActionsUsed: "unlimited",
      activeInvoiceCount: 500,
      clientLedgerCount: 1,
      savedImportMappingCount: "unlimited",
      weeklyDigestCountThisMonth: "unlimited",
    },
    features: {
      ...defaultFeatures,
      realData: true,
      persistentRealImports: true,
      priceLock: true,
    },
  },
  FOUNDING_BOOKKEEPER: {
    id: "FOUNDING_BOOKKEEPER",
    name: "Founding Bookkeeper",
    priceMonthlyGbp: 79,
    description: "Founding bookkeeper plan for up to five client ledgers.",
    priceLockMonths: 12,
    limits: {
      ...defaultLimits,
      importsUsedThisMonth: 20,
      trialImportsUsed: "unlimited",
      aiActionsUsedThisMonth: 300,
      trialAiActionsUsed: "unlimited",
      activeInvoiceCount: 1500,
      clientLedgerCount: 5,
      savedImportMappingCount: "unlimited",
      weeklyDigestCountThisMonth: "unlimited",
    },
    features: {
      ...defaultFeatures,
      realData: true,
      persistentRealImports: true,
      bookkeeperMode: true,
      priceLock: true,
      emailSending: true,
    },
  },
  SINGLE_BUSINESS: {
    id: "SINGLE_BUSINESS",
    name: "Business",
    priceMonthlyGbp: 59,
    description: "For one small business running a practical chase process.",
    limits: {
      ...defaultLimits,
      importsUsedThisMonth: 10,
      trialImportsUsed: "unlimited",
      aiActionsUsedThisMonth: 200,
      trialAiActionsUsed: "unlimited",
      activeInvoiceCount: 500,
      clientLedgerCount: 1,
      savedImportMappingCount: "unlimited",
      weeklyDigestCountThisMonth: "unlimited",
    },
    features: {
      ...defaultFeatures,
      realData: true,
      persistentRealImports: true,
      emailSendingAddon: true,
    },
  },
  BOOKKEEPER_STARTER: {
    id: "BOOKKEEPER_STARTER",
    name: "Practice",
    priceMonthlyGbp: 119,
    description: "For bookkeeping practices managing up to 5 client ledgers.",
    limits: {
      ...defaultLimits,
      importsUsedThisMonth: "unlimited",
      trialImportsUsed: "unlimited",
      aiActionsUsedThisMonth: 500,
      trialAiActionsUsed: "unlimited",
      activeInvoiceCount: 2000,
      clientLedgerCount: 5,
      savedImportMappingCount: "unlimited",
      weeklyDigestCountThisMonth: "unlimited",
    },
    features: {
      ...defaultFeatures,
      realData: true,
      persistentRealImports: true,
      bookkeeperMode: true,
      emailSending: true,
    },
  },
  BOOKKEEPER_PRO: {
    id: "BOOKKEEPER_PRO",
    name: "Practice Pro",
    priceMonthlyGbp: 249,
    description: "For larger bookkeeping firms with up to 20 client portfolios.",
    limits: {
      ...defaultLimits,
      importsUsedThisMonth: "unlimited",
      trialImportsUsed: "unlimited",
      aiActionsUsedThisMonth: 1500,
      trialAiActionsUsed: "unlimited",
      activeInvoiceCount: 7500,
      clientLedgerCount: 20,
      savedImportMappingCount: "unlimited",
      weeklyDigestCountThisMonth: "unlimited",
    },
    features: {
      ...defaultFeatures,
      realData: true,
      persistentRealImports: true,
      bookkeeperMode: true,
      emailSending: true,
    },
  },
};

export function createEmptyUsageCounters(
  overrides: Partial<UsageCounters> = {},
): UsageCounters {
  return {
    ...noUsage,
    ...overrides,
  };
}

export function getPlanConfig(planId: PlanId): PlanConfig {
  return planConfigs[planId];
}

export function getPlanLimit(planId: PlanId, limitKey: UsageType): LimitValue {
  return getPlanConfig(planId).limits[limitKey];
}

export function isTrialExpired(account: AccountState): boolean {
  if (account.planId !== "TRIAL" || !account.trialEndsAt) return false;
  return new Date(account.trialEndsAt).getTime() <= Date.now();
}

export function isInGracePeriod(account: AccountState): boolean {
  if (!isTrialExpired(account) || !account.gracePeriodEndsAt) return false;
  return new Date(account.gracePeriodEndsAt).getTime() > Date.now();
}

export function getTrialState(account: AccountState): TrialState {
  if (account.planId !== "TRIAL") return "not_trial";
  if (!isTrialExpired(account)) return "active";
  return isInGracePeriod(account) ? "expired_in_grace" : "expired_after_grace";
}

export function getTrialDaysRemaining(account: AccountState): number {
  if (account.planId !== "TRIAL" || !account.trialEndsAt) return 0;
  const msRemaining = new Date(account.trialEndsAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(msRemaining / 86_400_000));
}

export function canUseFeature(
  account: AccountState,
  featureKey: FeatureKey,
): boolean {
  if (featureKey === "emailSending") return false;
  return getPlanConfig(account.planId).features[featureKey];
}

export function canImport(account: AccountState): boolean {
  if (!canUseFeature(account, "persistentRealImports")) return false;
  if (account.planId === "TRIAL" && isTrialExpired(account)) return false;
  return (
    hasRemaining(account, "trialImportsUsed") &&
    hasRemaining(account, "importsUsedThisMonth") &&
    hasRemaining(account, "activeInvoiceCount")
  );
}

export function canUseAIAction(account: AccountState): boolean {
  if (account.planId === "TRIAL" && isTrialExpired(account)) return false;
  if (account.planId === "DEMO") return hasRemaining(account, "aiActionsUsedThisMonth");
  return (
    hasRemaining(account, "trialAiActionsUsed") &&
    hasRemaining(account, "aiActionsUsedThisMonth")
  );
}

export function canAddClientLedger(account: AccountState): boolean {
  return hasRemaining(account, "clientLedgerCount");
}

export function canAccessBookkeeperMode(account: AccountState): boolean {
  return canUseFeature(account, "bookkeeperMode");
}

export function getBlockedReason(
  account: AccountState,
  action: BlockedAction,
): string | null {
  const plan = getPlanConfig(account.planId);
  const trialState = getTrialState(account);

  if (account.planId === "TRIAL" && trialState !== "active") {
    if (action === "import" || action === "ai_action" || action === "add_client_ledger") {
      return trialState === "expired_in_grace"
        ? "Your trial has ended. You can still view existing data during the grace period, but new imports and AI actions require an upgrade."
        : "Your trial and grace period have ended. Upgrade to continue using live data features.";
    }
  }

  if (action === "import" && !canImport(account)) {
    if (account.planId === "DEMO") {
      return "Demo uses sample data only. Start a trial to upload your own invoice exports.";
    }
    return `${plan.name} has reached its import or active invoice limit.`;
  }

  if (action === "ai_action" && !canUseAIAction(account)) {
    if (account.planId === "DEMO") {
      return "Demo includes 3 sample AI drafts. Start a trial to continue with your own data.";
    }
    return `${plan.name} has reached its AI action limit.`;
  }

  if (action === "add_client_ledger" && !canAddClientLedger(account)) {
    return `${plan.name} has reached its client ledger limit.`;
  }

  if (action === "bookkeeper_mode" && !canAccessBookkeeperMode(account)) {
    return "Bookkeeper mode is available on Founding Bookkeeper, Bookkeeper Starter, and Bookkeeper Pro.";
  }

  if (action === "save_real_data" && !canUseFeature(account, "persistentRealImports")) {
    return "This plan cannot save real imported data. Use demo data or start a trial.";
  }

  return null;
}

export function getRecommendedUpgrade(
  account: AccountState,
  blockedAction: BlockedAction,
): PlanId {
  if (blockedAction === "bookkeeper_mode" || blockedAction === "add_client_ledger") {
    return account.planId === "BOOKKEEPER_STARTER"
      ? "BOOKKEEPER_PRO"
      : "BOOKKEEPER_STARTER";
  }

  if (account.planId === "DEMO") return "TRIAL";
  if (account.planId === "TRIAL") return "STARTER_SOLO";
  if (account.planId === "STARTER_SOLO") return "SINGLE_BUSINESS";
  if (account.planId === "FOUNDING_SINGLE") return "FOUNDING_BOOKKEEPER";
  if (account.planId === "SINGLE_BUSINESS") return "BOOKKEEPER_STARTER";
  if (account.planId === "BOOKKEEPER_STARTER") return "BOOKKEEPER_PRO";

  return account.planId;
}

function hasRemaining(account: AccountState, usageType: UsageType): boolean {
  const limit = getPlanLimit(account.planId, usageType);
  if (limit === "unlimited") return true;
  return (account.usage[usageType] ?? 0) < limit;
}
