/**
 * GET /api/track/click?m={messageId}&a={accountId}&u={base64-url}
 *
 * Audit §14: link-redirect tracker. The chase email's payment-portal
 * link is rewritten through this route; we record the click and 302
 * to the original URL.
 *
 * The `u` parameter is base64url-encoded to avoid double-encoding
 * issues and to make tracking links visually opaque.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const ALLOWED_HOSTS = new Set([
  "zentracollect.co.uk",
  "www.zentracollect.co.uk",
]);

function decodeBase64Url(input: string): string {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/")
    + "=".repeat((4 - (input.length % 4)) % 4);
  return Buffer.from(padded, "base64").toString("utf-8");
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const messageId = url.searchParams.get("m");
  const accountId = url.searchParams.get("a");
  const encoded   = url.searchParams.get("u") ?? "";

  // Decode & validate destination. We only allow same-origin redirects
  // to prevent open-redirect abuse.
  let dest: URL;
  try {
    dest = new URL(decodeBase64Url(encoded));
  } catch {
    return NextResponse.json({ error: "Invalid destination." }, { status: 400 });
  }
  if (!ALLOWED_HOSTS.has(dest.hostname)) {
    return NextResponse.json({ error: "Destination not allowed." }, { status: 400 });
  }

  if (messageId && accountId) {
    const admin = getAdmin();
    if (admin) {
      void admin
        .from("zentra_email_events")
        .insert({
          message_id: messageId,
          account_id: accountId,
          event_type: "click",
          destination_url: dest.toString().slice(0, 1000),
          user_agent: req.headers.get("user-agent") ?? null,
        })
        .then(() => undefined)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .then(undefined, (err: any) => {
          console.warn("[track/click] insert failed", err?.message);
        });
    }
  }

  return NextResponse.redirect(dest.toString(), 302);
}
