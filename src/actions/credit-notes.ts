"use server";

/**
 * Server-side CRUD for credit notes.
 *
 * Persists to zentra_credit_notes when Supabase is configured. Numbering
 * (CN-NNN) is allocated server-side from a per-account max-num query so
 * concurrent issuers don't collide.
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface CreditNoteRecord {
  id:                string;
  creditNoteNumber:  string;
  invoiceId?:        string;
  invoiceNumber?:    string;
  customerName:      string;
  issueDate:         string;
  reason:            string;
  amountNet:         number;
  vatRate:           number;
  vatAmount:         number;
  amountGross:       number;
  createdAt:         string;
}

export interface AddCreditNoteInput {
  customerName:   string;
  invoiceId?:     string;
  invoiceNumber?: string;
  issueDate:      string;
  reason:         string;
  amountNet:      number;
  vatRate:        number;
  /** Local client id (e.g. cn-XXXX) — enables idempotent re-sync. */
  clientUuid?:    string;
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

async function nextCreditNoteNumber(accountId: string): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("zentra_credit_notes")
    .select("credit_note_number")
    .eq("account_id", accountId);
  const nums = (data ?? [])
    .map((r) => r.credit_note_number?.match(/CN-(\d+)/))
    .map((m) => (m ? parseInt(m[1], 10) : 0));
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `CN-${String(next).padStart(3, "0")}`;
}

export async function addCreditNote(input: AddCreditNoteInput): Promise<{ ok: boolean; creditNote?: CreditNoteRecord; error?: string }> {
  if (!isConfigured()) return { ok: true };
  try {
    const supabase = await createSupabaseServerClient();
    const accountId = await resolveAccountId();
    if (!accountId) return { ok: false, error: "Not authenticated" };

    const net   = Math.max(0, input.amountNet);
    const vat   = Math.round(net * (input.vatRate / 100) * 100) / 100;
    const gross = Math.round((net + vat) * 100) / 100;
    const number = await nextCreditNoteNumber(accountId);

    const row = {
      account_id:         accountId,
      credit_note_number: number,
      invoice_id:         input.invoiceId ?? null,
      invoice_number:     input.invoiceNumber ?? null,
      customer_name:      input.customerName.trim(),
      issue_date:         input.issueDate,
      reason:             input.reason.trim(),
      amount_net:         net,
      vat_rate:           input.vatRate,
      vat_amount:         vat,
      amount_gross:       gross,
      client_uuid:        input.clientUuid ?? null,
    };
    const query = input.clientUuid
      ? supabase.from("zentra_credit_notes").upsert(row, { onConflict: "account_id,client_uuid" })
      : supabase.from("zentra_credit_notes").insert(row);
    const { data, error } = await query.select("*").single();

    if (error || !data) return { ok: false, error: error?.message ?? "insert failed" };
    return {
      ok: true,
      creditNote: {
        id:               data.id,
        creditNoteNumber: data.credit_note_number,
        invoiceId:        data.invoice_id ?? undefined,
        invoiceNumber:    data.invoice_number ?? undefined,
        customerName:     data.customer_name,
        issueDate:        data.issue_date,
        reason:           data.reason,
        amountNet:        Number(data.amount_net),
        vatRate:          Number(data.vat_rate),
        vatAmount:        Number(data.vat_amount),
        amountGross:      Number(data.amount_gross),
        createdAt:        data.created_at,
      },
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "unknown" };
  }
}

export async function deleteCreditNote(id: string): Promise<{ ok: boolean; error?: string }> {
  if (!isConfigured()) return { ok: true };
  try {
    const accountId = await resolveAccountId();
    if (!accountId) return { ok: false, error: "Not authenticated" };
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase
      .from("zentra_credit_notes")
      .delete()
      .eq("id", id)
      .eq("account_id", accountId); // ownership check
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "unknown" };
  }
}

export async function getCreditNotes(): Promise<CreditNoteRecord[]> {
  if (!isConfigured()) return [];
  try {
    const supabase = await createSupabaseServerClient();
    const accountId = await resolveAccountId();
    if (!accountId) return [];

    const { data, error } = await supabase
      .from("zentra_credit_notes")
      .select("*")
      .eq("account_id", accountId)
      .order("issue_date", { ascending: false });

    if (error || !data) return [];
    return data.map((r) => ({
      id:               r.id,
      creditNoteNumber: r.credit_note_number,
      invoiceId:        r.invoice_id ?? undefined,
      invoiceNumber:    r.invoice_number ?? undefined,
      customerName:     r.customer_name,
      issueDate:        r.issue_date,
      reason:           r.reason,
      amountNet:        Number(r.amount_net),
      vatRate:          Number(r.vat_rate),
      vatAmount:        Number(r.vat_amount),
      amountGross:      Number(r.amount_gross),
      createdAt:        r.created_at,
    }));
  } catch {
    return [];
  }
}

/**
 * Bulk import for the localStorage→Supabase sync helper. Idempotent
 * via client_uuid: re-runs after a successful sync are no-ops.
 * Uses a single batch insert instead of a per-row loop (perf).
 */
export async function bulkImportCreditNotes(notes: AddCreditNoteInput[]): Promise<{ ok: boolean; inserted: number; error?: string }> {
  if (!isConfigured() || !notes.length) return { ok: true, inserted: 0 };
  try {
    const supabase = await createSupabaseServerClient();
    const accountId = await resolveAccountId();
    if (!accountId) return { ok: false, inserted: 0, error: "Not authenticated" };

    // Server-allocate a contiguous block of CN numbers so existing
    // numbering isn't disrupted by the migration.
    const baseNumber = await nextCreditNoteNumberSeed(accountId);

    const rows = notes.map((n, idx) => {
      const net   = Math.max(0, n.amountNet);
      const vat   = Math.round(net * (n.vatRate / 100) * 100) / 100;
      const gross = Math.round((net + vat) * 100) / 100;
      return {
        account_id:         accountId,
        credit_note_number: `CN-${String(baseNumber + idx).padStart(3, "0")}`,
        invoice_id:         n.invoiceId ?? null,
        invoice_number:     n.invoiceNumber ?? null,
        customer_name:      n.customerName.trim(),
        issue_date:         n.issueDate,
        reason:             n.reason.trim(),
        amount_net:         net,
        vat_rate:           n.vatRate,
        vat_amount:         vat,
        amount_gross:       gross,
        client_uuid:        n.clientUuid ?? null,
      };
    });

    const { data, error } = await supabase
      .from("zentra_credit_notes")
      .upsert(rows, { onConflict: "account_id,client_uuid", ignoreDuplicates: true })
      .select("id");
    if (error) return { ok: false, inserted: 0, error: error.message };
    return { ok: true, inserted: data?.length ?? 0 };
  } catch (err) {
    return { ok: false, inserted: 0, error: err instanceof Error ? err.message : "unknown" };
  }
}

/**
 * Find the next free CN-NNN integer for this account. Returns just the
 * integer so bulkImport can allocate a contiguous range without N round-trips.
 */
async function nextCreditNoteNumberSeed(accountId: string): Promise<number> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("zentra_credit_notes")
    .select("credit_note_number")
    .eq("account_id", accountId);
  const nums = (data ?? [])
    .map((r) => r.credit_note_number?.match(/CN-(\d+)/))
    .map((m) => (m ? parseInt(m[1], 10) : 0));
  return (nums.length ? Math.max(...nums) : 0) + 1;
}
