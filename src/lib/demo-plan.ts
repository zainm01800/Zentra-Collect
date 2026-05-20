/**
 * src/lib/demo-plan.ts
 *
 * Tracks which plan tier the /demo visitor chose to preview, so the
 * demo sidebar / pages can show exactly the features that plan would
 * unlock. Pure client-side — never touches Supabase or the real plan
 * gating used for paying users.
 *
 * Persistence is localStorage so the choice survives reloads but
 * doesn't follow the user across browsers (intentional — every demo
 * visitor gets a clean slate).
 */

export type DemoPlanId =
  | "starter"     // £5  · books only, no chasing
  | "solo"        // £29 · collections + books + basic AI drafting
  | "business"    // £59 · adds auto-send, integrations, multi-user
  | "practice"    // £119 · bookkeeper multi-client
  | "all";        // showcase mode — every feature visible

export interface DemoPlanInfo {
  id:          DemoPlanId;
  label:       string;
  priceLabel:  string;
  tagline:     string;
  description: string;
  /** Best-fit user persona — shown under the title in the picker. */
  bestFor:     string;
  /** Sidebar hrefs this plan should show in the demo. "all" implicitly shows everything. */
  navHrefs:    string[];
  /** Bullet list of feature names — drives the picker's preview pane. */
  features:    string[];
}

const COLLECTIONS_HREFS = ["/demo", "/demo/chase-plan", "/demo/aged-debt", "/demo/customers", "/demo/quotes", "/demo/credit-notes", "/demo/reports"];
const BOOKS_HREFS       = ["/demo/banking", "/demo/expenses", "/demo/mileage", "/demo/pl", "/demo/tax"];

export const DEMO_PLANS: DemoPlanInfo[] = [
  {
    id: "starter",
    label: "Starter",
    priceLabel: "£5 / month",
    tagline: "Books only — no chasing",
    description: "For sole traders and freelancers who mostly need bookkeeping, not collections.",
    bestFor: "Driving instructors · tutors · tradespeople · anyone with bank-transfer income",
    navHrefs: ["/demo", "/demo/reports", ...BOOKS_HREFS],
    features: [
      "Bank feed (read-only)",
      "Tag bank credits as direct income",
      "Mileage tracking with HMRC rates",
      "Tax & VAT estimate",
      "Year-end SA103 box mapping",
    ],
  },
  {
    id: "solo",
    label: "Solo",
    priceLabel: "£29 / month",
    tagline: "Books + chasing + AI drafts",
    description: "For growing businesses with invoices to chase as well as books to keep.",
    bestFor: "Consultants · agencies · freelancers with invoice-based clients",
    navHrefs: [...COLLECTIONS_HREFS, ...BOOKS_HREFS],
    features: [
      "Everything in Starter",
      "Ranked chase plan",
      "Quotes and credit notes",
      "AI-drafted reminder messages",
      "Customer payment history",
    ],
  },
  {
    id: "business",
    label: "Business",
    priceLabel: "£59 / month",
    tagline: "Auto-send, integrations, reply tracking",
    description: "For small agencies and B2B services that want chasing to mostly run itself.",
    bestFor: "Small agencies · B2B service businesses · anyone with 20+ active invoices",
    navHrefs: [...COLLECTIONS_HREFS, ...BOOKS_HREFS],
    features: [
      "Everything in Solo",
      "Auto-send (with review window)",
      "Xero + QuickBooks sync",
      "Reply classification",
      "Email open / click tracking",
    ],
  },
  {
    id: "practice",
    label: "Practice",
    priceLabel: "£119 / month",
    tagline: "Multi-client portfolio for bookkeepers",
    description: "For bookkeepers managing collections across multiple client ledgers.",
    bestFor: "Bookkeepers · accounting practices · anyone with 5+ small business clients",
    navHrefs: [...COLLECTIONS_HREFS, ...BOOKS_HREFS, "/demo/portfolio"],
    features: [
      "Everything in Business",
      "Portfolio overview across all clients",
      "Per-client risk and oldest-invoice triage",
      "Sort and bulk actions across clients",
      "White-label client reports",
    ],
  },
  {
    id: "all",
    label: "Show everything",
    priceLabel: "Showcase mode",
    tagline: "All features unlocked",
    description: "See every page across every tier in one demo. Best for an evaluation walkthrough.",
    bestFor: "Anyone evaluating the product end-to-end",
    navHrefs: [...COLLECTIONS_HREFS, ...BOOKS_HREFS, "/demo/portfolio"],
    features: [
      "Every nav item visible",
      "Every interactive demo enabled",
      "Use this to compare what each tier offers",
    ],
  },
];

const STORAGE_KEY = "zentra.demoPlan.v1";

export function readDemoPlan(): DemoPlanId | null {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (!v) return null;
    return DEMO_PLANS.some((p) => p.id === v) ? (v as DemoPlanId) : null;
  } catch {
    return null;
  }
}

export function writeDemoPlan(plan: DemoPlanId): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, plan);
    window.dispatchEvent(new CustomEvent("zentra:demo-plan-change", { detail: plan }));
  } catch { /* quota / SSR */ }
}

export function clearDemoPlan(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new CustomEvent("zentra:demo-plan-change", { detail: null }));
  } catch { /* */ }
}

export function getPlanInfo(id: DemoPlanId): DemoPlanInfo {
  return DEMO_PLANS.find((p) => p.id === id) ?? DEMO_PLANS[DEMO_PLANS.length - 1];
}

/** Whether the given nav href is visible for the selected plan. */
export function planShowsHref(planId: DemoPlanId | null, href: string): boolean {
  if (!planId || planId === "all") return true;
  const info = getPlanInfo(planId);
  return info.navHrefs.includes(href);
}
