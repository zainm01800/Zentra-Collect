/**
 * /api/usage
 *
 * REST bridge between client-side components and the server-side usage store.
 * Client components (import flow, digest page) that need to record usage
 * call POST here. The settings page calls GET to display meters.
 *
 * GET  /api/usage          → UsageSnapshot for the demo account
 * POST /api/usage          → Record a client-side usage event
 *
 * TODO: Extract accountId from the authenticated session rather than
 *   defaulting to DEMO_ACCOUNT_ID.
 * TODO: Add rate limiting — recording should require a valid session token,
 *   not be open to arbitrary POST requests.
 */

import { NextResponse } from "next/server";
import {
  DEMO_ACCOUNT_ID,
  getUsageSnapshot,
  recordImport,
  incrementUsage,
} from "@/lib/usage/store";
import type { AIActionType } from "@/lib/usage/tracker";

// Force dynamic — snapshot reflects live counter state
export const dynamic = "force-dynamic";

// ── GET — return current snapshot ─────────────────────────────────────────────

export async function GET() {
  // TODO: const accountId = await getAccountIdFromSession(request);
  const snapshot = getUsageSnapshot(DEMO_ACCOUNT_ID);
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

  // TODO: const accountId = await getAccountIdFromSession(request);
  const accountId = DEMO_ACCOUNT_ID;

  switch (body.action) {
    case "recordImport": {
      if (typeof body.invoiceCount !== "number" || typeof body.activeInvoiceCount !== "number") {
        return NextResponse.json({ error: "invoiceCount and activeInvoiceCount are required." }, { status: 400 });
      }
      const result = recordImport(accountId, {
        fileName: body.fileName ?? "unknown",
        invoiceCount: body.invoiceCount,
        activeInvoiceCount: body.activeInvoiceCount,
      });
      return NextResponse.json(result);
    }

    case "recordAIAction": {
      // Client-side AI action recording (for future use — current AI calls
      // are recorded directly in the server-side API routes).
      if (!body.actionType) {
        return NextResponse.json({ error: "actionType is required." }, { status: 400 });
      }
      incrementUsage(accountId, "aiAction", 1);
      return NextResponse.json({ recorded: true });
    }

    case "recordWeeklyDigest": {
      incrementUsage(accountId, "weeklyDigest", 1);
      return NextResponse.json({ recorded: true });
    }

    default:
      return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  }
}
