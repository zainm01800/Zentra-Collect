/**
 * POST /api/auth/trial-check
 *
 * Server-side gate before a trial signup proceeds.
 * Checks (in order, fail-fast):
 *  1. Body shape — email + businessName present
 *  2. Per-IP rate limit (5 attempts / hour) — in-memory, OK for serverless
 *  3. Disposable / temporary email domain
 *  4. This email hasn't started a trial in the last 30 days (Supabase)
 *  5. This IP hash hasn't started > 3 trials in the last 30 days (Supabase)
 *
 * On pass, the signup is recorded in `public.trial_signup_history`.
 *
 * Returns: { allowed: boolean, reason?: string }
 *
 * Production hardening to add later:
 *  - Cloudflare Turnstile / hCaptcha token validation
 *  - Email verification *required* before counting against the limit
 */

import { NextResponse } from "next/server";
import {
  hashIp,
  hasRecentTrialForEmail,
  hasRecentTrialForIp,
  isDisposableEmailDomain,
  rateLimit,
  recordTrialSignup,
} from "@/lib/anti-abuse";

export async function POST(req: Request) {
  let body: { email?: string; businessName?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { allowed: false, reason: "Invalid request body." },
      { status: 400 },
    );
  }

  const email = (body.email ?? "").trim().toLowerCase();
  const businessName = (body.businessName ?? "").trim();

  if (!email || !email.includes("@")) {
    return NextResponse.json(
      { allowed: false, reason: "A valid email is required." },
      { status: 400 },
    );
  }

  if (!businessName) {
    return NextResponse.json(
      { allowed: false, reason: "Business name is required." },
      { status: 400 },
    );
  }

  // Resolve client IP. Vercel/most reverse proxies populate x-forwarded-for.
  const fwd = req.headers.get("x-forwarded-for") ?? "";
  const ip = fwd.split(",")[0]?.trim() || "unknown";
  const ipHash = hashIp(ip);

  // Hard rate limit on the endpoint itself: 5 attempts per IP per hour
  const limit = rateLimit(`trial-check:${ipHash}`, 5, 60 * 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json(
      {
        allowed: false,
        reason: "Too many signup attempts from this network. Try again in an hour or contact support.",
      },
      { status: 429 },
    );
  }

  // Disposable / temporary email blocklist
  if (isDisposableEmailDomain(email)) {
    return NextResponse.json(
      {
        allowed: false,
        reason: "Please use a real business email — disposable / temporary addresses aren't accepted for trials.",
      },
      { status: 403 },
    );
  }

  // One trial per email in the last 30 days (Supabase-backed)
  if (await hasRecentTrialForEmail(email)) {
    return NextResponse.json(
      {
        allowed: false,
        reason: "A trial has already been started with this email recently. Sign in instead, or contact support if you need a new trial.",
      },
      { status: 403 },
    );
  }

  // Max 3 trials per IP in the last 30 days (Supabase-backed)
  if (await hasRecentTrialForIp(ipHash)) {
    return NextResponse.json(
      {
        allowed: false,
        reason: "Trial limit reached for this network. Contact support if you need access.",
      },
      { status: 403 },
    );
  }

  // All checks pass — persist the signup (Supabase or in-memory fallback)
  await recordTrialSignup(email, ipHash, {
    businessName,
    userAgent: req.headers.get("user-agent") ?? undefined,
  });

  return NextResponse.json({ allowed: true });
}
