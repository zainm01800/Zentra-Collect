"use server";

/**
 * invoices.ts — server actions for individual invoice management.
 *
 * Separate from the CSV import flow (src/actions/import.ts). These actions
 * handle single-invoice operations: creating a manual entry, fetching
 * data for form autocomplete, etc.
 */

import { revalidatePath } from "next/cache";
import {
  createSupabaseServerClient,
  hasSupabaseServerConfig,
} from "@/lib/supabase/server";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AddInvoiceInput {
  /** Client / customer name. A new zentra_customers row is created if unknown. */
  customerName:  string;
  invoiceNumber: string;
  invoiceDate:   string;   // YYYY-MM-DD
  dueDate:       string;   // YYYY-MM-DD
  /** Net amount (before VAT). The stored `amount` column is gross. */
  amount:        number;
  /** UK VAT rate as whole-number percent (0/5/20). Omit for non-VAT-registered. */
  vatRate?:      number;
  notes?:        string;
}

export interface AddInvoiceResult {
  success:    boolean;
  invoiceId?: string;
  /** Machine-readable failure reason for the form to display appropriate copy. */
  reason?:    "unconfigured" | "unauthenticated" | "no_account" | "error";
}

export interface InvoiceSuggestions {
  /** Existing customer names — used to populate the datalist autocomplete. */
  customerNames:     string[];
  /**
   * Next suggested invoice number based on the highest existing INV-NNN
   * sequence in the account, e.g. "INV-008" if the highest is INV-007.
   * Falls back to "INV-001" when no matching invoices exist.
   */
  nextInvoiceNumber: string;
}

// ── Private helpers ───────────────────────────────────────────────────────────

/**
 * Resolve the authenticated user's account_id and their primary business_id.
 * Creates a default business if none exists yet — mirrors the pattern in
 * saveImportBatchAction so both flows share the same business record.
 */
async function requireAccountAndBusiness(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId:   string,
): Promise<{ accountId: string; businessId: string }> {
  const { data: member } = await supabase
    .from("zentra_account_members")
    .select("account_id")
    .eq("user_id", userId)
    .single();

  if (!member) throw new Error("No account found for user");
  const accountId = member.account_id;

  const { data: existing } = await supabase
    .from("zentra_businesses")
    .select("id")
    .eq("account_id", accountId)
    .limit(1)
    .maybeSingle();

  if (existing) return { accountId, businessId: existing.id };

  const { data: created, error: bizErr } = await supabase
    .from("zentra_businesses")
    .insert({
      account_id:    accountId,
      name:          "My Business",
      business_type: "service_business",
    })
    .select("id")
    .single();

  if (bizErr) throw bizErr;
  return { accountId, businessId: created.id };
}

// ── Actions ───────────────────────────────────────────────────────────────────

/**
 * Fetch existing customer names and suggest the next invoice number.
 * Called client-side when the Add Invoice sheet opens.
 *
 * Both queries run in parallel. Returns safe empty defaults when Supabase
 * is unconfigured or the user is unauthenticated — the form still works,
 * just without pre-filled suggestions.
 */
export async function getInvoiceSuggestions(): Promise<InvoiceSuggestions> {
  const empty: InvoiceSuggestions = {
    customerNames:     [],
    nextInvoiceNumber: "INV-001",
  };

  if (!hasSupabaseServerConfig()) return empty;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return empty;

  // Resolve the account — if it doesn't exist yet, return empty gracefully.
  const { data: member } = await supabase
    .from("zentra_account_members")
    .select("account_id")
    .eq("user_id", user.id)
    .single();
  if (!member) return empty;

  const accountId = member.account_id;

  const [customersRes, invoicesRes] = await Promise.all([
    // All customer names for this account, alphabetically sorted.
    supabase
      .from("zentra_customers")
      .select("name")
      .eq("account_id", accountId)
      .order("name"),

    // Only invoice numbers that follow the INV-NNN convention.
    supabase
      .from("zentra_invoices")
      .select("invoice_number")
      .eq("account_id", accountId)
      .like("invoice_number", "INV-%"),
  ]);

  const customerNames = (customersRes.data ?? []).map((r) => r.name as string);

  // Parse the numeric part of every INV-NNN number; find the highest.
  const nums = (invoicesRes.data ?? [])
    .map((r) => parseInt((r.invoice_number as string).slice(4), 10))
    .filter((n) => !isNaN(n));

  const nextNum = nums.length > 0 ? Math.max(...nums) + 1 : 1;
  const nextInvoiceNumber = `INV-${String(nextNum).padStart(3, "0")}`;

  return { customerNames, nextInvoiceNumber };
}

/**
 * Insert a single manually-entered invoice.
 *
 * Steps:
 *  1. Authenticate and resolve account + business (creating a business if needed).
 *  2. Upsert the customer by name — creates a new zentra_customers row for
 *     net-new clients, or returns the existing row on conflict.
 *  3. Insert a minimal "manual" zentra_import_batches record for traceability,
 *     using the same shape as the CSV import flow.
 *  4. Insert the invoice row.  Status is derived from whether the due date
 *     has already passed: "overdue" if past, "due_soon" if future.
 *  5. Revalidate /dashboard so server-rendered invoice lists refresh.
 */
export async function addInvoice(input: AddInvoiceInput): Promise<AddInvoiceResult> {
  if (!hasSupabaseServerConfig()) {
    return { success: false, reason: "unconfigured" };
  }

  const supabase = await createSupabaseServerClient();

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false, reason: "unauthenticated" };

    const { accountId, businessId } = await requireAccountAndBusiness(
      supabase,
      user.id,
    );

    // ── Customer ─────────────────────────────────────────────────────────────
    //
    // Upsert on the unique triple (account_id, business_id, name) so re-using
    // an existing client name returns the existing row without creating a duplicate.
    // New client names silently create a fresh record with sensible defaults.

    const { data: customer, error: custErr } = await supabase
      .from("zentra_customers")
      .upsert(
        {
          account_id:        accountId,
          business_id:       businessId,
          name:              input.customerName,
          relationship_type: "regular customer",
        },
        { onConflict: "account_id, business_id, name" },
      )
      .select("id")
      .single();

    if (custErr) throw custErr;

    // ── Batch record ──────────────────────────────────────────────────────────
    //
    // Every invoice in the system belongs to an import batch. For manual
    // entries we create a lightweight batch with source = "manual" so the
    // invoice appears correctly in any batch-aware views.

    const { data: batch, error: batchErr } = await supabase
      .from("zentra_import_batches")
      .insert({
        account_id:          accountId,
        business_id:         businessId,
        source:              "manual",
        file_name:           "manual entry",
        row_count:           1,
        valid_invoice_count: 1,
        warning_count:       0,
        status:              "completed",
      })
      .select("id")
      .single();

    if (batchErr) throw batchErr;

    // ── Status from due date ──────────────────────────────────────────────────

    const todayStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD UTC
    const status   = input.dueDate < todayStr ? "overdue" : "due_soon";

    // ── Invoice ───────────────────────────────────────────────────────────────

    // ── VAT calc ───────────────────────────────────────────────────────────
    // `input.amount` is NET (pre-VAT). Compute the VAT portion and gross
    // total. Stored line_items capture the breakdown so the VAT estimate
    // page can later sum vatAmount across all invoices in a tax year.
    const vatRate    = Number.isFinite(input.vatRate) ? Number(input.vatRate) : 0;
    const netAmount  = input.amount;
    const vatAmount  = Math.round(netAmount * (vatRate / 100) * 100) / 100;
    const grossAmount = Math.round((netAmount + vatAmount) * 100) / 100;

    const lineItems = [{
      id:          `li-${Date.now()}`,
      description: input.notes?.trim() || "Invoice",
      quantity:    1,
      unitPrice:   netAmount,
      amount:      netAmount,
      vatRate,
      vatAmount,
    }];

    const { data: invoice, error: invErr } = await supabase
      .from("zentra_invoices")
      .insert({
        account_id:         accountId,
        business_id:        businessId,
        customer_id:        customer.id,
        source_batch_id:    batch.id,
        invoice_number:     input.invoiceNumber,
        invoice_date:       input.invoiceDate,
        due_date:           input.dueDate,
        amount:             grossAmount,
        amount_outstanding: grossAmount,
        currency:           "GBP",
        status,
        notes:              input.notes ?? null,
        line_items:         lineItems,
      })
      .select("id")
      .single();

    if (invErr) throw invErr;

    revalidatePath("/dashboard");
    return { success: true, invoiceId: invoice.id };
  } catch (err) {
    console.error("addInvoice:", err);
    return { success: false, reason: "error" };
  }
}
