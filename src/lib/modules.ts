/**
 * Module definitions for Zentra Collect.
 *
 * A "module" is a coherent slice of product capability. Users opt into the
 * modules they care about — sidebar nav and dashboard widgets configure
 * themselves from the enabled set. Some modules are gated to higher plan tiers.
 *
 * Collections is the core product and cannot be disabled.
 */

import type { PlanId } from "@/lib/billing/plans";

// ── Module identity ──────────────────────────────────────────────────────────

export type ModuleKey =
  | "collections"
  | "cashflow"
  | "expenses"
  | "tax"
  | "reports";

export interface ModuleConfig {
  key:           ModuleKey;
  label:         string;
  description:   string;
  /** Sidebar nav hrefs this module owns. Order matters. */
  navHrefs:      readonly string[];
  /** Required plan tier to enable this module (null = always available). */
  requiredPlan:  PlanId | null;
  /** Always-on modules cannot be turned off by the user. */
  alwaysOn:      boolean;
}

// ── Module registry ──────────────────────────────────────────────────────────

export const MODULES: Record<ModuleKey, ModuleConfig> = {
  collections: {
    key: "collections",
    label: "Collections",
    description: "Chase overdue invoices, manage promises and disputes.",
    navHrefs: ["/chase-today", "/customers", "/promises", "/disputes"],
    requiredPlan: null,
    alwaysOn: false,
  },
  cashflow: {
    key: "cashflow",
    label: "Cash flow",
    description: "Bank feed, safe-to-spend, cash flow forecast.",
    navHrefs: ["/banking"],
    requiredPlan: null,
    alwaysOn: false,
  },
  expenses: {
    key: "expenses",
    label: "Expenses",
    description: "Track and categorise business expenses.",
    navHrefs: ["/expenses"],
    requiredPlan: "single_business",
    alwaysOn: false,
  },
  tax: {
    key: "tax",
    label: "Tax & MTD",
    description: "Tax reserve, MTD compliance, and aged debt tracking.",
    navHrefs: ["/tax", "/mtd", "/aged-debt"],
    requiredPlan: "single_business",
    alwaysOn: false,
  },
  reports: {
    key: "reports",
    label: "Reports",
    description: "Monthly snapshots and year-end summaries.",
    navHrefs: ["/reports"],
    requiredPlan: "bookkeeper_starter",
    alwaysOn: false,
  },
};

export const ALL_MODULE_KEYS: readonly ModuleKey[] = [
  "collections",
  "cashflow",
  "expenses",
  "tax",
  "reports",
];

// ── Personas ────────────────────────────────────────────────────────────────

export interface Persona {
  id:          string;
  label:       string;
  description: string;
  modules:     Record<ModuleKey, boolean>;
}

const moduleSet = (...on: ModuleKey[]): Record<ModuleKey, boolean> => {
  const result = { collections: false, cashflow: false, expenses: false, tax: false, reports: false };
  on.forEach((m) => { result[m] = true; });
  return result;
};

export const PERSONAS: Persona[] = [
  {
    id: "chasing",
    label: "Just chasing",
    description: "Overdue invoices only. Best for freelancers and sole traders focused on getting paid.",
    modules: moduleSet("collections"),
  },
  {
    id: "tax",
    label: "Tax & expenses",
    description: "Tax reserve, MTD, and expense tracking — no chasing. Best for sole traders mainly tracking finances.",
    modules: moduleSet("expenses", "tax"),
  },
  {
    id: "cashflow",
    label: "Cash flow only",
    description: "Bank feed and safe-to-spend. Best for owners watching their runway.",
    modules: moduleSet("cashflow"),
  },
  {
    id: "solo",
    label: "Solo business",
    description: "Chasing plus cash flow and tax. Balanced setup for single-business owners.",
    modules: moduleSet("collections", "cashflow", "tax"),
  },
  {
    id: "bookkeeper",
    label: "Everything",
    description: "Every module enabled — collections, cash flow, expenses, tax, reports. Best for bookkeepers.",
    modules: moduleSet("collections", "cashflow", "expenses", "tax", "reports"),
  },
];

// ── Tier gating ──────────────────────────────────────────────────────────────

/**
 * Plan rank for tier comparisons. Higher = more capability.
 */
const PLAN_RANK: Record<PlanId, number> = {
  demo:                       0,
  trial:                      1,
  starter_solo:               1,
  founding_single_business:   2,
  single_business:            2,
  founding_bookkeeper:        3,
  bookkeeper_starter:         3,
  bookkeeper_pro:             4,
};

/**
 * Returns true if the given plan unlocks the module.
 * Demo plan unlocks everything for evaluation purposes.
 */
export function planUnlocksModule(planId: PlanId | undefined, key: ModuleKey): boolean {
  if (!planId) return false;
  if (planId === "demo") return true;
  const required = MODULES[key].requiredPlan;
  if (required === null) return true;
  return (PLAN_RANK[planId] ?? 0) >= (PLAN_RANK[required] ?? 0);
}

// ── Defaults by plan ─────────────────────────────────────────────────────────

/**
 * Recommended default module set for a fresh account, based on plan.
 */
export function defaultModulesForPlan(planId: PlanId | undefined): Record<ModuleKey, boolean> {
  if (!planId) return moduleSet("collections");
  if (planId.startsWith("bookkeeper") || planId === "founding_bookkeeper") {
    return PERSONAS[2].modules; // Bookkeeper
  }
  if (planId === "single_business" || planId === "founding_single_business") {
    return PERSONAS[1].modules; // Solo
  }
  return PERSONAS[1].modules;     // Solo as a safe middle default
}
