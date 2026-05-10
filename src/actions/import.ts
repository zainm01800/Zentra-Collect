"use server";

import { createSupabaseServerClient, hasSupabaseServerConfig } from "@/lib/supabase/server";
import { Invoice, ImportBatch } from "@/types/zentra";
import { revalidatePath } from "next/cache";

export async function saveImportBatchAction(
  batch: {
    businessId: string;
    source: string;
    fileName: string;
    rowCount: number;
    validInvoiceCount: number;
    warningCount: number;
  },
  invoices: Invoice[]
) {
  if (!hasSupabaseServerConfig()) {
    console.warn("Supabase not configured, skipping DB save.");
    return { success: false, reason: "unconfigured" };
  }

  const supabase = await createSupabaseServerClient();

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");
    
    const { data: member } = await supabase
      .from('zentra_account_members')
      .select('account_id')
      .eq('user_id', user.id)
      .single();
      
    if (!member) throw new Error("No account found");
    const accountId = member.account_id;

    // 1. Ensure a business exists
    let businessId = batch.businessId;
    if (!businessId || businessId === "default") {
      const { data: existingBusiness } = await supabase
        .from('zentra_businesses')
        .select('id')
        .eq('account_id', accountId)
        .limit(1)
        .single();
      
      if (existingBusiness) {
        businessId = existingBusiness.id;
      } else {
        const { data: newBusiness, error: bizError } = await supabase
          .from('zentra_businesses')
          .insert({
            account_id: accountId,
            name: "My Business",
            business_type: "service_business"
          })
          .select('id')
          .single();
        if (bizError) throw bizError;
        businessId = newBusiness.id;
      }
    }

    // 2. Create the batch record
    const { data: batchData, error: batchError } = await supabase
      .from('zentra_import_batches')
      .insert({
        account_id: accountId,
        business_id: businessId,
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

    // 3. Map and upsert customers
    const uniqueCustomerNames = Array.from(new Set(invoices.map(i => i.customerName)));
    const customersUpsert = uniqueCustomerNames.map(name => {
      const inv = invoices.find(i => i.customerName === name)!;
      return {
        account_id: accountId,
        business_id: businessId,
        name: name,
        email: inv.customerEmail,
        relationship_type: inv.relationshipType || 'regular customer'
      };
    });

    const { data: customerData, error: customerError } = await supabase
      .from('zentra_customers')
      .upsert(customersUpsert, { onConflict: 'account_id, business_id, name' })
      .select('id, name');

    if (customerError) throw customerError;

    // 4. Insert Invoices
    const invoicesToInsert = invoices.map(inv => {
      const customer = customerData.find(c => c.name === inv.customerName);
      return {
        account_id: accountId,
        business_id: businessId,
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
      .upsert(invoicesToInsert, { onConflict: 'account_id, business_id, invoice_number' });

    if (invError) throw invError;

    revalidatePath('/dashboard');
    return { success: true, batchId };
  } catch (err) {
    console.error("Error in saveImportBatchAction:", err);
    return { success: false, reason: "error", error: err };
  }
}
