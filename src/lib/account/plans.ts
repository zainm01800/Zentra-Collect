export type PlanId =
  | "DEMO"
  | "TRIAL"
  | "FREE"
  | "TRADER"
  | "FREELANCE"
  | "STARTER_SOLO"
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
  | "collections"
  | "aiDrafts"
  | "booksAndTax"
  | "accountingIntegrations"
  | "autoSendEmail"
  | "bookkeeperMode"
  | "viewExistingDataAfterTrial";

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
  collections: false,
  aiDrafts: false,
  booksAndTax: false,
  accountingIntegrations: false,
  autoSendEmail: false,
  bookkeeperMode: false,
  viewExistingDataAfterTrial: false,
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
    description: "Explore every feature with sample data — no sign-up required.",
    limits: {
      ...defaultLimits,
      aiActionsUsedThisMonth: 3,
      activeInvoiceCount: "unlimited",
      clientLedgerCount: 1,
    },
    features: {
      ...defaultFeatures,
      sampleData: true,
      collections: true,
      aiDrafts: true,
      booksAndTax: true,
    },
  },

  TRIAL: {
    id: "TRIAL",
    name: "14-day Trial",
    priceMonthlyGbp: 0,
    description: "No-card trial. Real data, full access for 14 days.",
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
      collections: true,
      aiDrafts: true,
      booksAndTax: true,
      viewExistingDataAfterTrial: true,
    },
  },

  // FREE — the "forever" tier for sole traders billing only a handful of
  // invoices a month. Real bank feed + real invoices + real tax estimate,
  // but no AI and a hard cap of 3 active invoices. The point is: if you
  // invoice rarely, you can run your whole books here for £0; the moment
  // you scale, you bump the cap and upgrade.
  FREE: {
    id: "FREE",
    name: "Free",
    priceMonthlyGbp: 0,
    description: "Forever-free tier for very small sole traders. 3 active invoices, real bank feed, real tax estimate.",
    limits: {
      ...defaultLimits,
      importsUsedThisMonth: 1,
      trialImportsUsed: "unlimited",
      aiActionsUsedThisMonth: 0,
      trialAiActionsUsed: 0,
      activeInvoiceCount: 3,
      clientLedgerCount: 1,
      weeklyDigestCountThisMonth: 1,
    },
    features: {
      ...defaultFeatures,
      realData: true,
      persistentRealImports: true,
      collections: true,    // template chases only
      booksAndTax: true,
    },
  },

  TRADER: {
    id: "TRADER",
    name: "Trader",
    priceMonthlyGbp: 5,
    description: "Upload a bank statement, categorise expenses, estimate your tax. No invoice chasing.",
    limits: {
      ...defaultLimits,
      importsUsedThisMonth: 5,
      trialImportsUsed: "unlimited",
      aiActionsUsedThisMonth: 0,
      trialAiActionsUsed: 0,
      activeInvoiceCount: 50,
      clientLedgerCount: 1,
    },
    features: {
      ...defaultFeatures,
      realData: true,
      persistentRealImports: true,
      booksAndTax: true,
    },
  },

  FREELANCE: {
    id: "FREELANCE",
    name: "Freelance",
    priceMonthlyGbp: 14,
    description: "Chase invoices with template emails. No AI — you write the final message.",
    limits: {
      ...defaultLimits,
      importsUsedThisMonth: 5,
      trialImportsUsed: "unlimited",
      aiActionsUsedThisMonth: 0,
      trialAiActionsUsed: 0,
      activeInvoiceCount: 100,
      clientLedgerCount: 1,
    },
    features: {
      ...defaultFeatures,
      realData: true,
      persistentRealImports: true,
      collections: true,
      booksAndTax: true,
    },
  },

  STARTER_SOLO: {
    id: "STARTER_SOLO",
    name: "Solo",
    priceMonthlyGbp: 29,
    description: "Full collections with AI draft emails, dispute workflow, and bank matching.",
    limits: {
      ...defaultLimits,
      importsUsedThisMonth: 10,
      trialImportsUsed: "unlimited",
      aiActionsUsedThisMonth: 50,
      trialAiActionsUsed: "unlimited",
      activeInvoiceCount: 200,
      clientLedgerCount: 1,
      savedImportMappingCount: "unlimited",
    },
    features: {
      ...defaultFeatures,
      realData: true,
      persistentRealImports: true,
      collections: true,
      aiDrafts: true,
      booksAndTax: true,
    },
  },

  SINGLE_BUSINESS: {
    id: "SINGLE_BUSINESS",
    name: "Business",
    priceMonthlyGbp: 59,
    description: "Everything in Solo plus auto-send, accounting integrations, and GoCardless.",
    limits: {
      ...defaultLimits,
      importsUsedThisMonth: "unlimited",
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
      collections: true,
      aiDrafts: true,
      booksAndTax: true,
      accountingIntegrations: true,
      autoSendEmail: true,
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
      collections: true,
      aiDrafts: true,
      booksAndTax: true,
      accountingIntegrations: true,
      autoSendEmail: true,
      bookkeeperMode: true,
    },
  },

  BOOKKEEPER_PRO: {
    id: "BOOKKEEPER_PRO",
    name: "Practice Pro",
    priceMonthlyGbp: 199,
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
      collections: true,
      aiDrafts: true,
      booksAndTax: true,
      accountingIntegrations: true,
      autoSendEmail: true,
      bookkeeperMode: true,
    },
  },
};

export function createEmptyUsageCounters(overrides: Partial<UsageCounters> = {}): UsageCounters {
  return { ...noUsage, ...overrides };
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

export function canUseFeature(account: AccountState, featureKey: FeatureKey): boolean {
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
  if (!canUseFeature(account, "aiDrafts")) return false;
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

export function getBlockedReason(account: AccountState, action: BlockedAction): string | null {
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
    if (!canUseFeature(account, "aiDrafts")) {
      return `AI drafts are not included on the ${plan.name} plan. Upgrade to Solo or above.`;
    }
    return `${plan.name} has reached its AI action limit for this month.`;
  }

  if (action === "add_client_ledger" && !canAddClientLedger(account)) {
    return `${plan.name} has reached its client ledger limit.`;
  }

  if (action === "bookkeeper_mode" && !canAccessBookkeeperMode(account)) {
    return "Bookkeeper mode is available on Practice and Practice Pro plans.";
  }

  if (action === "save_real_data" && !canUseFeature(account, "persistentRealImports")) {
    return "This plan cannot save real imported data. Use demo data or start a trial.";
  }

  return null;
}

export function getRecommendedUpgrade(account: AccountState, blockedAction: BlockedAction): PlanId {
  if (blockedAction === "bookkeeper_mode" || blockedAction === "add_client_ledger") {
    return account.planId === "BOOKKEEPER_STARTER" ? "BOOKKEEPER_PRO" : "BOOKKEEPER_STARTER";
  }
  if (account.planId === "DEMO") return "TRIAL";
  if (account.planId === "TRIAL") return "STARTER_SOLO";
  if (account.planId === "FREE") return "FREELANCE";
  if (account.planId === "TRADER") return "FREELANCE";
  if (account.planId === "FREELANCE") return "STARTER_SOLO";
  if (account.planId === "STARTER_SOLO") return "SINGLE_BUSINESS";
  if (account.planId === "SINGLE_BUSINESS") return "BOOKKEEPER_STARTER";
  if (account.planId === "BOOKKEEPER_STARTER") return "BOOKKEEPER_PRO";
  return account.planId;
}

function hasRemaining(account: AccountState, usageType: UsageType): boolean {
  const limit = getPlanLimit(account.planId, usageType);
  if (limit === "unlimited") return true;
  return (account.usage[usageType] ?? 0) < limit;
}
