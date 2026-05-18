"use server";

import { createSupabaseServerClient, hasSupabaseServerConfig } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

/**
 * CB-6: persist the business name captured by the onboarding gate
 * into zentra_businesses so chase emails and the Settings page
 * actually see it. Idempotent — safe to call on every onboarding
 * completion. Silently no-ops when Supabase isn't configured (demo).
 */
export async function saveOnboardingBusinessNameAction(rawName: string) {
  const name = rawName.trim();
  if (!name) return { ok: false, error: "empty_name" };
  if (!hasSupabaseServerConfig()) return { ok: true, skipped: "no_supabase" };

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not_signed_in" };

  const { data: member } = await supabase
    .from("zentra_account_members")
    .select("account_id")
    .eq("user_id", user.id)
    .maybeSingle();
  const accountId = member?.account_id as string | undefined;
  if (!accountId) return { ok: false, error: "no_account" };

  // Try update first; if none, insert.
  const { data: existing } = await supabase
    .from("zentra_businesses")
    .select("id, name")
    .eq("account_id", accountId)
    .limit(1)
    .maybeSingle();

  if (existing?.id) {
    // Don't overwrite a non-empty existing name — user may have set it manually.
    if (existing.name && existing.name.trim()) return { ok: true, kept_existing: true };
    const { error: updateError } = await supabase
      .from("zentra_businesses")
      .update({ name })
      .eq("id", existing.id);
    if (updateError) return { ok: false, error: updateError.message };
  } else {
    const { error: insertError } = await supabase
      .from("zentra_businesses")
      .insert({ account_id: accountId, name, business_type: "service_business" });
    if (insertError) return { ok: false, error: insertError.message };
  }

  revalidatePath("/settings");
  return { ok: true };
}

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
