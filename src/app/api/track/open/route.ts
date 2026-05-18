/**
 * GET /api/track/open?m={messageId}&a={accountId}
 *
 * Audit §14: tracking pixel served on chase emails so we can record
 * an "opened" event. Returns a 1×1 transparent GIF either way — the
 * request always succeeds so email rendering isn't disrupted.
 *
 * Implementation notes:
 *  - Cache: never. Email clients must hit the route each open.
 *  - Auth: none required (emails are sent to people who don't have
 *    accounts). The messageId acts as the capability token.
 *  - Storage: writes to zentra_email_events if Supabase is configured;
 *    falls back to a no-op silently in demo mode.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// 1×1 transparent GIF — base64 decoded into a Buffer once per cold start.
const PIXEL_BASE64 = "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
const PIXEL = Buffer.from(PIXEL_BASE64, "base64");

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const messageId = url.searchParams.get("m");
  const accountId = url.searchParams.get("a");

  // Fire-and-forget — don't block pixel response on Supabase write.
  if (messageId && accountId) {
    const admin = getAdmin();
    if (admin) {
      void admin
        .from("zentra_email_events")
        .insert({
          message_id: messageId,
          account_id: accountId,
          event_type: "open",
          user_agent: req.headers.get("user-agent") ?? null,
        })
        .then(() => undefined)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .then(undefined, (err: any) => {
          // Table may not exist yet — silently swallow.
          console.warn("[track/open] insert failed", err?.message);
        });
    }
  }

  return new NextResponse(PIXEL, {
    status: 200,
    headers: {
      "Content-Type": "image/gif",
      "Content-Length": PIXEL.length.toString(),
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      "Pragma": "no-cache",
    },
  });
}
