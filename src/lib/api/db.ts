import { createSupabaseServerClient, hasSupabaseServerConfig } from "@/lib/supabase/server";
import { 
  Invoice, 
  CollectionsPlanItem, 
  Customer, 
  ActivityEvent,
  ImportBatch,
  ImportSummary,
  ImportDiff
} from "@/types/zentra";
import { rankCollectionActions } from "@/lib/ranking/zentra-ranker";

export async function getActiveAccount() {
  if (!hasSupabaseServerConfig()) return null;
  const supabase = await createSupabaseServerClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: memberData, error } = await supabase
    .from('zentra_account_members')
    .select('account_id, zentra_accounts(*)')
    .eq('user_id', user.id)
    .single();

  if (error || !memberData) return null;
  return memberData.zentra_accounts;
}

export async function getInvoices(): Promise<Invoice[]> {
  if (!hasSupabaseServerConfig()) {
    return []; // Fallback to empty if not configured
  }

  const supabase = await createSupabaseServerClient();
  
  // Fetch invoices with customer details
  const { data, error } = await supabase
    .from('zentra_invoices')
    .select(`
      *,
      zentra_customers (
        name,
        email,
        contact_role,
        relationship_type
      )
    `)
    .order('due_date', { ascending: true });

  if (error) {
    console.error("Error fetching invoices:", error);
    return [];
  }

  return (data || []).map(row => mapDbInvoiceToType(row));
}

export async function saveImportBatch(
  batch: Partial<ImportBatch>,
  invoices: Invoice[]
) {
  if (!hasSupabaseServerConfig()) return null;
  const supabase = await createSupabaseServerClient();

  // 1. Create the batch record
  const { data: batchData, error: batchError } = await supabase
    .from('zentra_import_batches')
    .insert({
      business_id: batch.businessId,
      source: batch.source,
      file_name: batch.fileName,
      row_count: batch.rowCount,
      valid_invoice_count: batch.validInvoiceCount,
      warning_count: batch.warningCount,
      status: 'completed'
    })
    .select('id')
    .single();

  if (batchError) throw batchError;
  const batchId = batchData.id;

  // 2. Map and insert customers (simplified upsert logic)
  // In production, we'd do a more robust upsert by name/email
  const customersToInsert = Array.from(new Set(invoices.map(i => i.customerName))).map(name => {
    const inv = invoices.find(i => i.customerName === name)!;
    return {
      business_id: batch.businessId,
      name: name,
      email: inv.customerEmail,
      relationship_type: inv.relationshipType || 'regular customer'
    };
  });

  const { data: customerData, error: customerError } = await supabase
    .from('zentra_customers')
    .upsert(customersToInsert, { onConflict: 'business_id, name' })
    .select('id, name');

  if (customerError) throw customerError;

  // 3. Insert Invoices
  const invoicesToInsert = invoices.map(inv => {
    const customer = customerData.find(c => c.name === inv.customerName);
    return {
      business_id: batch.businessId,
      customer_id: customer?.id,
      source_batch_id: batchId,
      invoice_number: inv.invoiceNumber,
      invoice_date: inv.invoiceDate,
      due_date: inv.dueDate,
      amount: inv.amount,
      amount_outstanding: inv.amountOutstanding,
      currency: inv.currency,
      status: inv.status,
      line_items: inv.lineItems || []
    };
  });

  const { error: invError } = await supabase
    .from('zentra_invoices')
    .upsert(invoicesToInsert, { onConflict: 'business_id, invoice_number' });

  if (invError) throw invError;

  return batchId;
}

/**
 * Helper to map DB row to Zentra Invoice type
 */
function mapDbInvoiceToType(row: any): Invoice {
  const customer = row.zentra_customers;
  
  // Calculate days overdue
  const dueDate = row.due_date ? new Date(row.due_date) : null;
  const now = new Date();
  const daysOverdue = dueDate && dueDate < now 
    ? Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  return {
    id: row.id,
    businessId: row.business_id,
    bookkeeperClientId: row.bookkeeper_client_id,
    customerId: row.customer_id,
    customerName: customer?.name || "Unknown Customer",
    customerEmail: customer?.email,
    customerContactRole: customer?.contact_role,
    invoiceNumber: row.invoice_number,
    invoiceDate: row.invoice_date,
    dueDate: row.due_date,
    amount: parseFloat(row.amount),
    amountOutstanding: parseFloat(row.amount_outstanding),
    currency: row.currency,
    status: row.status,
    daysOverdue: daysOverdue,
    previousChaseCount: row.previous_chase_count || 0,
    lastChasedDate: row.last_chased_date,
    promisedPaymentDate: row.promised_payment_date,
    disputeReason: row.dispute_reason,
    paymentClaimed: row.payment_claimed,
    remittanceNeeded: row.remittance_needed,
    statementNeeded: row.statement_needed,
    relationshipType: customer?.relationship_type || 'regular customer',
    customerNotes: row.customer_notes,
    lineItems: row.line_items || [],
    activityHistory: [], // Would fetch from zentra_activity_events in full impl
    sourceBatchId: row.source_batch_id,
    importedRowNumber: row.imported_row_number
  };
}
