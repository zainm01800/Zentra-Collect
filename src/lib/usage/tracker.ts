/**
 * src/lib/usage/tracker.ts
 *
 * Pure types and computation functions for usage tracking.
 * No side-effects, no storage — safe to import anywhere.
 *
 * The in-memory mock store lives in ./store.ts.
 * TODO: When adding Supabase, replace the store module but keep
 *   these pure types and functions intact.
 */

import type { PlanId, PlanTier } from "@/lib/billing/plans";
import { getPlan } from "@/lib/billing/plans";

// ── Core types ────────────────────────────────────────────────────────────────

/**
 * All dimensions of usage that can be tracked or checked.
 *
 * "setActiveInvoices" is a special type that replaces (not increments)
 * the activeInvoices counter — used after a successful import to reflect
 * the new total of non-paid invoices.
 */
export type UsageType =
  | "aiAction"
  | "import"
  | "setActiveInvoices"
  | "addClientLedger"
  | "addImportMapping"
  | "weeklyDigest";

/**
 * Specific AI operation types, for audit logging.
 * These all count against the plan's aiActionsPerMonth limit.
 *
 * What counts as an AI action:
 *   draft_generation      — generate-draft route called AI (Gemini or OpenAI)
 *   draft_rewrite         — future: re-draft with different tone
 *   reply_classification  — classify-reply route escalated to AI (not rules-based)
 *   import_mapping_assist — future: AI-assisted column mapping for ambiguous headers
 *   digest_narrative      — future: AI-generated narrative for weekly digest summary
 *
 * What does NOT count:
 *   - Template fallbacks (no AI called)
 *   - Rules-based reply classification (rulesResult !== "unclear")
 *   - Deterministic ranking, diffing, safety checks, formatting
 */
export type AIActionType =
  | "draft_generation"
  | "draft_rewrite"
  | "reply_classification"
  | "import_mapping_assist"
  | "digest_narrative";

// ── Account model ─────────────────────────────────────────────────────────────

export interface AccountUsage {
  id: string;
  planId: PlanId;

  // ── Monthly counters — reset at the start of each calendar month ──────────
  /** "YYYY-MM" key — when this drifts from current month, monthly counters reset. */
  monthlyPeriodKey: string;
  importsThisMonth: number;
  aiActionsThisMonth: number;
  weeklyDigestsGenerated: number;

  // ── Snapshot counters — current state, not reset monthly ─────────────────
  activeInvoices: number;
  clientLedgers: number;
  savedImportMappings: number;

  // ── Trial-specific lifetime counters ──────────────────────────────────────
  /** Total imports used during the trial (not per-month; trial has a total cap). */
  trialImportsUsed: number;
  /** Total AI actions used during the trial. */
  trialAIActionsUsed: number;
  trialStartedAt: string | null;  // ISO date string
  trialEndsAt: string | null;     // ISO date string
  /** Grace period: data is still readable but new actions are blocked. */
  gracePeriodEndsAt: string | null;
}

// ── Check result ──────────────────────────────────────────────────────────────

export interface CanPerformResult {
  allowed: boolean;
  reason?: string;
  /** How many more units can be used before hitting the limit. null = unlimited. */
  remaining: number | null;
}

// ── Usage meter (for UI rendering) ───────────────────────────────────────────

export interface UsageMeter {
  label: string;
  used: number;
  /** null = no hard limit (included in plan). */
  limit: number | null;
  /** null when limit is null. */
  remaining: number | null;
  /** null when limit is null. 0–100. */
  percentUsed: number | null;
  /** true when used >= limit (and limit is not null). */
  isAtLimit: boolean;
  /** Whether this counter resets at the start of each month. */
  resetsMonthly: boolean;
}

// ── Full snapshot (returned to UI and API clients) ───────────────────────────

export interface UsageSnapshot {
  accountId: string;
  planId: PlanId;
  planName: string;
  tier: PlanTier;
  isTrial: boolean;
  trialDaysRemaining: number | null;
  trialEndsAt: string | null;
  isExpired: boolean;
  periodKey: string;
  meters: {
    aiActions: UsageMeter;
    imports: UsageMeter;
    activeInvoices: UsageMeter;
    clientLedgers: UsageMeter;
    savedImportMappings: UsageMeter;
    weeklyDigests: UsageMeter;
  };
  /** Quick flags for callers that need a simple yes/no. */
  canPerformAIAction: boolean;
  canPerformImport: boolean;
}

// ── Pure helpers ──────────────────────────────────────────────────────────────

/** Returns the current calendar-month key, e.g. "2026-05". */
export function currentPeriodKey(): string {
  return new Date().toISOString().slice(0, 7);
}

/** Days remaining in a trial. Returns null if no trial, 0 if expired. */
export function computeTrialDaysRemaining(endsAt: string | null): number | null {
  if (!endsAt) return null;
  const ms = new Date(endsAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

/** Build a UsageMeter value object from raw numbers. */
export function buildMeter(
  label: string,
  used: number,
  limit: number | null,
  resetsMonthly: boolean,
): UsageMeter {
  if (limit === null) {
    return { label, used, limit: null, remaining: null, percentUsed: null, isAtLimit: false, resetsMonthly };
  }
  const remaining = Math.max(0, limit - used);
  const percentUsed = limit === 0 ? 100 : Math.round((used / limit) * 100);
  return { label, used, limit, remaining, percentUsed, isAtLimit: used >= limit, resetsMonthly };
}

// ── Pure computation ──────────────────────────────────────────────────────────

/**
 * Check whether an operation is allowed given the current account state.
 * Pure — does not mutate anything.
 */
export function checkCanPerform(
  account: AccountUsage,
  usageType: UsageType,
  amount = 1,
): CanPerformResult {
  const plan = getPlan(account.planId);
  const limits = plan.limits;

  // ── Trial expiry ─────────────────────────────────────────────────────────
  if (plan.tier === "trial" && account.trialEndsAt) {
    if (new Date() > new Date(account.trialEndsAt)) {
      return { allowed: false, reason: "Your trial has expired. Upgrade to continue.", remaining: 0 };
    }
  }

  // ── Demo plan — no real imports or ledgers ────────────────────────────────
  if (plan.tier === "free") {
    if (usageType === "import") {
      return { allowed: false, reason: "The demo uses sample data only. Start a trial to import real invoices.", remaining: 0 };
    }
    if (usageType === "addClientLedger") {
      return { allowed: false, reason: "Client ledgers require a trial or paid plan.", remaining: 0 };
    }
    // AI actions: demo allows 3 sample drafts
    if (usageType === "aiAction") {
      const remaining = Math.max(0, limits.aiActionsPerMonth - account.aiActionsThisMonth);
      if (account.aiActionsThisMonth + amount > limits.aiActionsPerMonth) {
        return { allowed: false, reason: `Demo is limited to ${limits.aiActionsPerMonth} sample AI drafts.`, remaining };
      }
      return { allowed: true, remaining };
    }
  }

  // ── Per-type checks ───────────────────────────────────────────────────────
  switch (usageType) {
    case "aiAction": {
      const limit = limits.aiActionsPerMonth;
      // Trial: use lifetime counter
      const used = plan.tier === "trial" ? account.trialAIActionsUsed : account.aiActionsThisMonth;
      const remaining = Math.max(0, limit - used);
      if (used + amount > limit) {
        const ctx = plan.tier === "trial" ? "trial" : "this month";
        return { allowed: false, reason: `AI action limit reached for ${ctx} (${limit} total).`, remaining };
      }
      return { allowed: true, remaining };
    }

    case "import": {
      const limit = limits.importsPerMonth;
      if (limit === null) return { allowed: true, remaining: null }; // unlimited
      if (limit === 0) return { allowed: false, reason: "Imports are not available on this plan.", remaining: 0 };
      // Trial: use lifetime counter
      const used = plan.tier === "trial" ? account.trialImportsUsed : account.importsThisMonth;
      const remaining = Math.max(0, limit - used);
      if (used + amount > limit) {
        const ctx = plan.tier === "trial" ? "during trial" : "this month";
        return { allowed: false, reason: `Import limit reached (${limit} ${ctx}).`, remaining };
      }
      return { allowed: true, remaining };
    }

    case "setActiveInvoices": {
      // 'amount' here is the new total, not an increment
      const limit = limits.activeInvoices;
      if (limit === null) return { allowed: false, reason: "Active invoice tracking unavailable on demo.", remaining: 0 };
      if (amount > limit) {
        return {
          allowed: false,
          reason: `Active invoice limit is ${limit.toLocaleString("en-GB")} on your plan.`,
          remaining: Math.max(0, limit - account.activeInvoices),
        };
      }
      return { allowed: true, remaining: Math.max(0, limit - amount) };
    }

    case "addClientLedger": {
      const limit = limits.ledgers;
      const remaining = Math.max(0, limit - account.clientLedgers);
      if (account.clientLedgers + amount > limit) {
        return { allowed: false, reason: `Client ledger limit is ${limit} on your plan.`, remaining };
      }
      return { allowed: true, remaining };
    }

    case "addImportMapping": {
      const limit = limits.savedImportMappings;
      const remaining = Math.max(0, limit - account.savedImportMappings);
      if (account.savedImportMappings + amount > limit) {
        return { allowed: false, reason: `Saved mapping template limit is ${limit} on your plan.`, remaining };
      }
      return { allowed: true, remaining };
    }

    case "weeklyDigest":
      // No hard limit — tracked for information only
      return { allowed: true, remaining: null };

    default:
      return { allowed: true, remaining: null };
  }
}

/**
 * Compute a full UsageSnapshot from an account and its plan.
 * Pure — does not mutate anything.
 */
export function computeUsageSnapshot(account: AccountUsage): UsageSnapshot {
  const plan = getPlan(account.planId);
  const limits = plan.limits;
  const isTrial = plan.tier === "trial";
  const trialDaysRemaining = computeTrialDaysRemaining(account.trialEndsAt);
  const isExpired =
    isTrial && account.trialEndsAt
      ? new Date() > new Date(account.trialEndsAt)
      : false;

  // For trial plans, use lifetime counters against the plan limit
  const aiUsed = isTrial ? account.trialAIActionsUsed : account.aiActionsThisMonth;
  const importUsed = isTrial ? account.trialImportsUsed : account.importsThisMonth;
  const importLimit = limits.importsPerMonth; // null = unlimited, 0 = N/A

  const meters: UsageSnapshot["meters"] = {
    aiActions: buildMeter(
      "AI actions",
      aiUsed,
      limits.aiActionsPerMonth,
      !isTrial,
    ),
    imports: buildMeter(
      "Imports",
      importUsed,
      importLimit,
      !isTrial && importLimit !== null,
    ),
    activeInvoices: buildMeter(
      "Active invoices",
      account.activeInvoices,
      limits.activeInvoices,
      false,
    ),
    clientLedgers: buildMeter(
      "Client ledgers",
      account.clientLedgers,
      limits.ledgers === 0 ? null : limits.ledgers,
      false,
    ),
    savedImportMappings: buildMeter(
      "Saved import templates",
      account.savedImportMappings,
      limits.savedImportMappings === 0 ? null : limits.savedImportMappings,
      false,
    ),
    weeklyDigests: buildMeter(
      "Weekly digests",
      account.weeklyDigestsGenerated,
      null, // informational only — no hard plan limit
      true,
    ),
  };

  const canPerformAIAction = checkCanPerform(account, "aiAction", 1).allowed && !isExpired;
  const canPerformImport = checkCanPerform(account, "import", 1).allowed && !isExpired;

  return {
    accountId: account.id,
    planId: plan.id,
    planName: plan.name,
    tier: plan.tier,
    isTrial,
    trialDaysRemaining,
    trialEndsAt: account.trialEndsAt,
    isExpired,
    periodKey: account.monthlyPeriodKey,
    meters,
    canPerformAIAction,
    canPerformImport,
  };
}
