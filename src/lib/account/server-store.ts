import type { PlanId, UsageCounters, UsageType } from "@/lib/account/plans";
import {
  createEmptyUsageCounters,
  getPlanConfig,
  type AccountState,
} from "@/lib/account/plans";
import {
  createSupabaseServerClient,
  getSupabaseAdminClient,
  hasSupabaseAdminConfig,
  hasSupabaseServerConfig,
} from "@/lib/supabase/server";

export type ServerAccountRecord = {
  id: string;
  ownerUserId: string;
  planId: PlanId;
  status: AccountState["status"];
  trialStartedAt?: string;
  trialEndsAt?: string;
  gracePeriodEndsAt?: string;
  currentPeriodStartedAt?: string;
  usage: UsageCounters;
};

export type UsageEventType =
  | "import_created"
  | "ai_draft_generated"
  | "ai_reply_classified"
  | "ai_message_rewritten"
  | "ai_unknown_mapping"
  | "ai_customer_summary"
  | "weekly_digest_narrative"
  | "client_ledger_added";

export async function getCurrentServerAccount(): Promise<ServerAccountRecord | null> {
  if (!hasSupabaseServerConfig()) return null;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: membership, error } = await supabase
    .from("zentra_account_members")
    .select("account_id, zentra_accounts(*)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error || !membership?.zentra_accounts) return null;

  const rawAccount = Array.isArray(membership.zentra_accounts)
    ? membership.zentra_accounts[0]
    : membership.zentra_accounts;
  if (!rawAccount) return null;

  return toServerAccountRecord(rawAccount as unknown as RawAccountRow);
}

export async function createServerAccountForUser(input: {
  userId: string;
  planId: PlanId;
  businessName?: string;
}) {
  if (!hasSupabaseAdminConfig()) {
    throw new Error("Supabase admin client is required to create accounts.");
  }

  const supabase = getSupabaseAdminClient();
  const now = new Date();
  const plan = getPlanConfig(input.planId);
  const trialEndsAt = plan.trialDays
    ? addDays(now, plan.trialDays).toISOString()
    : null;
  const gracePeriodEndsAt =
    trialEndsAt && plan.gracePeriodDays
      ? addDays(new Date(trialEndsAt), plan.gracePeriodDays).toISOString()
      : null;

  const { data: account, error: accountError } = await supabase
    .from("zentra_accounts")
    .insert({
      owner_user_id: input.userId,
      plan_id: input.planId,
      status:
        input.planId === "DEMO"
          ? "demo"
          : input.planId === "TRIAL"
            ? "trialing"
            : "active",
      trial_started_at: input.planId === "TRIAL" ? now.toISOString() : null,
      trial_ends_at: trialEndsAt,
      grace_period_ends_at: gracePeriodEndsAt,
      current_period_started_at: now.toISOString(),
    })
    .select("*")
    .single();

  if (accountError) throw accountError;

  const accountId = account.id as string;
  const { error: memberError } = await supabase
    .from("zentra_account_members")
    .insert({
      account_id: accountId,
      user_id: input.userId,
      role: "owner",
    });
  if (memberError) throw memberError;

  if (input.businessName) {
    const { error: businessError } = await supabase
      .from("zentra_businesses")
      .insert({
        account_id: accountId,
        name: input.businessName,
        business_type: "service_business",
      });
    if (businessError) throw businessError;
  }

  return toServerAccountRecord(account as RawAccountRow);
}

export async function recordServerUsageEvent(input: {
  accountId: string;
  eventType: UsageEventType;
  usageType?: UsageType;
  quantity?: number;
  metadata?: Record<string, unknown>;
}) {
  if (!hasSupabaseAdminConfig()) return null;

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("zentra_usage_events")
    .insert({
      account_id: input.accountId,
      event_type: input.eventType,
      usage_type: input.usageType ?? null,
      quantity: input.quantity ?? 1,
      metadata: input.metadata ?? {},
    })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

type RawAccountRow = {
  id: string;
  owner_user_id: string;
  plan_id: PlanId;
  status: AccountState["status"];
  trial_started_at: string | null;
  trial_ends_at: string | null;
  grace_period_ends_at: string | null;
  current_period_started_at: string | null;
  usage_rollup?: Partial<UsageCounters> | null;
};

function toServerAccountRecord(row: RawAccountRow): ServerAccountRecord {
  return {
    id: row.id,
    ownerUserId: row.owner_user_id,
    planId: row.plan_id,
    status: row.status,
    trialStartedAt: row.trial_started_at ?? undefined,
    trialEndsAt: row.trial_ends_at ?? undefined,
    gracePeriodEndsAt: row.grace_period_ends_at ?? undefined,
    currentPeriodStartedAt: row.current_period_started_at ?? undefined,
    usage: createEmptyUsageCounters(row.usage_rollup ?? {}),
  };
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}
