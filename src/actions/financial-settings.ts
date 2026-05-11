"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient, hasSupabaseServerConfig } from "@/lib/supabase/server";

// ── Exported type ──────────────────────────────────────────────────────────────

/**
 * Mirrors the zentra_financial_settings DB row (columns mapped to camelCase).
 * numeric(12,2) / numeric(5,2) come back as JS numbers via PostgREST JSON.
 */
export interface FinancialSettings {
  id: string;
  accountId: string;
  bankBalance: number;
  bankBalanceUpdatedAt: string | null;
  taxRatePercent: number;
  countryCode: string;
  freelancerType: string | null;
  currencyCode: string;
  createdAt: string;
  updatedAt: string;
}

// ── Private helpers ────────────────────────────────────────────────────────────

/** Map a snake_case DB row to a camelCase FinancialSettings object. */
function toFinancialSettings(row: Record<string, unknown>): FinancialSettings {
  return {
    id:                   row.id as string,
    accountId:            row.account_id as string,
    bankBalance:          (row.bank_balance as number) ?? 0,
    bankBalanceUpdatedAt: (row.bank_balance_updated_at as string) ?? null,
    taxRatePercent:       (row.tax_rate_percent as number) ?? 20,
    countryCode:          (row.country_code as string) ?? "GB",
    freelancerType:       (row.freelancer_type as string) ?? null,
    currencyCode:         (row.currency_code as string) ?? "GBP",
    createdAt:            row.created_at as string,
    updatedAt:            row.updated_at as string,
  };
}

/**
 * Resolve the account_id for the current authenticated user via the
 * zentra_account_members join table.
 *
 * Matches the pattern used in src/actions/import.ts. Throws when no
 * account row is found so callers can bubble the error up.
 */
async function requireAccountId(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
): Promise<string> {
  const { data: member } = await supabase
    .from("zentra_account_members")
    .select("account_id")
    .eq("user_id", userId)
    .single();

  if (!member) throw new Error("No account found for user");
  return member.account_id;
}

/**
 * Return UTC-aligned YYYY-MM-DD boundaries for the current and previous
 * calendar months, safe to use as PostgREST filter values.
 *
 * Using UTC avoids local-timezone skew when constructing month boundaries
 * on the server (which may run in a different TZ to the user).
 */
function monthBoundaries(): {
  thisMonthStart: string;
  nextMonthStart: string;
  lastMonthStart: string;
} {
  const now    = new Date();
  const y      = now.getUTCFullYear();
  const m      = now.getUTCMonth(); // 0-indexed

  // Construct boundaries as YYYY-MM-DD strings (PostgREST casts to timestamptz/date).
  const pad  = (n: number) => String(n).padStart(2, "0");
  const fmt  = (yr: number, mo: number) => `${yr}-${pad(mo + 1)}-01`;

  return {
    thisMonthStart: fmt(y, m),
    nextMonthStart: m === 11 ? fmt(y + 1, 0) : fmt(y, m + 1),
    lastMonthStart: m === 0  ? fmt(y - 1, 11) : fmt(y, m - 1),
  };
}

/** Sum the `amount` field of any PostgREST result rows, treating nulls as 0. */
function sumAmounts(rows: { amount: number }[] | null): number {
  return (rows ?? []).reduce((acc, row) => acc + (row.amount ?? 0), 0);
}

// ── Actions ────────────────────────────────────────────────────────────────────

/**
 * Read the financial settings row for the current user's account.
 *
 * Returns null when:
 *  - Supabase is not configured (local/demo mode)
 *  - The user is not authenticated
 *  - The user has not yet created a settings row (first-time setup)
 *
 * RLS on zentra_financial_settings restricts the select to the user's own
 * account, so no explicit account_id filter is needed here.
 */
export async function getFinancialSettings(): Promise<FinancialSettings | null> {
  if (!hasSupabaseServerConfig()) return null;

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("zentra_financial_settings")
    .select("*")
    .maybeSingle(); // null when no row exists, no error thrown

  if (error) {
    console.error("getFinancialSettings:", error.message);
    return null;
  }

  return data ? toFinancialSettings(data) : null;
}

/**
 * Create or update the financial settings for the current user's account.
 *
 * Only the keys present in `data` are written; omitted keys are not
 * overwritten. Uses ON CONFLICT (account_id) DO UPDATE so it behaves as
 * an upsert regardless of whether a row already exists.
 *
 * Revalidates /dashboard after a successful save.
 */
export async function upsertFinancialSettings(
  data: Partial<FinancialSettings>,
): Promise<void> {
  if (!hasSupabaseServerConfig()) return;

  const supabase = await createSupabaseServerClient();

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    const accountId = await requireAccountId(supabase, user.id);

    // Build the upsert row from only the explicitly provided fields to avoid
    // accidentally nullifying columns the caller didn't intend to touch.
    const row: Record<string, unknown> = { account_id: accountId };
    if (data.bankBalance          !== undefined) row.bank_balance           = data.bankBalance;
    if (data.bankBalanceUpdatedAt !== undefined) row.bank_balance_updated_at = data.bankBalanceUpdatedAt;
    if (data.taxRatePercent       !== undefined) row.tax_rate_percent        = data.taxRatePercent;
    if (data.countryCode          !== undefined) row.country_code            = data.countryCode;
    if (data.freelancerType       !== undefined) row.freelancer_type         = data.freelancerType;
    if (data.currencyCode         !== undefined) row.currency_code           = data.currencyCode;

    const { error } = await supabase
      .from("zentra_financial_settings")
      .upsert(row, { onConflict: "account_id" });

    if (error) throw new Error(error.message);

    revalidatePath("/dashboard");
  } catch (err) {
    console.error("upsertFinancialSettings:", err);
    throw err;
  }
}

/**
 * Update only the bank balance and its timestamp.
 *
 * Kept as a separate, lightweight action because it is called frequently
 * (e.g. every time the user refreshes their balance from Open Banking or
 * enters a manual figure). Only two columns are written.
 *
 * Revalidates /dashboard after a successful save.
 */
export async function updateBankBalance(balance: number): Promise<void> {
  if (!hasSupabaseServerConfig()) return;

  const supabase = await createSupabaseServerClient();

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    const accountId = await requireAccountId(supabase, user.id);

    const { error } = await supabase
      .from("zentra_financial_settings")
      .upsert(
        {
          account_id:              accountId,
          bank_balance:            balance,
          bank_balance_updated_at: new Date().toISOString(),
        },
        { onConflict: "account_id" },
      );

    if (error) throw new Error(error.message);

    revalidatePath("/dashboard");
  } catch (err) {
    console.error("updateBankBalance:", err);
    throw err;
  }
}

/**
 * Insert a manual income entry for the current user's account.
 *
 * `receivedDate` must be a YYYY-MM-DD string (the DB column is type `date`).
 *
 * Revalidates /dashboard after a successful insert.
 */
export async function addManualIncome(data: {
  amount: number;
  description: string;
  receivedDate: string;
  source?: string;
}): Promise<void> {
  if (!hasSupabaseServerConfig()) return;

  const supabase = await createSupabaseServerClient();

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    const accountId = await requireAccountId(supabase, user.id);

    const { error } = await supabase
      .from("zentra_manual_income")
      .insert({
        account_id:    accountId,
        amount:        data.amount,
        description:   data.description,
        received_date: data.receivedDate,
        source:        data.source ?? null,
      });

    if (error) throw new Error(error.message);

    revalidatePath("/dashboard");
  } catch (err) {
    console.error("addManualIncome:", err);
    throw err;
  }
}

/**
 * Insert a manual bill for the current user's account.
 *
 * `dueDate` must be a YYYY-MM-DD string (the DB column is type `date`).
 * `isRecurring` defaults to false; `recurrenceInterval` (e.g. "monthly")
 * can be added via upsert if the schema is extended.
 *
 * Revalidates /dashboard after a successful insert.
 */
export async function addManualBill(data: {
  description: string;
  amount: number;
  dueDate: string;
  isRecurring?: boolean;
}): Promise<void> {
  if (!hasSupabaseServerConfig()) return;

  const supabase = await createSupabaseServerClient();

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    const accountId = await requireAccountId(supabase, user.id);

    const { error } = await supabase
      .from("zentra_manual_bills")
      .insert({
        account_id:   accountId,
        description:  data.description,
        amount:       data.amount,
        due_date:     data.dueDate,
        is_recurring: data.isRecurring ?? false,
      });

    if (error) throw new Error(error.message);

    revalidatePath("/dashboard");
  } catch (err) {
    console.error("addManualBill:", err);
    throw err;
  }
}

/**
 * Aggregate income for the current and previous calendar month.
 *
 * Invoice income is counted when `status = 'paid'` and `updated_at` falls
 * within the month window (the closest proxy for payment date without a
 * dedicated `paid_at` column). Manual income uses `received_date`.
 *
 * All four queries run in parallel via Promise.all to minimise latency.
 *
 * Returns zeroed totals (rather than throwing) when Supabase is unconfigured
 * or the user is unauthenticated, so the UI degrades gracefully.
 */
export async function getMonthlyIncomeSummary(): Promise<{
  totalThisMonth: number;
  totalLastMonth: number;
  invoiceIncome: number;
  manualIncome: number;
}> {
  const empty = {
    totalThisMonth: 0,
    totalLastMonth: 0,
    invoiceIncome:  0,
    manualIncome:   0,
  };

  if (!hasSupabaseServerConfig()) return empty;

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return empty;

  let accountId: string;
  try {
    accountId = await requireAccountId(supabase, user.id);
  } catch {
    // User authenticated but has no account yet — treat as empty.
    return empty;
  }

  const { thisMonthStart, nextMonthStart, lastMonthStart } = monthBoundaries();

  // Run all four queries concurrently.
  const [
    invThisMonth,
    invLastMonth,
    manualThisMonth,
    manualLastMonth,
  ] = await Promise.all([
    // Paid invoices this month (updated_at proxy for paid_at)
    supabase
      .from("zentra_invoices")
      .select("amount")
      .eq("account_id", accountId)
      .eq("status", "paid")
      .gte("updated_at", thisMonthStart)
      .lt("updated_at", nextMonthStart),

    // Paid invoices last month
    supabase
      .from("zentra_invoices")
      .select("amount")
      .eq("account_id", accountId)
      .eq("status", "paid")
      .gte("updated_at", lastMonthStart)
      .lt("updated_at", thisMonthStart),

    // Manual income this month (received_date is a date column)
    supabase
      .from("zentra_manual_income")
      .select("amount")
      .eq("account_id", accountId)
      .gte("received_date", thisMonthStart)
      .lt("received_date", nextMonthStart),

    // Manual income last month
    supabase
      .from("zentra_manual_income")
      .select("amount")
      .eq("account_id", accountId)
      .gte("received_date", lastMonthStart)
      .lt("received_date", thisMonthStart),
  ]);

  const invoiceIncomeThisMonth = sumAmounts(invThisMonth.data);
  const invoiceIncomeLastMonth = sumAmounts(invLastMonth.data);
  const manualIncomeThisMonth  = sumAmounts(manualThisMonth.data);
  const manualIncomeLastMonth  = sumAmounts(manualLastMonth.data);

  return {
    totalThisMonth: invoiceIncomeThisMonth + manualIncomeThisMonth,
    totalLastMonth: invoiceIncomeLastMonth + manualIncomeLastMonth,
    invoiceIncome:  invoiceIncomeThisMonth,
    manualIncome:   manualIncomeThisMonth,
  };
}

// ── Monthly income series ─────────────────────────────────────────────────────

/** One entry per calendar month in the requested window, oldest first. */
export interface MonthlyIncomeSeries {
  /** ISO year-month string, e.g. "2026-01". */
  yearMonth: string;
  /** Short month name for display, e.g. "Jan". */
  label: string;
  /** Combined invoice + manual income received in this month. */
  income: number;
}

/** Build an empty series (all zeroes) for the last N months — used as a
 *  safe fallback when Supabase is unavailable or the user is not authed. */
function buildEmptySeries(monthsBack: number): MonthlyIncomeSeries[] {
  const now = new Date();
  return Array.from({ length: monthsBack }, (_, i) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (monthsBack - 1 - i), 1));
    return {
      yearMonth: d.toISOString().slice(0, 7),
      label:     new Intl.DateTimeFormat("en-GB", { month: "short" }).format(d),
      income:    0,
    };
  });
}

/**
 * Return combined (invoice + manual) income totals for each of the last
 * `monthsBack` calendar months, ordered oldest → newest.
 *
 * Uses two queries instead of N×2: fetch all rows in the window then
 * aggregate by YYYY-MM in JS, keeping round-trips to two regardless of
 * how many months are requested.
 *
 * Invoice income uses `updated_at` as a proxy for payment date (matching
 * the behaviour of getMonthlyIncomeSummary).  Manual income uses
 * `received_date`, which is an explicit date column.
 */
export async function getMonthlyIncomeSeries(
  monthsBack: number = 12,
): Promise<MonthlyIncomeSeries[]> {
  if (!hasSupabaseServerConfig()) return buildEmptySeries(monthsBack);

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return buildEmptySeries(monthsBack);

  let accountId: string;
  try {
    accountId = await requireAccountId(supabase, user.id);
  } catch {
    return buildEmptySeries(monthsBack);
  }

  // First day of the oldest month in the window.
  const now         = new Date();
  const windowStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - monthsBack + 1, 1));
  const windowStartStr = windowStart.toISOString().slice(0, 10);

  // Two queries in parallel: paid invoices + manual income in the window.
  const [invRes, manualRes] = await Promise.all([
    supabase
      .from("zentra_invoices")
      .select("amount, updated_at")
      .eq("account_id", accountId)
      .eq("status", "paid")
      .gte("updated_at", windowStartStr),
    supabase
      .from("zentra_manual_income")
      .select("amount, received_date")
      .eq("account_id", accountId)
      .gte("received_date", windowStartStr),
  ]);

  // Aggregate by YYYY-MM.
  const monthMap: Record<string, number> = {};
  for (const row of invRes.data ?? []) {
    const ym = (row.updated_at as string).slice(0, 7);
    monthMap[ym] = (monthMap[ym] ?? 0) + ((row.amount as number) ?? 0);
  }
  for (const row of manualRes.data ?? []) {
    const ym = (row.received_date as string).slice(0, 7);
    monthMap[ym] = (monthMap[ym] ?? 0) + ((row.amount as number) ?? 0);
  }

  // Build the result array from oldest to newest, filling missing months with 0.
  return Array.from({ length: monthsBack }, (_, i) => {
    const d  = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (monthsBack - 1 - i), 1));
    const ym = d.toISOString().slice(0, 7);
    return {
      yearMonth: ym,
      label:     new Intl.DateTimeFormat("en-GB", { month: "short" }).format(d),
      income:    monthMap[ym] ?? 0,
    };
  });
}
