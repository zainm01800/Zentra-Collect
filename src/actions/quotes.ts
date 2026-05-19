"use server";

/**
 * Server-side CRUD for quotes. Line items are stored as JSONB so the
 * shape matches the client-side QuoteLineItem[] exactly.
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type QuoteStatus = "draft" | "sent" | "accepted" | "declined" | "converted";

export interface QuoteLineItemRecord {
  id:          string;
  description: string;
  quantity:    number;
  unitPrice:   number;
  amount:      number;
  vatRate?:    number;
  vatAmount?:  number;
}

export interface QuoteRecord {
  id:                   string;
  quoteNumber:          string;
  customerName:         string;
  customerEmail?:       string;
  issueDate:            string;
  expiresOn?:           string;
  status:               QuoteStatus;
  lineItems:            QuoteLineItemRecord[];
  notes?:               string;
  convertedToInvoiceId?: string;
  createdAt:            string;
  updatedAt:            string;
}

export interface AddQuoteInput {
  customerName:   string;
  customerEmail?: string;
  issueDate:      string;
  expiresOn?:     string;
  amountNet:      number;
  vatRate:        number;
  description:    string;
  notes?:         string;
  /** Local client id (e.g. q-XXXX) — enables idempotent re-sync. */
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

async function nextQuoteNumber(accountId: string): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("zentra_quotes")
    .select("quote_number")
    .eq("account_id", accountId);
  const nums = (data ?? [])
    .map((r) => r.quote_number?.match(/QTE-(\d+)/))
    .map((m) => (m ? parseInt(m[1], 10) : 0));
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `QTE-${String(next).padStart(3, "0")}`;
}

function rowToRecord(r: Record<string, unknown>): QuoteRecord {
  return {
    id:                   r.id as string,
    quoteNumber:          r.quote_number as string,
    customerName:         r.customer_name as string,
    customerEmail:        (r.customer_email as string | null) ?? undefined,
    issueDate:            r.issue_date as string,
    expiresOn:            (r.expires_on as string | null) ?? undefined,
    status:               r.status as QuoteStatus,
    lineItems:            (r.line_items as QuoteLineItemRecord[]) ?? [],
    notes:                (r.notes as string | null) ?? undefined,
    convertedToInvoiceId: (r.converted_to_invoice_id as string | null) ?? undefined,
    createdAt:            r.created_at as string,
    updatedAt:            r.updated_at as string,
  };
}

export async function addQuote(input: AddQuoteInput): Promise<{ ok: boolean; quote?: QuoteRecord; error?: string }> {
  if (!isConfigured()) return { ok: true };
  try {
    const supabase = await createSupabaseServerClient();
    const accountId = await resolveAccountId();
    if (!accountId) return { ok: false, error: "Not authenticated" };

    const net  = Math.max(0, input.amountNet);
    const vat  = Math.round(net * (input.vatRate / 100) * 100) / 100;
    const number = await nextQuoteNumber(accountId);

    const lineItem: QuoteLineItemRecord = {
      id:          `qli-${Date.now()}`,
      description: input.description.trim() || "Quote",
      quantity:    1,
      unitPrice:   net,
      amount:      net,
      vatRate:     input.vatRate,
      vatAmount:   vat,
    };

    const row = {
      account_id:     accountId,
      quote_number:   number,
      customer_name:  input.customerName.trim(),
      customer_email: input.customerEmail?.trim() || null,
      issue_date:     input.issueDate,
      expires_on:     input.expiresOn || null,
      status:         "draft",
      line_items:     [lineItem],
      notes:          input.notes?.trim() || null,
      client_uuid:    input.clientUuid ?? null,
    };
    const query = input.clientUuid
      ? supabase.from("zentra_quotes").upsert(row, { onConflict: "account_id,client_uuid" })
      : supabase.from("zentra_quotes").insert(row);
    const { data, error } = await query.select("*").single();

    if (error || !data) return { ok: false, error: error?.message ?? "insert failed" };
    return { ok: true, quote: rowToRecord(data) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "unknown" };
  }
}

export async function setQuoteStatus(id: string, status: QuoteStatus): Promise<{ ok: boolean; quote?: QuoteRecord; error?: string }> {
  if (!isConfigured()) return { ok: true };
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("zentra_quotes")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .single();
    if (error || !data) return { ok: false, error: error?.message ?? "update failed" };
    return { ok: true, quote: rowToRecord(data) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "unknown" };
  }
}

export async function markQuoteConverted(id: string, invoiceId: string): Promise<{ ok: boolean; quote?: QuoteRecord; error?: string }> {
  if (!isConfigured()) return { ok: true };
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("zentra_quotes")
      .update({
        status: "converted",
        converted_to_invoice_id: invoiceId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("*")
      .single();
    if (error || !data) return { ok: false, error: error?.message ?? "update failed" };
    return { ok: true, quote: rowToRecord(data) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "unknown" };
  }
}

export async function deleteQuote(id: string): Promise<{ ok: boolean; error?: string }> {
  if (!isConfigured()) return { ok: true };
  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.from("zentra_quotes").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "unknown" };
  }
}

export async function getQuotes(): Promise<QuoteRecord[]> {
  if (!isConfigured()) return [];
  try {
    const supabase = await createSupabaseServerClient();
    const accountId = await resolveAccountId();
    if (!accountId) return [];

    const { data, error } = await supabase
      .from("zentra_quotes")
      .select("*")
      .eq("account_id", accountId)
      .order("created_at", { ascending: false });

    if (error || !data) return [];
    return data.map(rowToRecord);
  } catch {
    return [];
  }
}

/**
 * Bulk import for sync. Idempotent via client_uuid + single batch insert.
 */
export async function bulkImportQuotes(quotes: AddQuoteInput[]): Promise<{ ok: boolean; inserted: number; error?: string }> {
  if (!isConfigured() || !quotes.length) return { ok: true, inserted: 0 };
  try {
    const supabase = await createSupabaseServerClient();
    const accountId = await resolveAccountId();
    if (!accountId) return { ok: false, inserted: 0, error: "Not authenticated" };

    const baseNumber = await nextQuoteNumberSeed(accountId);

    const rows = quotes.map((q, idx) => {
      const net  = Math.max(0, q.amountNet);
      const vat  = Math.round(net * (q.vatRate / 100) * 100) / 100;
      const lineItem: QuoteLineItemRecord = {
        id:          `qli-${Date.now()}-${idx}`,
        description: q.description.trim() || "Quote",
        quantity:    1,
        unitPrice:   net,
        amount:      net,
        vatRate:     q.vatRate,
        vatAmount:   vat,
      };
      return {
        account_id:     accountId,
        quote_number:   `QTE-${String(baseNumber + idx).padStart(3, "0")}`,
        customer_name:  q.customerName.trim(),
        customer_email: q.customerEmail?.trim() || null,
        issue_date:     q.issueDate,
        expires_on:     q.expiresOn || null,
        status:         "draft" as const,
        line_items:     [lineItem],
        notes:          q.notes?.trim() || null,
        client_uuid:    q.clientUuid ?? null,
      };
    });

    const { data, error } = await supabase
      .from("zentra_quotes")
      .upsert(rows, { onConflict: "account_id,client_uuid", ignoreDuplicates: true })
      .select("id");
    if (error) return { ok: false, inserted: 0, error: error.message };
    return { ok: true, inserted: data?.length ?? 0 };
  } catch (err) {
    return { ok: false, inserted: 0, error: err instanceof Error ? err.message : "unknown" };
  }
}

async function nextQuoteNumberSeed(accountId: string): Promise<number> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("zentra_quotes")
    .select("quote_number")
    .eq("account_id", accountId);
  const nums = (data ?? [])
    .map((r) => r.quote_number?.match(/QTE-(\d+)/))
    .map((m) => (m ? parseInt(m[1], 10) : 0));
  return (nums.length ? Math.max(...nums) : 0) + 1;
}
