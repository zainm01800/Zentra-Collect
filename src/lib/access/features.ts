/**
 * src/lib/access/features.ts
 *
 * Pure access-control layer for Zentra Collect plan features.
 * No I/O, no store calls — takes a UsageSnapshot and returns decisions.
 *
 * Usage:
 *   // In a server page (call getUsageSnapshot first):
 *   const result = requireFeature(snapshot, "real_import");
 *   if (!result.allowed) return <UpgradeScreen config={getRedirectOrUpgradePrompt(snapshot, "real_import")} />;
 *
 *   // For quota-based checks (remaining uses this month):
 *   const cap = requirePlanCapability(snapshot, "import");
 *
 * TODO: Once auth is live, replace DEMO_ACCOUNT_ID with session.user.accountId
 *   when fetching the snapshot in each page.
 */

import type { UsageSnapshot } from "@/lib/usage/tracker";
import type { PlanId } from "@/lib/billing/plans";
import { getPlan } from "@/lib/billing/plans";

// ── Feature names ─────────────────────────────────────────────────────────────

/**
 * Named features that have binary plan-tier access rules.
 *
 * real_import         — Uploading and processing real invoice files (CSV/Excel)
 * weekly_digest       — Weekly collections digest page
 * bookkeeper_portfolio — Multi-client portfolio dashboard and per-client plans
 */
export type Feature =
  | "real_import"
  | "weekly_digest"
  | "bookkeeper_portfolio";

/**
 * Quota-based capabilities checked against remaining monthly/lifetime counters.
 *
 * "import"   — one more import this period (checked via canPerformImport)
 * "aiAction" — one more AI draft or classification (checked via canPerformAIAction)
 */
export type Capability = "import" | "aiAction";

// ── Result types ──────────────────────────────────────────────────────────────

export interface AccessResult {
  /** Whether the feature/capability is allowed right now. */
  allowed: boolean;
  /** True when the account's trial period has lapsed. */
  isExpiredTrial: boolean;
  /**
   * The minimum plan that would unlock this feature.
   * null means the feature is available on the current plan but a quota is
   * exhausted (upgrade may help, or wait until reset).
   */
  upgradeTarget: PlanId | null;
  /** Human-readable reason for denial — used in UI. */
  reason?: string;
}

export interface UpgradePromptConfig {
  /** Page heading shown in the upgrade screen. */
  heading: string;
  /** One-paragraph description of the feature and its value. */
  description: string;
  /** Short bullet points — what the user gets when they upgrade. */
  bullets: readonly string[];
  /**
   * The plan that unlocks this feature, for "Included in X · £Y/month" note.
   * null = no single plan target (e.g. trial expiry — any paid plan works).
   */
  upgradeTarget: PlanId | null;
  ctaPrimary: { text: string; href: string };
  ctaSecondary: { text: string; href: string };
}

// ── Feature access matrix ─────────────────────────────────────────────────────

/**
 * Check whether a named feature is available to this account right now.
 *
 * Rules:
 *   real_import         — trial or paid, and not expired
 *   weekly_digest       — paid plans only (single / starter / pro)
 *   bookkeeper_portfolio — starter or pro only
 */
export function requireFeature(
  snapshot: UsageSnapshot,
  feature: Feature,
): AccessResult {
  const { tier, planId, isExpired } = snapshot;

  const base: Pick<AccessResult, "isExpiredTrial"> = {
    isExpiredTrial: isExpired,
  };

  switch (feature) {
    case "real_import":
      // Demo cannot import. Expired trial cannot import.
      if (tier === "free") {
        return {
          ...base,
          allowed: false,
          upgradeTarget: "trial",
          reason: "Real invoice imports are not available in demo mode.",
        };
      }
      if (isExpired) {
        return {
          ...base,
          allowed: false,
          upgradeTarget: "single_business",
          reason: "Your trial has expired. Upgrade to continue importing.",
        };
      }
      return { ...base, allowed: true, upgradeTarget: null };

    case "weekly_digest":
      // Demo users can view the weekly digest with sample data — it helps
      // them evaluate the feature before signing up.
      // Trial users are gated — digest is a paid-plan feature.
      if (tier === "free") {
        return { ...base, allowed: true, upgradeTarget: null };
      }
      if (tier === "trial") {
        return {
          ...base,
          allowed: false,
          upgradeTarget: "single_business",
          reason: "The weekly digest is included in Business and above.",
        };
      }
      return { ...base, allowed: true, upgradeTarget: null };

    case "bookkeeper_portfolio":
      // Portfolio requires Starter or Pro.
      if (planId === "bookkeeper_starter" || planId === "bookkeeper_pro") {
        return { ...base, allowed: true, upgradeTarget: null };
      }
      return {
        ...base,
        allowed: false,
        upgradeTarget: "bookkeeper_starter",
        reason:
          planId === "single_business"
            ? "The portfolio view is a Bookkeeper feature. You're on Business."
            : "The portfolio view is included in Practice and above.",
      };

    default: {
      const _exhaustive: never = feature;
      void _exhaustive;
      return { ...base, allowed: true, upgradeTarget: null };
    }
  }
}

/**
 * Check whether a quota-based capability can be performed right now.
 *
 * This delegates to the pre-computed flags on the UsageSnapshot
 * (canPerformImport, canPerformAIAction) which already account for
 * plan limits, trial lifetime counters, and expiry.
 *
 * Use this for button/action gates — not for page-level access control.
 */
export function requirePlanCapability(
  snapshot: UsageSnapshot,
  capability: Capability,
): AccessResult {
  const { isExpired, planId, tier } = snapshot;

  const base: Pick<AccessResult, "isExpiredTrial"> = {
    isExpiredTrial: isExpired,
  };

  if (capability === "import") {
    if (snapshot.canPerformImport) {
      return { ...base, allowed: true, upgradeTarget: null };
    }
    const upgradeTarget: PlanId | null = isExpired
      ? "single_business"
      : tier === "free"
        ? "trial"
        : planId === "single_business" || planId === "trial"
          ? "bookkeeper_starter"
          : null;
    return {
      ...base,
      allowed: false,
      upgradeTarget,
      reason: isExpired
        ? "Your trial has expired."
        : tier === "free"
          ? "The demo does not support real imports."
          : "You've reached your import limit for this period.",
    };
  }

  // aiAction
  if (snapshot.canPerformAIAction) {
    return { ...base, allowed: true, upgradeTarget: null };
  }
  const upgradeTarget: PlanId | null = isExpired
    ? "single_business"
    : tier === "free"
      ? "trial"
      : planId === "single_business"
        ? "bookkeeper_starter"
        : planId === "bookkeeper_starter"
          ? "bookkeeper_pro"
          : null;
  return {
    ...base,
    allowed: false,
    upgradeTarget,
    reason: isExpired
      ? "Your trial has expired. Upgrade to generate AI drafts."
      : tier === "free"
        ? "You've used all 3 sample AI drafts. Start a trial for more."
        : "You've reached your AI action limit for this period.",
  };
}

// ── Upgrade prompt configs ────────────────────────────────────────────────────

/**
 * Returns a display config for the UpgradeScreen component.
 *
 * Returns null if the feature is allowed (caller should not show a screen).
 * Returns an UpgradePromptConfig with all text needed to render the screen.
 *
 * The function is separate from requireFeature so callers can call both
 * independently — requireFeature decides whether to gate, this decides what
 * to show when gated.
 */
export function getRedirectOrUpgradePrompt(
  snapshot: UsageSnapshot,
  feature: Feature,
): UpgradePromptConfig | null {
  const result = requireFeature(snapshot, feature);
  if (result.allowed) return null;

  const { tier, planId, isExpired } = snapshot;

  switch (feature) {
    case "real_import":
      if (isExpired) {
        return {
          heading: "Your trial has ended",
          description:
            "You can still view your existing chase plan and invoice data. To import new invoices and generate AI drafts, upgrade to a paid plan.",
          bullets: [
            "Keep all your imported data",
            "Unlimited imports on Bookkeeper plans",
            "200+ AI drafts per month",
            "No contract — cancel anytime",
          ],
          upgradeTarget: null,
          ctaPrimary: { text: "Request founding access", href: "/request-access" },
          ctaSecondary: { text: "View all plans", href: "/pricing" },
        };
      }
      // Demo mode
      return {
        heading: "Import your own invoices",
        description:
          "The demo uses pre-loaded sample data. Start a 14-day free trial to upload your own overdue invoice export from any accounting system — no card required.",
        bullets: [
          "CSV or Excel — no accounting software required",
          "Intelligent column mapping",
          "Re-import comparison — see what changed since last upload",
          "Ranked chase plan generated immediately",
        ],
        upgradeTarget: "trial",
        ctaPrimary: { text: "Start free trial", href: "/request-access" },
        ctaSecondary: { text: "Learn more", href: "/pricing" },
      };

    case "weekly_digest":
      // Only trial users hit this path now (demo users are allowed through).
      return {
        heading: "Weekly collections digest",
        description:
          "The weekly digest is included in Business and above. It gives you a structured Monday-ready summary: what changed, who to chase first, and what cash is expected.",
        bullets: [
          "Overdue movements week-on-week",
          "Top chase priorities with reasons",
          "Missed promises and pending disputes",
          "Ready to share with the business owner",
        ],
        upgradeTarget: "single_business",
        ctaPrimary: { text: "Request founding access", href: "/request-access" },
        ctaSecondary: { text: "See all plans", href: "/pricing" },
      };

    case "bookkeeper_portfolio": {
      // Business — they can see the most relevant upgrade context
      if (planId === "single_business") {
        return {
          heading: "Multi-client portfolio",
          description:
            "You're on Business, which covers one client ledger. Practice gives you up to 5 client ledgers with a unified portfolio view showing risk, overdue balances, and actions across all clients.",
          bullets: [
            "Portfolio overview across all client ledgers",
            "Client-by-client ranked chase plans",
            "Risk level and overdue total per client",
            "Up to 5 clients on Starter, 20 on Pro",
          ],
          upgradeTarget: "bookkeeper_starter",
          ctaPrimary: { text: "Request founding access", href: "/request-access" },
          ctaSecondary: { text: "Compare plans", href: "/pricing" },
        };
      }
      // Demo or trial
      return {
        heading: "Multi-client portfolio",
        description:
          "Track collections across all your clients in a single dashboard. See which ledgers need attention, who owes what, and which clients have overdue disputes — all in one place.",
        bullets: [
          "Unified view across all client ledgers",
          "Per-client ranked chase plans",
          "Risk-sorted client list",
          "Weekly summaries per client",
        ],
        upgradeTarget: "bookkeeper_starter",
        ctaPrimary: {
          text: tier === "free" ? "Start free trial" : "Request founding access",
          href: "/request-access",
        },
        ctaSecondary: { text: "See all plans", href: "/pricing" },
      };
    }

    default: {
      const _exhaustive: never = feature;
      void _exhaustive;
      return {
        heading: "Feature not available on your plan",
        description: "This feature requires a higher plan.",
        bullets: [],
        upgradeTarget: null,
        ctaPrimary: { text: "See all plans", href: "/pricing" },
        ctaSecondary: { text: "Back to dashboard", href: "/dashboard" },
      };
    }
  }
}

// ── Plan display helper ───────────────────────────────────────────────────────

/**
 * Returns a short display string for the plan that unlocks a feature.
 * e.g. "Business · £39/month"
 */
export function upgradeTargetLabel(planId: PlanId): string {
  const plan = getPlan(planId);
  if (plan.price === 0) return plan.name;
  return `${plan.name} · ${plan.priceDisplay}${plan.periodDisplay}`;
}

