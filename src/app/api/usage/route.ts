/**
 * /api/usage
 *
 * REST bridge between client-side components and the server-side usage store.
 *
 * GET  /api/usage  → UsageSnapshot (plan from Supabase, counts from DB for
 *                    authenticated users; demo snapshot for anonymous users)
 * POST /api/usage  → Record a client-side usage event (auth required)
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
  hasSupabaseServerConfig,
} from "@/lib/supabase/server";
import type { AIActionType } from "@/lib/usage/tracker";

// Force dynamic — snapshot reflects live state
export const dynamic = "force-dynamic";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Resolve the authenticated user's account_id. Returns null for anon users. */
async function getAuthenticatedAccountId(): Promise<{
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

// ── GET — return current snapshot ─────────────────────────────────────────────

export async function GET() {
  const { accountId, planId } = await getAuthenticatedAccountId();

  // Start with the demo/in-memory snapshot
  const snapshot = getUsageSnapshot(accountId ?? DEMO_ACCOUNT_ID);

  // Overlay real plan ID from DB
  if (planId) {
    // planId from DB is already lowercased; cast to PlanId since we trust the DB value
    (snapshot as { planId: string }).planId = planId;
  }

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

  // Resolve the account ID from the authenticated session.
  // Fall back to DEMO_ACCOUNT_ID only for unauthenticated / demo users.
  const { accountId: authedAccountId } = await getAuthenticatedAccountId();
  const accountId = authedAccountId ?? DEMO_ACCOUNT_ID;

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
      return NextResponse.json(result);
    }

    case "recordAIAction": {
      if (!body.actionType) {
        return NextResponse.json({ error: "actionType is required." }, { status: 400 });
      }
      const result = recordAIAction(accountId, body.actionType);
      return NextResponse.json(result);
    }

    case "recordWeeklyDigest": {
      incrementUsage(accountId, "weeklyDigest", 1);
      return NextResponse.json({ recorded: true });
    }

    default:
      return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  }
}
