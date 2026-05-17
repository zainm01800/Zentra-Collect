/**
 * /api/usage
 *
 * GET  → UsageSnapshot (reads from zentra_usage_events for auth'd users,
 *         falls back to in-memory demo snapshot for anonymous users)
 * POST → Record a client-side usage event; writes to Supabase for auth'd users
 */

import { NextResponse } from "next/server";
import {
  DEMO_ACCOUNT_ID,
  getUsageSnapshot,
  recordAIAction,
  recordImport,
  incrementUsage,
} from "@/lib/usage/store";
import {
  createSupabaseServerClient,
  getSupabaseAdminClient,
  hasSupabaseAdminConfig,
  hasSupabaseServerConfig,
} from "@/lib/supabase/server";
import type { AIActionType, AccountUsage, UsageSnapshot } from "@/lib/usage/tracker";
import { computeUsageSnapshot, currentPeriodKey } from "@/lib/usage/tracker";
import type { PlanId } from "@/lib/billing/plans";

// Force dynamic — snapshot reflects live state
export const dynamic = "force-dynamic";

// ── Auth helper ───────────────────────────────────────────────────────────────

async function getAuthenticatedAccount(): Promise<{
  accountId: string | null;
  planId: string | null;
}> {
  if (!hasSupabaseServerConfig()) return { accountId: null, planId: null };
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { accountId: null, planId: null };

    const { data: member } = await supabase
      .from("zentra_account_members")
      .select("account_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle<{ account_id: string }>();

    if (!member?.account_id) return { accountId: null, planId: null };

    const { data: accountRow } = await supabase
      .from("zentra_accounts")
      .select("plan_id")
      .eq("id", member.account_id)
      .maybeSingle<{ plan_id: string }>();

    return {
      accountId: member.account_id,
      planId: accountRow?.plan_id?.toLowerCase() ?? null,
    };
  } catch {
    return { accountId: null, planId: null };
  }
}

// ── Supabase usage read ───────────────────────────────────────────────────────

/**
 * Aggregate usage from zentra_usage_events for the current calendar month.
 * Returns null if Supabase admin client isn't available.
 */
async function readUsageFromSupabase(
  accountId: string,
  planId: string,
): Promise<UsageSnapshot | null> {
  if (!hasSupabaseAdminConfig()) return null;

  const admin = getSupabaseAdminClient();
  const periodStart = `${currentPeriodKey()}-01`;

  try {
    const { data: events, error } = await admin
      .from("zentra_usage_events")
      .select("usage_type, quantity")
      .eq("account_id", accountId)
      .gte("created_at", periodStart);

    if (error) throw error;

    let importsThisMonth = 0;
    let aiActionsThisMonth = 0;
    let weeklyDigestsGenerated = 0;

    for (const ev of events ?? []) {
      const qty = ev.quantity ?? 1;
      if (ev.usage_type === "import") importsThisMonth += qty;
      else if (ev.usage_type === "aiAction") aiActionsThisMonth += qty;
      else if (ev.usage_type === "weeklyDigest") weeklyDigestsGenerated += qty;
    }

    // Non-monthly counters: read latest values from rollup table
    const { data: rollup } = await admin
      .from("zentra_usage_rollups")
      .select("active_invoice_count, client_ledger_count, saved_import_mapping_count")
      .eq("account_id", accountId)
      .order("period_start", { ascending: false })
      .limit(1)
      .maybeSingle();

    const accountUsage: AccountUsage = {
      id: accountId,
      planId: planId as PlanId,
      monthlyPeriodKey: currentPeriodKey(),
      importsThisMonth,
      aiActionsThisMonth,
      weeklyDigestsGenerated,
      activeInvoices: rollup?.active_invoice_count ?? 0,
      clientLedgers: rollup?.client_ledger_count ?? 0,
      savedImportMappings: rollup?.saved_import_mapping_count ?? 0,
      trialImportsUsed: 0,
      trialAIActionsUsed: 0,
      trialStartedAt: null,
      trialEndsAt: null,
      gracePeriodEndsAt: null,
    };

    return computeUsageSnapshot(accountUsage);
  } catch (err) {
    console.error("[api/usage] Supabase read failed:", err);
    return null;
  }
}

// ── Supabase usage write ──────────────────────────────────────────────────────

async function writeUsageEvent(
  accountId: string,
  usageType: "import" | "aiAction" | "weeklyDigest",
  quantity = 1,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  if (!hasSupabaseAdminConfig()) return;
  try {
    const admin = getSupabaseAdminClient();
    await admin.from("zentra_usage_events").insert({
      account_id: accountId,
      event_type: usageType === "import"
        ? "import_created"
        : usageType === "aiAction"
          ? "ai_action_recorded"
          : "weekly_digest_narrative",
      usage_type: usageType,
      quantity,
      metadata,
    });
  } catch (err) {
    // Non-fatal — in-memory store still updated
    console.error("[api/usage] Event write failed:", err);
  }
}

/**
 * Upsert the non-monthly snapshot counters (active invoices, ledgers, mappings)
 * to zentra_usage_rollups so the GET path can read them without scanning events.
 */
async function updateUsageRollup(
  accountId: string,
  updates: { active_invoice_count?: number; client_ledger_count?: number; saved_import_mapping_count?: number },
): Promise<void> {
  if (!hasSupabaseAdminConfig()) return;
  try {
    const admin = getSupabaseAdminClient();
    const periodStart = `${currentPeriodKey()}-01`;
    await admin.from("zentra_usage_rollups").upsert(
      {
        account_id: accountId,
        period_start: periodStart,
        ...updates,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "account_id,period_start", ignoreDuplicates: false },
    );
  } catch (err) {
    console.error("[api/usage] Rollup upsert failed:", err);
  }
}

// ── GET — return current snapshot ─────────────────────────────────────────────

export async function GET() {
  const { accountId, planId } = await getAuthenticatedAccount();

  if (accountId && planId) {
    const dbSnapshot = await readUsageFromSupabase(accountId, planId);
    if (dbSnapshot) return NextResponse.json(dbSnapshot);
  }

  // Fallback: in-memory demo snapshot with plan ID overlaid from DB
  const snapshot = getUsageSnapshot(accountId ?? DEMO_ACCOUNT_ID);
  if (planId) (snapshot as { planId: string }).planId = planId;
  return NextResponse.json(snapshot);
}

// ── POST — record a client-side usage event ───────────────────────────────────

type RecordImportBody = {
  action: "recordImport";
  fileName: string;
  invoiceCount: number;
  activeInvoiceCount: number;
};

type RecordAIActionBody = {
  action: "recordAIAction";
  actionType: AIActionType;
};

type RecordWeeklyDigestBody = {
  action: "recordWeeklyDigest";
};

type PostBody = RecordImportBody | RecordAIActionBody | RecordWeeklyDigestBody;

export async function POST(request: Request) {
  let body: PostBody;

  try {
    body = (await request.json()) as PostBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const { accountId: authedAccountId } = await getAuthenticatedAccount();
  const accountId = authedAccountId ?? DEMO_ACCOUNT_ID;
  const isRealAccount = Boolean(authedAccountId);

  switch (body.action) {
    case "recordImport": {
      if (
        typeof body.invoiceCount !== "number" ||
        typeof body.activeInvoiceCount !== "number"
      ) {
        return NextResponse.json(
          { error: "invoiceCount and activeInvoiceCount are required." },
          { status: 400 },
        );
      }
      const result = recordImport(accountId, {
        fileName: body.fileName ?? "unknown",
        invoiceCount: body.invoiceCount,
        activeInvoiceCount: body.activeInvoiceCount,
      });
      if (isRealAccount) {
        await Promise.all([
          writeUsageEvent(accountId, "import", 1, {
            fileName: body.fileName,
            invoiceCount: body.invoiceCount,
            activeInvoiceCount: body.activeInvoiceCount,
          }),
          updateUsageRollup(accountId, { active_invoice_count: body.activeInvoiceCount }),
        ]);
      }
      return NextResponse.json(result);
    }

    case "recordAIAction": {
      if (!body.actionType) {
        return NextResponse.json({ error: "actionType is required." }, { status: 400 });
      }
      const result = recordAIAction(accountId, body.actionType);
      if (isRealAccount) {
        await writeUsageEvent(accountId, "aiAction", 1, { actionType: body.actionType });
      }
      return NextResponse.json(result);
    }

    case "recordWeeklyDigest": {
      incrementUsage(accountId, "weeklyDigest", 1);
      if (isRealAccount) {
        await writeUsageEvent(accountId, "weeklyDigest", 1);
      }
      return NextResponse.json({ recorded: true });
    }

    default:
      return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  }
}
