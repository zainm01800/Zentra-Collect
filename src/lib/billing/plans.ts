import {
  getPlanConfig as getCentralPlanConfig,
  getPlanLimit as getCentralPlanLimit,
  type LimitValue as CentralLimitValue,
  type PlanId as CentralPlanId,
} from "@/lib/account/plans";

export type PlanId =
  | "demo"
  | "trial"
  | "starter_solo"
  | "founding_single_business"
  | "founding_bookkeeper"
  | "single_business"
  | "bookkeeper_starter"
  | "bookkeeper_pro";

export type PlanTier = "free" | "trial" | "paid";

export type AccountType = "demo" | "trial" | "founding" | "paid";

export type SubscriptionStatus =
  | "demo"
  | "trialing"
  | "active"
  | "past_due"
  | "cancelled"
  | "expired";

export interface Plan {
  id: PlanId;
  name: string;
  tier: PlanTier;
  accountType: AccountType;
  tagline: string;
  price: number;
  priceDisplay: string;
  periodDisplay: string;
  trialDays?: number;
  graceDays?: number;
  cta: string;
  href: string;
  highlight: boolean;
  highlightLabel?: string;
  features: string[];
  limits: {
    activeInvoices: number | null;
    importsPerMonth: number | null;
    aiActionsPerMonth: number;
    ledgers: number;
    savedImportMappings: number;
  };
}

export type BillingAccountLike = {
  planId: PlanId;
  accountType?: AccountType;
  subscriptionStatus?: SubscriptionStatus;
  createdAt?: string;
  trialStartedAt?: string;
  trialEndsAt?: string;
  graceEndsAt?: string;
  gracePeriodEndsAt?: string;
  currentPeriodStartedAt?: string;
  usage: UsageCounters;
};

export type BillingAccount = BillingAccountLike;

export type UsageType =
  | keyof Plan["limits"]
  | "activeInvoices"
  | "importBatches"
  | "importsThisMonth"
  | "aiActionsThisMonth"
  | "clientLedgers";

export type UsageCounters = {
  activeInvoices: number;
  importBatches: number;
  importsThisMonth: number;
  aiActionsThisMonth: number;
  clientLedgers: number;
} & Partial<Record<UsageType, number>>;

export type PlanFeature = string;

export type ComparisonCellValue = string | number | boolean;

export interface ComparisonRow {
  label: string;
  values: Record<PlanId, ComparisonCellValue>;
}

const centralPlanMap: Record<PlanId, CentralPlanId> = {
  demo: "DEMO",
  trial: "TRIAL",
  starter_solo: "STARTER_SOLO",
  founding_single_business: "FOUNDING_SINGLE",
  founding_bookkeeper: "FOUNDING_BOOKKEEPER",
  single_business: "SINGLE_BUSINESS",
  bookkeeper_starter: "BOOKKEEPER_STARTER",
  bookkeeper_pro: "BOOKKEEPER_PRO",
};

export function getPlan(planId: PlanId): Plan {
  const centralId = centralPlanMap[planId];
  const central = getCentralPlanConfig(centralId);

  const tier: PlanTier = 
    planId === "demo" ? "free" : 
    planId === "trial" ? "trial" : "paid";
  const accountType: AccountType =
    planId === "demo"
      ? "demo"
      : planId === "trial"
        ? "trial"
        : planId.startsWith("founding")
          ? "founding"
          : "paid";

  const price = central.priceMonthlyGbp;
  const priceDisplay = price === 0 ? "£0" : `£${price}`;
  const periodDisplay = price === 0 ? "" : "/mo";

  const limits = {
    activeInvoices: toLegacyLimit(getCentralPlanLimit(centralId, "activeInvoiceCount")),
    importsPerMonth: planId === "trial" 
      ? toLegacyLimit(getCentralPlanLimit(centralId, "trialImportsUsed"))
      : toLegacyLimit(getCentralPlanLimit(centralId, "importsUsedThisMonth")),
    aiActionsPerMonth: planId === "trial"
      ? (toLegacyLimit(getCentralPlanLimit(centralId, "trialAiActionsUsed")) as number)
      : (toLegacyLimit(getCentralPlanLimit(centralId, "aiActionsUsedThisMonth")) as number),
    ledgers: toLegacyLimit(getCentralPlanLimit(centralId, "clientLedgerCount")) as number,
    savedImportMappings: toLegacyLimit(getCentralPlanLimit(centralId, "savedImportMappingCount")) as number,
  };

  const taglineMap: Record<PlanId, string> = {
    demo: "Explore the product with sample data.",
    trial: "14-day free trial with your own data.",
    starter_solo: "For sole traders with a small invoice book.",
    founding_single_business: "Founding price for a single business.",
    founding_bookkeeper: "Founding price for bookkeepers.",
    single_business: "Standard plan for one business.",
    bookkeeper_starter: "Manage up to 5 client ledgers.",
    bookkeeper_pro: "Advanced features for large portfolios.",
  };

  const featuresMap: Record<PlanId, string[]> = {
    demo: ["Sample invoices only", "3 AI drafts included", "Ranked chase plan"],
    trial: ["Real invoice exports", "25 AI actions", "Full decision engine"],
    starter_solo: ["50 active invoices", "75 AI actions/mo", "5 imports/month"],
    founding_single_business: ["500 active invoices", "150 AI actions/mo", "Price locked for 12mo"],
    founding_bookkeeper: ["1,500 active invoices", "300 AI actions/mo", "Up to 5 client ledgers"],
    single_business: ["500 active invoices", "200 AI actions/mo", "Saved import templates"],
    bookkeeper_starter: ["2,000 active invoices", "500 AI actions/mo", "Up to 5 client ledgers"],
    bookkeeper_pro: ["7,500 active invoices", "1,500 AI actions/mo", "Up to 20 client ledgers"],
  };

  return {
    id: planId,
    name: central.name,
    tier,
    accountType,
    tagline: taglineMap[planId] || central.description,
    price,
    priceDisplay,
    periodDisplay,
    trialDays: central.trialDays,
    graceDays: central.gracePeriodDays,
    cta: planId === "demo" ? "Try demo" : planId === "trial" ? "Start trial" : "Request access",
    href: planId === "demo" ? "/demo" : planId === "trial" ? "/login" : "/request-access",
    highlight: planId === "single_business" || planId === "bookkeeper_starter",
    highlightLabel: planId === "single_business" ? "Recommended" : undefined,
    features: featuresMap[planId] || [],
    limits,
  };
}

export const PLANS: Plan[] = [
  getPlan("demo"),
  getPlan("trial"),
  getPlan("starter_solo"),
  getPlan("single_business"),
  getPlan("bookkeeper_starter"),
  getPlan("bookkeeper_pro"),
];

export const COMPARISON_ROWS: ComparisonRow[] = [
  {
    label: "Active invoices",
    values: {
      demo: "Unlimited (sample)",
      trial: "100",
      starter_solo: "50",
      founding_single_business: "500",
      founding_bookkeeper: "1,500",
      single_business: "500",
      bookkeeper_starter: "2,000",
      bookkeeper_pro: "7,500",
    },
  },
  {
    label: "Client ledgers",
    values: {
      demo: 1,
      trial: 1,
      starter_solo: 1,
      founding_single_business: 1,
      founding_bookkeeper: 5,
      single_business: 1,
      bookkeeper_starter: 5,
      bookkeeper_pro: 20,
    },
  },
  {
    label: "AI actions / month",
    values: {
      demo: 3,
      trial: 25,
      starter_solo: 75,
      founding_single_business: 150,
      founding_bookkeeper: 300,
      single_business: 200,
      bookkeeper_starter: 500,
      bookkeeper_pro: "1,500",
    },
  },
  {
    label: "Saved import templates",
    values: {
      demo: false,
      trial: false,
      starter_solo: false,
      founding_single_business: true,
      founding_bookkeeper: true,
      single_business: true,
      bookkeeper_starter: true,
      bookkeeper_pro: true,
    },
  },
];

export const EVERY_PAID_PLAN_INCLUDES = [
  "Ranked collections plan",
  "Decision-engine explanations",
  "AI follow-up drafts",
  "Promise & dispute tracking",
  "Weekly digest previews",
  "Custom import mapping",
  "Historical import comparison",
  "Human-approval workflow",
];

export const FAQS = [
  {
    q: "Do I need Xero or QuickBooks?",
    a: "No. You can start with any CSV/Excel invoice export. Zentra is designed to handle messy data from any system.",
  },
  {
    q: "Does Zentra send emails automatically?",
    a: "No. Human approval is required for everything. You review the draft, copy it, and send it yourself.",
  },
  {
    q: "What happens after the trial?",
    a: "You can still view your data, but new imports and AI actions require an upgrade to a paid plan.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. There are no long-term contracts. If you cancel, your data is retained for 30 days before deletion.",
  },
];

// Helper to bridge new and old limit types
function toLegacyLimit(limit: CentralLimitValue): number | null {
  return limit === "unlimited" ? null : limit;
}

// Keep the bridge functions for new components
export function canUseFeature(planId: PlanId, feature: string) {
  const plan = getPlan(planId);
  // Check both the features list and any special logic
  if (feature === "bookkeeperPortfolio" || feature === "bookkeeperMode") {
    return plan.id.includes("bookkeeper") || plan.id.includes("pro");
  }
  return plan.features.some(f => f.toLowerCase().includes(feature.toLowerCase()));
}

export function getRemainingUsage(
  account: BillingAccountLike,
  usageType: keyof Plan["limits"],
) {
  const limit = getPlan(account.planId).limits[usageType];
  if (limit === null) return "unlimited";
  const used = account.usage[usageType] || 0;
  return Math.max(0, limit - used);
}

export function isTrialExpired(account: BillingAccountLike) {
  if (account.planId.toLowerCase() !== "trial" || !account.trialEndsAt) return false;
  return new Date(account.trialEndsAt).getTime() <= Date.now();
}

export function getTrialState(account: BillingAccountLike): string {
  if (account.planId.toLowerCase() !== "trial") return "not_trial";
  if (!isTrialExpired(account)) return "active";
  
  // Check grace period (30 days after trialEndsAt)
  const graceEndsAt = account.graceEndsAt || account.gracePeriodEndsAt;
  if (!graceEndsAt) return "expired_locked";
  
  const inGrace = new Date(graceEndsAt).getTime() > Date.now();
  return inGrace ? "expired_grace" : "expired_locked";
}

export function getPlanConfig(planId: PlanId) {
  return getPlan(planId);
}

export function getPlanLimit(planId: PlanId, limitType: keyof Plan["limits"]) {
  return getPlan(planId).limits[limitType];
}
