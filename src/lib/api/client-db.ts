import { createSupabaseBrowserClient, hasSupabaseBrowserConfig } from "@/lib/supabase/browser";
import { Invoice } from "@/types/zentra";

export async function fetchAccountFromDb(): Promise<any> {
  if (!hasSupabaseBrowserConfig()) return null;
  const supabase = createSupabaseBrowserClient();

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

export async function fetchInvoicesFromDb(): Promise<Invoice[]> {
  if (!hasSupabaseBrowserConfig()) return [];
  const supabase = createSupabaseBrowserClient();

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

function mapDbInvoiceToType(row: any): Invoice {
  const customer = row.zentra_customers;
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
    activityHistory: [],
    sourceBatchId: row.source_batch_id,
    importedRowNumber: row.imported_row_number
  };
}
