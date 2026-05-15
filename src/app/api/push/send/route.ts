/**
 * POST /api/push/send
 *
 * Internal endpoint for sending push notifications.
 * Can be called:
 *   - By Vercel Cron (morning digest, escalation sweep)
 *   - By server-side actions after import completes
 *   - By admin tooling
 *
 * Protected by CRON_SECRET (set in Vercel env vars).
 * In development, the secret check is skipped when NODE_ENV=development.
 *
 * Body: {
 *   type: "digest" | "escalation" | "import_complete" | "custom";
 *   accountId?: string;           // target specific account; omit for all
 *   payload?: NotificationPayload; // for "custom" type
 * }
 *
 * NotificationPayload: {
 *   title: string;
 *   body: string;
 *   url?: string;
 *   tag?: string;
 *   requireInteraction?: boolean;
 * }
 */

import { NextResponse } from "next/server";
import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

// ── VAPID configuration ────────────────────────────────────────────────────────

const VAPID_PUBLIC_KEY  = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT     = process.env.VAPID_SUBJECT ?? "mailto:hello@zentracollect.co.uk";

function isVapidConfigured(): boolean {
  return Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);
}

function initWebPush() {
  if (!isVapidConfigured()) return;
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY!, VAPID_PRIVATE_KEY!);
}

// ── Supabase service role client (bypasses RLS to read all subscriptions) ──────

function getServiceClient() {
  const url  = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key  = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase service role not configured.");
  return createClient(url, key);
}

// ── Canned notification payloads ───────────────────────────────────────────────

type NotificationPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  requireInteraction?: boolean;
};

function buildPayload(type: string, customPayload?: NotificationPayload): NotificationPayload {
  switch (type) {
    case "digest":
      return {
        title: "Zentra Collect — Morning digest",
        body: "Your chase plan is ready. See who to contact today.",
        url: "/chase-plan",
        tag: "zentra-digest",
      };

    case "escalation":
      return {
        title: "⚠️ Escalation alert",
        body: "One or more invoices have exceeded 90 days. Review now.",
        url: "/chase-plan",
        tag: "zentra-escalation",
        requireInteraction: true,
      };

    case "import_complete":
      return {
        title: "Import complete",
        body: "Your invoices have been ranked. Your chase plan is ready.",
        url: "/chase-plan",
        tag: "zentra-import",
      };

    case "custom":
      if (!customPayload) throw new Error("customPayload is required for type=custom.");
      return customPayload;

    default:
      throw new Error(`Unknown notification type: ${type}`);
  }
}

// ── Subscription type ──────────────────────────────────────────────────────────

type PushSubscriptionRow = {
  id: string;
  account_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  notify_digest: boolean;
  notify_escalations: boolean;
  notify_import_complete: boolean;
};

// ── Send to a single subscription ─────────────────────────────────────────────

async function sendToSubscription(
  sub: PushSubscriptionRow,
  payload: NotificationPayload,
  supabase: ReturnType<typeof getServiceClient>,
): Promise<{ ok: boolean; gone?: boolean }> {
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload),
      { TTL: 86400 }, // 24-hour TTL
    );
    return { ok: true };
  } catch (err: unknown) {
    const statusCode = (err as { statusCode?: number }).statusCode;
    if (statusCode === 410 || statusCode === 404) {
      // Subscription expired — remove it from DB
      await supabase
        .from("zentra_push_subscriptions")
        .delete()
        .eq("id", sub.id);
      return { ok: false, gone: true };
    }
    console.error("[push/send] sendNotification error:", err);
    return { ok: false };
  }
}

// ── Shared send logic ──────────────────────────────────────────────────────────

async function sendByType(
  type: string,
  accountId: string | null,
  customPayload: NotificationPayload | undefined,
  authHeader: string | null,
): Promise<Response> {
  const cronSecret = process.env.CRON_SECRET;
  const isDev = process.env.NODE_ENV === "development";

  if (!isDev && cronSecret) {
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
    }
  }

  if (!isVapidConfigured()) {
    return NextResponse.json(
      { error: "VAPID keys not configured. Run scripts/generate-vapid-keys.mjs and set env vars." },
      { status: 503 },
    );
  }

  initWebPush();

  let payload: NotificationPayload;
  try {
    payload = buildPayload(type, customPayload);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }

  const supabase = getServiceClient();

  const prefColumn =
    type === "digest"           ? "notify_digest"
    : type === "escalation"    ? "notify_escalations"
    : type === "import_complete" ? "notify_import_complete"
    : null;

  let query = supabase
    .from("zentra_push_subscriptions")
    .select("id, account_id, endpoint, p256dh, auth, notify_digest, notify_escalations, notify_import_complete");

  if (accountId) query = query.eq("account_id", accountId);
  if (prefColumn) query = query.eq(prefColumn, true);

  const { data: subscriptions, error: fetchError } = await query;

  if (fetchError) {
    console.error("[push/send] fetch error:", fetchError);
    return NextResponse.json({ error: "Failed to fetch subscriptions." }, { status: 500 });
  }

  if (!subscriptions || subscriptions.length === 0) {
    return NextResponse.json({ sent: 0, gone: 0, failed: 0 });
  }

  const results = await Promise.allSettled(
    (subscriptions as PushSubscriptionRow[]).map((sub) =>
      sendToSubscription(sub, payload, supabase),
    ),
  );

  let sent = 0, gone = 0, failed = 0;
  for (const result of results) {
    if (result.status === "fulfilled") {
      if (result.value.ok)   sent++;
      if (result.value.gone) gone++;
      if (!result.value.ok && !result.value.gone) failed++;
    } else failed++;
  }

  return NextResponse.json({ sent, gone, failed });
}

// ── GET handler — for Vercel Cron (fires GET requests) ────────────────────────

export async function GET(request: Request) {
  const url = new URL(request.url);
  const type = url.searchParams.get("type") ?? "digest";
  const accountId = url.searchParams.get("accountId");
  return sendByType(type, accountId, undefined, request.headers.get("authorization"));
}

// ── POST handler ───────────────────────────────────────────────────────────────

type SendBody = {
  type: "digest" | "escalation" | "import_complete" | "custom";
  accountId?: string;
  payload?: NotificationPayload;
};

export async function POST(request: Request) {
  let body: SendBody;
  try {
    body = (await request.json()) as SendBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  return sendByType(
    body.type,
    body.accountId ?? null,
    body.payload,
    request.headers.get("authorization"),
  );
}
