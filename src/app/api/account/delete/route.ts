/**
 * DELETE /api/account/delete
 *
 * GDPR-compliant account deletion. Requires:
 *   - Valid session (authenticated user)
 *   - { confirm: true } in the request body
 *
 * What gets deleted:
 *   - Stripe subscription cancelled (if active)
 *   - zentra_accounts row deleted (cascades to all child tables:
 *       usage_events, usage_rollups, email_settings, oauth_connections,
 *       push_subscriptions, account_members, businesses, etc.)
 *   - Supabase auth.users entry deleted (via admin client)
 */

import { NextResponse } from "next/server";
import {
  createSupabaseServerClient,
  getSupabaseAdminClient,
  hasSupabaseAdminConfig,
  hasSupabaseServerConfig,
} from "@/lib/supabase/server";

function getStripeIfConfigured() {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  const { stripe } = require("@/lib/stripe/client");
  return stripe;
}

export async function DELETE(request: Request) {
  if (!hasSupabaseServerConfig()) {
    return NextResponse.json(
      { error: "Account deletion is not available in demo mode." },
      { status: 400 },
    );
  }

  let body: { confirm?: boolean } = {};
  try {
    body = await request.json();
  } catch {
    // body is optional for DELETE; confirm defaults to false
  }

  if (!body.confirm) {
    return NextResponse.json(
      { error: "Send { confirm: true } to confirm account deletion." },
      { status: 400 },
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  // Resolve the account and verify ownership
  const { data: membership } = await supabase
    .from("zentra_account_members")
    .select("account_id, role, zentra_accounts(stripe_subscription_id, stripe_customer_id, email_addon_subscription_id)")
    .eq("user_id", user.id)
    .eq("role", "owner")
    .maybeSingle();

  if (!membership) {
    return NextResponse.json(
      { error: "No owned account found." },
      { status: 404 },
    );
  }

  const accountId = membership.account_id;
  const accRaw = Array.isArray(membership.zentra_accounts)
    ? membership.zentra_accounts[0]
    : membership.zentra_accounts;
  const acc = accRaw as Record<string, string | null> | null;
  const stripeSubId = acc?.stripe_subscription_id ?? null;
  const stripeEmailSubId = acc?.email_addon_subscription_id ?? null;

  // ── 1. Cancel Stripe subscriptions ───────────────────────────────────────────
  const stripe = getStripeIfConfigured();
  if (stripe) {
    const subIds = [stripeSubId, stripeEmailSubId].filter(Boolean) as string[];
    for (const subId of subIds) {
      try {
        await stripe.subscriptions.cancel(subId);
        console.log(`[account/delete] Cancelled Stripe subscription ${subId}`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        // Don't block deletion if subscription cancel fails (may already be cancelled)
        console.warn(`[account/delete] Failed to cancel subscription ${subId}: ${msg}`);
      }
    }
  }

  // ── 2. Delete zentra_accounts row (cascades to all child tables) ──────────
  const { error: deleteAccountError } = await supabase
    .from("zentra_accounts")
    .delete()
    .eq("id", accountId);

  if (deleteAccountError) {
    console.error("[account/delete] Failed to delete zentra_accounts row:", deleteAccountError);
    return NextResponse.json(
      { error: "Failed to delete account data. Contact support." },
      { status: 500 },
    );
  }

  console.log(`[account/delete] Deleted zentra_accounts ${accountId} for user ${user.id}`);

  // ── 3. Delete the Supabase auth user (requires admin client) ─────────────
  if (hasSupabaseAdminConfig()) {
    const admin = getSupabaseAdminClient();
    const { error: authDeleteError } = await admin.auth.admin.deleteUser(user.id);
    if (authDeleteError) {
      // Data is already gone; auth cleanup failure is non-fatal but should be investigated
      console.error(`[account/delete] Failed to delete auth user ${user.id}:`, authDeleteError);
    } else {
      console.log(`[account/delete] Deleted auth user ${user.id}`);
    }
  }

  return NextResponse.json({ deleted: true });
}
