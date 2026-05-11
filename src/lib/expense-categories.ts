/**
 * src/lib/expense-categories.ts
 *
 * Shared expense category list — used by both the server action
 * and client components.  Kept in a plain (non-server-action) file
 * so it can be imported safely on both sides of the boundary.
 */

export const EXPENSE_CATEGORIES = [
  "Office & stationery",
  "Travel & mileage",
  "Professional fees",
  "Equipment & software",
  "Phone & internet",
  "Marketing & advertising",
  "Training & development",
  "Bank charges",
  "Premises & utilities",
  "Other",
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];
