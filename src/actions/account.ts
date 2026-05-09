"use server";

import { createSupabaseServerClient, hasSupabaseServerConfig } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function createSupabaseAccountAction(data: {
  businessName: string;
  planId: string;
  accountingSoftware?: string;
  monthlyInvoiceVolume?: string;
  mainArPainPoint?: string;
}) {
  if (!hasSupabaseServerConfig()) {
    return { success: false, error: "unconfigured" };
  }

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    // 1. Create the account record
    const { data: account, error: accountError } = await supabase
      .from('zentra_accounts')
      .insert({
        owner_user_id: user.id,
        plan_id: data.planId.toUpperCase().replace(/_SINGLE_BUSINESS$/, '_SINGLE'), // Map to migration enum
        status: data.planId === 'trial' ? 'trialing' : 'active',
        subscription_status: data.planId === 'trial' ? 'trialing' : 'demo',
        trial_started_at: data.planId === 'trial' ? new Date().toISOString() : null,
        trial_ends_at: data.planId === 'trial' ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString() : null,
      })
      .select('id')
      .single();

    if (accountError) throw accountError;
    const accountId = account.id;

    // 2. Add user as owner/member of the account
    const { error: memberError } = await supabase
      .from('zentra_account_members')
      .insert({
        account_id: accountId,
        user_id: user.id,
        role: 'owner'
      });

    if (memberError) throw memberError;

    // 3. Create the initial business
    const { error: bizError } = await supabase
      .from('zentra_businesses')
      .insert({
        account_id: accountId,
        name: data.businessName,
        business_type: 'service_business'
      });

    if (bizError) throw bizError;

    revalidatePath('/');
    return { success: true, accountId };
  } catch (err: any) {
    console.error("Error creating account:", err);
    return { success: false, error: err.message };
  }
}
