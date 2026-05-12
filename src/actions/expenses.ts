"use server";

/**
 * src/actions/expenses.ts
 *
 * Expense CRUD and aggregation for Zentra Flow.
 *
 * When Supabase is configured, persists to `zentra_expenses` table.
 * Otherwise operates fully in-memory / returns empty — the client-side
 * localStorage layer (in ExpensePageClient) handles demo/offline mode.
 *
 * Categories are standard UK HMRC allowable expense headings.
 */

import { createSupabaseServerClient as createServerClient } from "@/lib/supabase/server";
// Note: EXPENSE_CATEGORIES lives in @/lib/expense-categories — import it from there
// in client components. Do NOT re-export it here: "use server" only allows async functions.

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ExpenseEntry {
  id:          string;
  date:        string;   // YYYY-MM-DD
  amount:      number;
  category:    string;
  description: string;
  createdAt?:  string;
}

export interface MonthlyExpenseSeries {
  yearMonth: string;  // "2025-04"
  label:     string;  // "Apr 2025"
  expenses:  number;
}

export type AddExpenseInput = Omit<ExpenseEntry, "id" | "createdAt">;

// ── Helpers ───────────────────────────────────────────────────────────────────

function isConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

/**
 * Generate the last `n` year-month strings in ascending order.
 * e.g. n=3 today=2025-05 → ["2025-03", "2025-04", "2025-05"]
 */
function lastNMonths(n: number): { yearMonth: string; label: string }[] {
  const result: { yearMonth: string; label: string }[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
    result.push({ yearMonth: ym, label });
  }
  return result;
}

// ── Actions ───────────────────────────────────────────────────────────────────

export async function addExpense(
  input: AddExpenseInput,
): Promise<{ ok: boolean; id?: string; error?: string }> {
  if (!isConfigured()) {
    // Client will handle via localStorage
    return { ok: true, id: crypto.randomUUID() };
  }

  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Not authenticated" };

    const { data: account } = await supabase
      .from("zentra_accounts")
      .select("id")
      .eq("owner_id", user.id)
      .maybeSingle();

    if (!account) return { ok: false, error: "No account found" };

    const { data, error } = await supabase
      .from("zentra_expenses")
      .insert({
        account_id:  account.id,
        date:        input.date,
        amount:      input.amount,
        category:    input.category,
        description: input.description,
      })
      .select("id")
      .single();

    if (error) return { ok: false, error: error.message };
    return { ok: true, id: data.id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return { ok: false, error: msg };
  }
}

export async function deleteExpense(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!isConfigured()) return { ok: true };

  try {
    const supabase = await createServerClient();
    const { error } = await supabase
      .from("zentra_expenses")
      .delete()
      .eq("id", id);

    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return { ok: false, error: msg };
  }
}

export async function getExpenses(months = 12): Promise<ExpenseEntry[]> {
  if (!isConfigured()) return [];

  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data: account } = await supabase
      .from("zentra_accounts")
      .select("id")
      .eq("owner_id", user.id)
      .maybeSingle();

    if (!account) return [];

    const fromDate = new Date();
    fromDate.setMonth(fromDate.getMonth() - months);
    const fromStr = fromDate.toISOString().slice(0, 10);

    const { data, error } = await supabase
      .from("zentra_expenses")
      .select("id, date, amount, category, description, created_at")
      .eq("account_id", account.id)
      .gte("date", fromStr)
      .order("date", { ascending: false });

    if (error || !data) return [];

    return data.map((r) => ({
      id:          r.id,
      date:        r.date,
      amount:      r.amount,
      category:    r.category,
      description: r.description ?? "",
      createdAt:   r.created_at,
    }));
  } catch {
    return [];
  }
}

/**
 * Returns monthly expense totals for the last `months` months.
 * Used by the tax reserve and MTD pages for calculations.
 */
export async function getMonthlyExpenseSeries(
  months = 12,
): Promise<MonthlyExpenseSeries[]> {
  const skeleton = lastNMonths(months);

  if (!isConfigured()) {
    return skeleton.map((s) => ({ ...s, expenses: 0 }));
  }

  try {
    const entries = await getExpenses(months);
    const byMonth: Record<string, number> = {};

    for (const e of entries) {
      const ym = e.date.slice(0, 7);
      byMonth[ym] = (byMonth[ym] ?? 0) + e.amount;
    }

    return skeleton.map((s) => ({
      ...s,
      expenses: byMonth[s.yearMonth] ?? 0,
    }));
  } catch {
    return skeleton.map((s) => ({ ...s, expenses: 0 }));
  }
}
