/**
 * src/lib/billing/plans.ts
 *
 * Central source of truth for every Zentra Collect plan.
 * Import from here — never hardcode plan names, limits, prices, features,
 * FAQ answers, or comparison table values anywhere else in the UI.
 *
 * TODO: When wiring Stripe billing, map plan IDs to Stripe Product IDs in a
 *   separate src/lib/billing/stripe.ts. Keep this file as the canonical
 *   product definition; Stripe is an implementation detail.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type PlanId = "demo" | "trial" | "single" | "starter" | "pro";
export type PlanTier = "free" | "trial" | "paid";

export interface PlanLimits {
  /** Max concurrent non-paid active invoices. null = sample data only (demo). */
  activeInvoices: number | null;
  /** Max concurrent client ledgers. 0 = no real ledgers (demo). */
  ledgers: number;
  /**
   * Max CSV/Excel imports per calendar month.
   * 0  = no real imports (demo).
   * null = unlimited within invoice cap (bookkeeper plans).
   */
  importsPerMonth: number | null;
  /** Max AI actions per calendar month (drafts, rewrites, classifications, summaries). */
  aiActionsPerMonth: number;
  /** Max saved import column-mapping templates. */
  savedImportMappings: number;
}

export interface Plan {
  readonly id: PlanId;
  readonly name: string;
  /** Monthly price in GBP. 0 for free / trial tiers. */
  readonly price: number;
  /** Display string for the price, e.g. "£39" or "Free". */
  readonly priceDisplay: string;
  /** Display string for the billing period, e.g. "/month" or "". */
  readonly periodDisplay: string;
  readonly tagline: string;
  readonly tier: PlanTier;
  readonly limits: PlanLimits;
  readonly features: readonly string[];
  /** Visually highlighted on the full /pricing page. */
  readonly highlight: boolean;
  readonly highlightLabel: string | null;
  /** Visually highlighted in the landing page pricing card row. */
  readonly landingHighlight: boolean;
  /** Appears in the landing page pricing section. */
  readonly showOnLanding: boolean;
  readonly cta: string;
  readonly href: string;
}

// ── Plan definitions ──────────────────────────────────────────────────────────

export const PLANS: readonly Plan[] = [
  {
    id: "demo",
    name: "Demo",
    price: 0,
    priceDisplay: "Free",
    periodDisplay: "",
    tagline: "Explore the product with pre-loaded sample invoices. No sign-up required.",
    tier: "free",
    limits: {
      activeInvoices: null,     // sample data only
      ledgers: 0,
      importsPerMonth: 0,       // no real imports
      aiActionsPerMonth: 3,     // 3 sample AI drafts
      savedImportMappings: 0,
    },
    features: [
      "Sample dashboard",
      "Sample ranked chase plan",
      "3 sample AI drafts",
      "No real saved data",
      "No sign-up required",
    ],
    highlight: false,
    highlightLabel: null,
    landingHighlight: false,
    showOnLanding: false,
    cta: "Try the demo",
    href: "/dashboard",
  },

  {
    id: "trial",
    name: "14-day Trial",
    price: 0,
    priceDisplay: "Free",
    periodDisplay: " / 14 days",
    tagline: "Try with your own real invoice data. No card required.",
    tier: "trial",
    limits: {
      activeInvoices: 100,
      ledgers: 1,
      importsPerMonth: 2,       // 2 imports across the whole trial
      aiActionsPerMonth: 25,
      savedImportMappings: 1,
    },
    features: [
      "1 business",
      "100 active invoices",
      "2 imports during trial",
      "25 AI actions",
      "Real data allowed",
      "Copy-only messages",
      "No card required",
    ],
    highlight: false,
    highlightLabel: null,
    landingHighlight: false,
    showOnLanding: false,
    cta: "Start free trial",
    href: "/request-access",
  },

  {
    id: "single",
    name: "Single Business",
    price: 39,
    priceDisplay: "£39",
    periodDisplay: "/month",
    tagline: "For one small business chasing its own overdue invoices.",
    tier: "paid",
    limits: {
      activeInvoices: 500,
      ledgers: 1,
      importsPerMonth: 10,
      aiActionsPerMonth: 200,
      savedImportMappings: 5,
    },
    features: [
      "1 business",
      "500 active invoices",
      "10 imports/month",
      "200 AI actions/month",
      "Ranked chase plan",
      "Scenario collection actions",
      "Re-import comparison",
      "Weekly digest",
      "Promise & dispute tracking",
    ],
    highlight: false,
    highlightLabel: null,
    landingHighlight: true,    // highlighted on the homepage 3-plan row
    showOnLanding: true,
    cta: "Request founding access",
    href: "/request-access",
  },

  {
    id: "starter",
    name: "Bookkeeper Starter",
    price: 99,
    priceDisplay: "£99",
    periodDisplay: "/month",
    tagline: "For bookkeepers managing a small portfolio of client ledgers.",
    tier: "paid",
    limits: {
      activeInvoices: 2000,
      ledgers: 5,
      importsPerMonth: null,   // included — no hard monthly limit
      aiActionsPerMonth: 500,
      savedImportMappings: 25,
    },
    features: [
      "Up to 5 client ledgers",
      "2,000 active invoices",
      "500 AI actions/month",
      "Portfolio dashboard",
      "Client-by-client chase plans",
      "Weekly client summaries",
      "Everything in Single Business",
    ],
    highlight: true,           // highlighted on the full /pricing page
    highlightLabel: "Most popular",
    landingHighlight: false,
    showOnLanding: true,
    cta: "Request founding access",
    href: "/request-access",
  },

  {
    id: "pro",
    name: "Bookkeeper Pro",
    price: 199,
    priceDisplay: "£199",
    periodDisplay: "/month",
    tagline: "For practices managing a larger portfolio with complex collections work.",
    tier: "paid",
    limits: {
      activeInvoices: 7500,
      ledgers: 20,
      importsPerMonth: null,   // included
      aiActionsPerMonth: 1500,
      savedImportMappings: 100,
    },
    features: [
      "Up to 20 client ledgers",
      "7,500 active invoices",
      "1,500 AI actions/month",
      "Advanced portfolio view",
      "Monthly collections reports",
      "Reusable import templates",
      "Everything in Bookkeeper Starter",
    ],
    highlight: false,
    highlightLabel: null,
    landingHighlight: false,
    showOnLanding: true,
    cta: "Request founding access",
    href: "/request-access",
  },
];

// ── Lookup helpers ─────────────────────────────────────────────────────────────

export function getPlan(id: PlanId): Plan {
  const plan = PLANS.find((p) => p.id === id);
  if (!plan) throw new Error(`Unknown plan id: "${id}"`);
  return plan;
}

/** Plans shown in the landing page pricing card row (the 3 paid tiers). */
export function getLandingPlans(): Plan[] {
  return PLANS.filter((p) => p.showOnLanding) as Plan[];
}

/** All paid (non-free, non-trial) plans. */
export function getPaidPlans(): Plan[] {
  return PLANS.filter((p) => p.tier === "paid") as Plan[];
}

/**
 * Format a numeric limit for display.
 * null  → "Included"
 * 0     → "—"
 * n     → "1,000"
 */
export function formatLimit(value: number | null, suffix = ""): string {
  if (value === null) return "Included";
  if (value === 0) return "—";
  return `${value.toLocaleString("en-GB")}${suffix}`;
}

// ── Comparison table ──────────────────────────────────────────────────────────

export type ComparisonCellValue = string | boolean;

export interface ComparisonRow {
  readonly label: string;
  readonly values: Readonly<Record<PlanId, ComparisonCellValue>>;
}

export const COMPARISON_ROWS: readonly ComparisonRow[] = [
  {
    label: "Active invoices",
    values: { demo: "Sample only", trial: "100", single: "500", starter: "2,000", pro: "7,500" },
  },
  {
    label: "Client ledgers",
    values: { demo: "—", trial: "1", single: "1", starter: "Up to 5", pro: "Up to 20" },
  },
  {
    label: "Imports / month",
    values: { demo: "—", trial: "2 total", single: "10", starter: "Included", pro: "Included" },
  },
  {
    label: "AI actions / month",
    values: { demo: "3 (sample)", trial: "25", single: "200", starter: "500", pro: "1,500" },
  },
  {
    label: "Real invoice data",
    values: { demo: false, trial: true, single: true, starter: true, pro: true },
  },
  {
    label: "Ranked chase plan",
    values: { demo: true, trial: true, single: true, starter: true, pro: true },
  },
  {
    label: "Safety checks",
    values: { demo: true, trial: true, single: true, starter: true, pro: true },
  },
  {
    label: "Promise & dispute tracking",
    values: { demo: false, trial: true, single: true, starter: true, pro: true },
  },
  {
    // Demo users can view a sample digest to evaluate the feature before signing up.
    // "Sample" renders as a text cell (not a checkmark) to distinguish it from
    // full access. Trial users cannot access the digest — it's a paid-plan feature.
    label: "Weekly digest",
    values: { demo: "Sample", trial: false, single: true, starter: true, pro: true },
  },
  {
    label: "Portfolio dashboard",
    values: { demo: false, trial: false, single: false, starter: true, pro: true },
  },
  {
    label: "Client-by-client chase plans",
    values: { demo: false, trial: false, single: false, starter: true, pro: true },
  },
  {
    label: "Weekly client summaries",
    values: { demo: false, trial: false, single: false, starter: true, pro: true },
  },
  {
    label: "Monthly collections reports",
    values: { demo: false, trial: false, single: false, starter: false, pro: true },
  },
  {
    // Shows numeric limits that match the savedImportMappings plan limits.
    // All paid plans can save templates; the limit increases with each tier.
    label: "Saved import templates",
    values: { demo: "—", trial: "1", single: "5", starter: "25", pro: "100" },
  },
];

// ── FAQ ───────────────────────────────────────────────────────────────────────

export interface FaqItem {
  readonly q: string;
  readonly a: string;
}

export const FAQS: readonly FaqItem[] = [
  {
    q: "Do I need Xero or QuickBooks?",
    a: "No. You can start with a CSV or Excel export from any accounting system — or no accounting system at all. Upload your overdue invoice list and Zentra maps the columns automatically.",
  },
  {
    q: "Does Zentra send emails automatically?",
    a: "Not in the current version. You review and approve every message. Zentra drafts the email and you copy it into your own email client. Nothing is sent automatically, ever.",
  },
  {
    q: "Is this legal or debt collection advice?",
    a: "No. Zentra Collect is a decision-support and message-drafting tool. It helps you prioritise which invoices to follow up and prepares professional draft messages for your review. It does not provide legal advice, act as a debt collector, or recommend legal action.",
  },
  {
    q: "What counts as an AI action?",
    a: "Generating a draft email, rewriting a draft, classifying an incoming reply, identifying ambiguous import column mappings, and generating narrative summaries. Deterministic work — ranking invoices, calculating days overdue, running safety checks, diffing import batches — never counts as an AI action.",
  },
  {
    q: "Can bookkeepers manage multiple clients?",
    a: "Yes. Bookkeeper plans give each client their own ledger, their own ranked chase plan, and their own import history. The portfolio dashboard shows risk and priority across all clients in a single view.",
  },
  {
    q: "What happens after the trial?",
    a: "Your imported data stays visible and you can continue reviewing your chase plan and tracking status. New imports and AI actions are gated until you upgrade to a paid plan.",
  },
];

// ── Included in every paid plan ───────────────────────────────────────────────

export const EVERY_PAID_PLAN_INCLUDES: readonly string[] = [
  "CSV & Excel import — no accounting software required",
  "Rules-based ranking engine — deterministic and explainable",
  "Scenario-aware collection actions",
  "Pre-send safety checks",
  "Re-import comparison — see what changed since last upload",
  "Promise & dispute tracking",
  "Audit activity log",
  "Human review required — no auto-send, ever",
];
