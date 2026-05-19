"use server";

/**
 * Server-side persistence for direct-income tags (bank-feed credits the
 * user manually marks as income with no matching invoice).
 *
 * The (account_id, transaction_id) unique constraint makes the "tag"
 * action idempotent — calling tagAsIncome on an already-tagged txn is
 * a no-op rather than a duplicate row.
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type IncomeCategory =
  | "services" | "products" | "rental" | "interest" | "other";

export interface TaggedIncomeRecord {
  transactionId: string;
  amount:        number;
  date:          string;
  description:   string;
  category:      IncomeCategory;
  taggedAt:      string;
}

export interface TagIncomeInput {
  transactionId: string;
  amount:        number;
  date:          string;
  description:   string;
  category:      IncomeCategory;
}

function isConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

async function resolveAccountId(): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: member } = await supabase
    .from("zentra_account_members")
    .select("account_id")
    .eq("user_id", user.id)
    .maybeSingle();
  return (member?.account_id as string | undefined) ?? null;
}

export async function tagAsIncome(input: TagIncomeInput): Promise<{ ok: boolean; record?: TaggedIncomeRecord; error?: string }> {
  if (!isConfigured()) return { ok: true };
  try {
    const supabase = await createSupabaseServerClient();
    const accountId = await resolveAccountId();
    if (!accountId) return { ok: false, error: "Not authenticated" };

    // Upsert on (account_id, transaction_id) — idempotent tag.
    const { data, error } = await supabase
      .from("zentra_direct_income")
      .upsert(
        {
          account_id:     accountId,
          transaction_id: input.transactionId,
          amount:         input.amount,
          income_date:    input.date,
          description:    input.description,
          category:       input.category,
        },
        { onConflict: "account_id,transaction_id" },
      )
      .select("*")
      .single();

    if (error || !data) return { ok: false, error: error?.message ?? "insert failed" };
    return {
      ok: true,
      record: {
        transactionId: data.transaction_id,
        amount:        Number(data.amount),
        date:          data.income_date,
        description:   data.description ?? "",
        category:      data.category,
        taggedAt:      data.tagged_at,
      },
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "unknown" };
  }
}

export async function untagIncome(transactionId: string): Promise<{ ok: boolean; error?: string }> {
  if (!isConfigured()) return { ok: true };
  try {
    const supabase = await createSupabaseServerClient();
    const accountId = await resolveAccountId();
    if (!accountId) return { ok: false, error: "Not authenticated" };

    const { error } = await supabase
      .from("zentra_direct_income")
      .delete()
      .eq("account_id", accountId)
      .eq("transaction_id", transactionId);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "unknown" };
  }
}

export async function getTaggedIncome(): Promise<TaggedIncomeRecord[]> {
  if (!isConfigured()) return [];
  try {
    const supabase = await createSupabaseServerClient();
    const accountId = await resolveAccountId();
    if (!accountId) return [];

    const { data, error } = await supabase
      .from("zentra_direct_income")
      .select("*")
      .eq("account_id", accountId)
      .order("income_date", { ascending: false });

    if (error || !data) return [];
    return data.map((r) => ({
      transactionId: r.transaction_id,
      amount:        Number(r.amount),
      date:          r.income_date,
      description:   r.description ?? "",
      category:      r.category,
      taggedAt:      r.tagged_at,
    }));
  } catch {
    return [];
  }
}

export async function bulkImportDirectIncome(items: TagIncomeInput[]): Promise<{ ok: boolean; inserted: number; error?: string }> {
  if (!isConfigured() || !items.length) return { ok: true, inserted: 0 };
  try {
    const supabase = await createSupabaseServerClient();
    const accountId = await resolveAccountId();
    if (!accountId) return { ok: false, inserted: 0, error: "Not authenticated" };

    const rows = items.map((i) => ({
      account_id:     accountId,
      transaction_id: i.transactionId,
      amount:         i.amount,
      income_date:    i.date,
      description:    i.description,
      category:       i.category,
    }));
    const { data, error } = await supabase
      .from("zentra_direct_income")
      .upsert(rows, { onConflict: "account_id,transaction_id", ignoreDuplicates: true })
      .select("id");
    if (error) return { ok: false, inserted: 0, error: error.message };
    return { ok: true, inserted: data?.length ?? 0 };
  } catch (err) {
    return { ok: false, inserted: 0, error: err instanceof Error ? err.message : "unknown" };
  }
}
