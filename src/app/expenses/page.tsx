/**
 * src/app/expenses/page.tsx
 *
 * Expense tracking page — UK self-employed allowable expenses.
 *
 * Features:
 *  - Add expense with category, amount, date, description
 *  - List of recent expenses grouped by month
 *  - Monthly total + category breakdown
 *  - Feeds into tax reserve calculation and MTD quarterly tracker
 */

import { ExpensePageClient }   from "@/components/expense-page-client";
import type { Metadata }       from "next";

export const metadata: Metadata = {
  title:       "Expenses",
  description: "Track your allowable business expenses to reduce your tax bill.",
};

export default function ExpensesPage() {
  return <ExpensePageClient />;
}
