import type {
  BillingAccount,
  PlanId,
  SubscriptionStatus,
  UsageCounters,
  UsageType,
} from "@/lib/billing/plans";
import { getPlanConfig, isTrialExpired } from "@/lib/billing/plans";

export const demoUserStorageKey = "zentra.demoUser.v1";
export const betaRequestStorageKey = "zentra.betaRequest.v1";
export const betaRequestsStorageKey = "zentra.betaRequests.v1";
export const onboardingStorageKey = "zentra.onboarding.v1";
export const pendingIdentityStorageKey = "zentra.pendingIdentity.v1";

export const demoAccountDays = 7;
export const betaAccountDays = 60;

export const ownerEmail =
  process.env.NEXT_PUBLIC_ZENTRA_OWNER_EMAIL ?? "founder@zentracollect.co.uk";

export const betaAccessCode =
  process.env.NEXT_PUBLIC_ZENTRA_BETA_CODE ?? "ZENTRA-BETA";

export type DemoUser = {
  name: string;
  email: string;
  businessName: string;
  accountType: BillingAccount["accountType"];
  planId: PlanId;
  subscriptionStatus: SubscriptionStatus;
  createdAt: string;
  expiresAt: string;
  trialEndsAt?: string;
  graceEndsAt?: string;
  usage: UsageCounters;
  betaApprovedAt?: string;
  emailAddon?: boolean;
};

export type BetaAccessRequest = {
  name: string;
  email: string;
  businessName: string;
  role: string;
  reason: string;
  isBookkeeper?: boolean;
  clientCountEstimate?: number;
  accountingSoftware?: string;
  monthlyInvoiceVolume?: string;
  mainArPainPoint?: string;
  wouldUploadSampleFile?: string;
  wouldPayFoundingPricing?: string;
  optionalMessage?: string;
  requestedAt: string;
  status: "pending";
};

export type OnboardingAccountType =
  | "demo"
  | "trial";

export type OnboardingState = {
  selectedAccountType: OnboardingAccountType;
  selectedPlan: PlanId;
  trialStartedAt?: string;
  betaRequestedAt?: string;
  businessName: string;
  isBookkeeper: boolean;
  clientCountEstimate?: number;
  accountingSoftware?: string;
  monthlyInvoiceVolume?: string;
  mainArPainPoint?: string;
  completedAt: string;
};

export type PendingIdentity = {
  name: string;
  email: string;
  businessName: string;
  createdAt: string;
};

export function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function isDemoUserExpired(user: DemoUser) {
  if (user.planId === "demo") return false;
  if (user.planId === "trial") return false;
  return new Date(user.expiresAt).getTime() <= Date.now();
}

export function formatAccountExpiry(expiresAt: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(expiresAt));
}

export function createUsageCounters(
  overrides: Partial<UsageCounters> = {},
): UsageCounters {
  return {
    activeInvoices: 0,
    importBatches: 0,
    importsThisMonth: 0,
    aiActionsThisMonth: 0,
    clientLedgers: 1,
    ...overrides,
  };
}

export function createLocalAccount({
  name,
  email,
  businessName,
  planId,
}: {
  name: string;
  email: string;
  businessName: string;
  planId: PlanId;
}): DemoUser {
  const now = new Date();
  const plan = getPlanConfig(planId);
  const trialEndsAt = plan.trialDays ? addDays(now, plan.trialDays).toISOString() : undefined;
  const graceEndsAt =
    trialEndsAt && plan.graceDays
      ? addDays(new Date(trialEndsAt), plan.graceDays).toISOString()
      : undefined;
  const expiresAt =
    planId === "demo"
      ? addDays(now, 3650).toISOString()
      : trialEndsAt ?? addDays(now, betaAccountDays).toISOString();

  return {
    name: name.trim() || "Demo user",
    email: email.trim(),
    businessName: businessName.trim() || "Demo business",
    accountType: plan.accountType,
    planId,
    subscriptionStatus:
      plan.accountType === "demo"
        ? "demo"
        : plan.accountType === "trial"
          ? "trialing"
          : "active",
    createdAt: now.toISOString(),
    expiresAt,
    trialEndsAt,
    graceEndsAt,
    usage: createUsageCounters(),
    betaApprovedAt: undefined,
  };
}

export function toBillingAccount(user: DemoUser): BillingAccount {
  return {
    planId: user.planId,
    accountType: user.accountType,
    subscriptionStatus: isTrialExpired({
      ...user,
      currentPeriodStartedAt: user.createdAt,
    })
      ? "expired"
      : user.subscriptionStatus,
    createdAt: user.createdAt,
    trialStartedAt: user.planId === "trial" ? user.createdAt : undefined,
    trialEndsAt: user.trialEndsAt,
    graceEndsAt: user.graceEndsAt,
    currentPeriodStartedAt: user.createdAt,
    usage: user.usage ?? createUsageCounters(),
  };
}

export function readLocalAccount() {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(demoUserStorageKey);
  if (!raw) return null;
  try {
    return normaliseLocalAccount(JSON.parse(raw) as Partial<DemoUser>);
  } catch {
    window.localStorage.removeItem(demoUserStorageKey);
    return null;
  }
}

export function writeLocalAccount(user: DemoUser) {
  window.localStorage.setItem(demoUserStorageKey, JSON.stringify(user));
  try {
    window.dispatchEvent(new StorageEvent("storage", { key: demoUserStorageKey }));
  } catch {
    window.dispatchEvent(new Event("storage"));
  }
  window.dispatchEvent(new Event("zentra-account-change"));
}

export function readPendingIdentity() {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(pendingIdentityStorageKey);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PendingIdentity;
  } catch {
    window.localStorage.removeItem(pendingIdentityStorageKey);
    return null;
  }
}

export function writePendingIdentity(identity: Omit<PendingIdentity, "createdAt">) {
  const pendingIdentity: PendingIdentity = {
    name: identity.name.trim() || "Demo user",
    email: identity.email.trim(),
    businessName: identity.businessName.trim() || "Demo business",
    createdAt: new Date().toISOString(),
  };
  window.localStorage.setItem(
    pendingIdentityStorageKey,
    JSON.stringify(pendingIdentity),
  );
  return pendingIdentity;
}

export function readOnboardingState() {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(onboardingStorageKey);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as OnboardingState;
  } catch {
    window.localStorage.removeItem(onboardingStorageKey);
    return null;
  }
}

export function writeOnboardingState(state: Omit<OnboardingState, "completedAt">) {
  const nextState: OnboardingState = {
    ...state,
    completedAt: new Date().toISOString(),
  };
  window.localStorage.setItem(onboardingStorageKey, JSON.stringify(nextState));
  return nextState;
}

export function incrementUsage(usageType: UsageType, amount = 1) {
  const user = readLocalAccount();
  if (!user) return null;
  const nextUser = {
    ...user,
    usage: {
      ...createUsageCounters(user.usage),
      [usageType]: (user.usage?.[usageType] ?? 0) + amount,
    },
  };
  writeLocalAccount(nextUser);
  return nextUser;
}

export function setUsage(usageType: UsageType, value: number) {
  const user = readLocalAccount();
  if (!user) return null;
  const nextUser = {
    ...user,
    usage: {
      ...createUsageCounters(user.usage),
      [usageType]: value,
    },
  };
  writeLocalAccount(nextUser);
  return nextUser;
}

export function normaliseLocalAccount(user: Partial<DemoUser>): DemoUser {
  const planId = user.planId ?? "demo";
  const fallback = createLocalAccount({
    name: user.name ?? "Demo user",
    email: user.email ?? "demo@example.co.uk",
    businessName: user.businessName ?? "Demo business",
    planId,
  });

  return {
    ...fallback,
    ...user,
    planId,
    accountType: user.accountType ?? fallback.accountType,
    subscriptionStatus: user.subscriptionStatus ?? fallback.subscriptionStatus,
    expiresAt: user.expiresAt ?? fallback.expiresAt,
    usage: createUsageCounters(user.usage),
  };
}
