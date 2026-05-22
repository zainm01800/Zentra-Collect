/**
 * src/lib/expense-categories.ts
 *
 * UK HMRC-aligned expense categories, organised into groups.
 * Each group has a display label and a brand colour used throughout the UI.
 *
 * CATEGORY_GROUPS    — grouped structure for the picker UI and detail panel
 * EXPENSE_CATEGORIES — flat array (backward-compatible, used for type checks)
 * getCategoryColor   — returns the group colour for any category string
 * getCategoryGroup   — returns the group label for any category string
 */

// ── Group definitions ─────────────────────────────────────────────────────────

export interface CategoryGroup {
  label:      string;
  color:      string;   // used for pills, dots, and chart segments
  categories: readonly string[];
  hmrcNote:   string;   // shown in the group header tooltip
}

export const CATEGORY_GROUPS: CategoryGroup[] = [
  {
    label:    "Staff & People",
    color:    "#8b5cf6",
    hmrcNote: "Employee costs are fully allowable where wholly and exclusively for trade (s34 ITTOIA 2005).",
    categories: [
      "Salaries & wages",
      "Subcontractors & freelancers",
      "Employer NI contributions",
      "Pension contributions",
      "Staff expenses & allowances",
      "Recruitment costs",
    ],
  },
  {
    label:    "Travel & Transport",
    color:    "#3b82f6",
    hmrcNote: "Business travel is fully allowable. Use HMRC approved mileage rates for your own vehicle. Commuting is not allowable.",
    categories: [
      "Business mileage",
      "Public transport",
      "Taxis & ride-hailing",
      "Flights",
      "Hotels & accommodation",
      "Parking & congestion charge",
      "Vehicle hire & lease",
      "Vehicle insurance (business use)",
    ],
  },
  {
    label:    "Office & Admin",
    color:    "#c88a1e",
    hmrcNote: "Office costs used wholly for business are fully allowable. Stationery, postage, and printing qualify.",
    categories: [
      "Stationery & supplies",
      "Postage & couriers",
      "Printing & copying",
      "Office equipment (small items)",
      "Trade subscriptions & publications",
      "Office sundries",
    ],
  },
  {
    label:    "Premises & Utilities",
    color:    "#f97316",
    hmrcNote: "Business premises costs are fully allowable. For home office, HMRC's simplified flat rate or a proportion of household bills may apply.",
    categories: [
      "Business rent",
      "Business rates",
      "Gas, electric & water",
      "Repairs & maintenance",
      "Building insurance",
      "Cleaning & janitorial",
      "Security",
      "Home office (flat rate)",
      "Home office (proportion of bills)",
    ],
  },
  {
    label:    "Equipment & Technology",
    color:    "#06b6d4",
    hmrcNote: "Equipment and technology used wholly for business qualifies for capital allowances or Annual Investment Allowance (AIA).",
    categories: [
      "Computer & hardware",
      "Software & subscriptions",
      "Cloud services & hosting",
      "Mobile phone (business)",
      "Internet & broadband",
      "Specialist tools & equipment",
      "Machinery",
      "IT support & maintenance",
    ],
  },
  {
    label:    "Professional Services",
    color:    "#10b981",
    hmrcNote: "Accountancy, legal, and professional fees incurred for trade purposes are fully allowable.",
    categories: [
      "Accountancy & bookkeeping",
      "Legal fees",
      "Professional indemnity insurance",
      "Public liability insurance",
      "Business insurance (other)",
      "Consultancy fees",
      "Debt collection costs",
    ],
  },
  {
    label:    "Marketing & Sales",
    color:    "#f43f5e",
    hmrcNote: "Marketing costs are fully allowable. Client entertainment is 50% allowable. Gifts are allowable up to £50 per person per year.",
    categories: [
      "Advertising & digital marketing",
      "Website design & development",
      "PR & media",
      "Social media & content creation",
      "Client entertainment (50% rule)",
      "Staff entertainment",
      "Samples & promotional materials",
      "Trade shows & exhibitions",
    ],
  },
  {
    label:    "Finance & Banking",
    color:    "#84cc16",
    hmrcNote: "Business bank charges and interest on business loans are fully allowable. Personal loan interest is not.",
    categories: [
      "Bank charges & fees",
      "Payment processing fees",
      "Business loan interest",
      "Hire purchase interest",
      "Overdraft charges",
      "Currency exchange losses",
      "Merchant account fees",
    ],
  },
  {
    label:    "Training & Memberships",
    color:    "#ec4899",
    hmrcNote: "Training to improve skills for your current trade is allowable. Training for a new career is not. Professional subscriptions on HMRC's approved list qualify.",
    categories: [
      "Training courses & workshops",
      "Conferences & seminars",
      "Books & trade publications",
      "Professional body subscriptions",
      "Industry memberships",
      "Online learning & certifications",
    ],
  },
  {
    label:    "Health & Safety",
    color:    "#14b8a6",
    hmrcNote: "Protective clothing and PPE required for your trade are fully allowable. General clothing is not.",
    categories: [
      "Protective clothing & PPE",
      "Eye tests (VDU workers)",
      "First aid & safety equipment",
      "Health & safety training",
    ],
  },
  {
    label:    "Other",
    color:    "#6b7280",
    hmrcNote: "Review these expenses carefully to confirm they qualify as wholly and exclusively for your trade under s34 ITTOIA 2005.",
    categories: [
      "Charitable donations (Gift Aid)",
      "Licences & permits",
      "Research & development",
      "Bad debts written off",
      "Other allowable",
      "Needs review",
    ],
  },
];

// ── Flat list (backward-compatible — allows legacy stored values) ──────────────

export const EXPENSE_CATEGORIES: readonly string[] = CATEGORY_GROUPS.flatMap(
  (g) => g.categories,
);

export type ExpenseCategory = string; // open string — allows legacy stored values

// ── Lookup helpers ─────────────────────────────────────────────────────────────

/** Returns the hex colour for a category string. Falls back to grey. */
export function getCategoryColor(category: string): string {
  for (const g of CATEGORY_GROUPS) {
    if ((g.categories as readonly string[]).includes(category)) return g.color;
  }
  return "#6b7280";
}

/** Returns the group label for a category string. Falls back to "Other". */
export function getCategoryGroup(category: string): string {
  for (const g of CATEGORY_GROUPS) {
    if ((g.categories as readonly string[]).includes(category)) return g.label;
  }
  return "Other";
}

/** Returns the full CategoryGroup object for a category string. */
export function getCategoryGroupObj(category: string): CategoryGroup | undefined {
  return CATEGORY_GROUPS.find((g) =>
    (g.categories as readonly string[]).includes(category),
  );
}

// ── Legacy aliases ────────────────────────────────────────────────────────────
// Old stored values still display correctly (getCategoryColor falls back to grey).
// This map is used to suggest a migration when the user next edits an entry.
export const LEGACY_CATEGORY_MAP: Record<string, string> = {
  "Office & stationery":     "Stationery & supplies",
  "Travel & mileage":        "Business mileage",
  "Professional fees":       "Accountancy & bookkeeping",
  "Equipment & software":    "Computer & hardware",
  "Phone & internet":        "Mobile phone (business)",
  "Marketing & advertising": "Advertising & digital marketing",
  "Training & development":  "Training courses & workshops",
  "Bank charges":            "Bank charges & fees",
  "Premises & utilities":    "Business rent",
  "Other":                   "Other allowable",
};
