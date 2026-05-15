/**
 * POST /api/push/subscribe
 *
 * Saves or updates a Web Push subscription for the authenticated user.
 * Called from the client after the browser grants notification permission.
 *
 * Body: {
 *   endpoint: string;
 *   keys: { p256dh: string; auth: string };
 *   userAgent?: string;
 * }
 *
 * DELETE /api/push/subscribe
 *
 * Removes a subscription by endpoint (user unsubscribed or revoked permission).
 *
 * Body: { endpoint: string }
 */

import { NextResponse } from "next/server";
import {
  createSupabaseServerClient,
  hasSupabaseServerConfig,
} from "@/lib/supabase/server";

// ── POST ───────────────────────────────────────────────────────────────────────

type SubscribeBody = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  userAgent?: string;
};

export async function POST(request: Request) {
  if (!hasSupabaseServerConfig()) {
    return NextResponse.json({ error: "Not configured." }, { status: 503 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  }

  // Resolve the account_id from membership table
  const { data: member } = await supabase
    .from("zentra_account_members")
    .select("account_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle<{ account_id: string }>();

  if (!member?.account_id) {
    return NextResponse.json({ error: "Account not found." }, { status: 404 });
  }

  let body: SubscribeBody;
  try {
    body = (await request.json()) as SubscribeBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  if (!body.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
    return NextResponse.json(
      { error: "endpoint, keys.p256dh, and keys.auth are required." },
      { status: 400 },
    );
  }

  // Upsert — if the endpoint already exists for this account, update the keys
  // (browsers rotate keys after certain events).
  const { error: upsertError } = await supabase
    .from("zentra_push_subscriptions")
    .upsert(
      {
        account_id: member.account_id,
        user_id: user.id,
        endpoint: body.endpoint,
        p256dh: body.keys.p256dh,
        auth: body.keys.auth,
        user_agent: body.userAgent ?? null,
      },
      { onConflict: "account_id,endpoint" },
    );

  if (upsertError) {
    console.error("[push/subscribe] upsert error:", upsertError);
    return NextResponse.json({ error: "Failed to save subscription." }, { status: 500 });
  }

  return NextResponse.json({ subscribed: true });
}

// ── DELETE ─────────────────────────────────────────────────────────────────────

type UnsubscribeBody = { endpoint: string };

export async function DELETE(request: Request) {
  if (!hasSupabaseServerConfig()) {
    return NextResponse.json({ error: "Not configured." }, { status: 503 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  }

  let body: UnsubscribeBody;
  try {
    body = (await request.json()) as UnsubscribeBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  if (!body.endpoint) {
    return NextResponse.json({ error: "endpoint is required." }, { status: 400 });
  }

  await supabase
    .from("zentra_push_subscriptions")
    .delete()
    .eq("user_id", user.id)
    .eq("endpoint", body.endpoint);

  return NextResponse.json({ unsubscribed: true });
}
