"use server";

/**
 * src/actions/trader-waitlist.ts
 *
 * Captures email signups for the Trader £5/mo waitlist.
 *
 * Persistence:
 *   - When Supabase is configured, writes to zentra_trader_waitlist (table
 *     creation is a follow-up migration; if the table doesn't exist the
 *     insert fails and we log it server-side without surfacing a 500 to
 *     the user).
 *   - When Supabase isn't configured (dev / preview), logs to the server
 *     console so we don't lose signups during early validation.
 *
 * Rate limited per IP via the existing checkRateLimit helper to keep
 * spam down.
 */

import { headers } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { checkRateLimit } from "@/lib/server/rate-limit";

interface JoinInput {
  email: string;
}

export type JoinResult =
  | { ok: true }
  | { ok: false; error: string };

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function joinTraderWaitlistAction(input: JoinInput): Promise<JoinResult> {
  const email = (input.email ?? "").trim().toLowerCase();
  if (!email.includes("@") || email.length > 254) {
    return { ok: false, error: "Please enter a valid email address." };
  }

  // ── Rate limit per IP: 3 sign-ups / 10 minutes ──────────────────────────
  const headerStore = await headers();
  const fakeRequest = new Request("https://zentracollect.co.uk/", {
    headers: headerStore,
  });
  const rate = checkRateLimit(fakeRequest, {
    namespace: "trader-waitlist",
    limit:     3,
    windowMs:  10 * 60_000,
  });
  if (!rate.allowed) {
    return { ok: false, error: "Too many sign-ups from this network. Try again in a few minutes." };
  }

  const admin = getAdmin();
  if (!admin) {
    // Dev / preview fallback — don't lose the signup during early validation.
    console.info("[trader-waitlist] (no supabase) would save:", email);
    return { ok: true };
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (admin as any)
      .from("zentra_trader_waitlist")
      .insert({ email });

    if (error) {
      // Unique-violation = already signed up; treat as success
      if ((error as { code?: string }).code === "23505") {
        return { ok: true };
      }
      console.error("[trader-waitlist] insert failed:", error);
      // Even if insert failed (e.g. table doesn't exist yet), don't show
      // a scary error to the user — log it server-side and return ok so
      // we don't leak infra state.
      return { ok: true };
    }
  } catch (err) {
    console.error("[trader-waitlist]", err);
    return { ok: true };
  }

  return { ok: true };
}
