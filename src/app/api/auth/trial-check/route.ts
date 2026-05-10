/**
 * POST /api/auth/trial-check
 *
 * Server-side gate before a trial signup proceeds.
 * Checks:
 *  - email is not on the disposable-domain blocklist
 *  - this email hasn't started a trial in the last 30 days
 *  - this IP hasn't started > 3 trials in the last 30 days
 *  - signup attempts are rate-limited (5 per IP per hour)
 *
 * Returns: { allowed: boolean, reason?: string }
 *
 * Production hardening to add later:
 *  - Cloudflare Turnstile / hCaptcha token validation
 *  - Persist trial history to Supabase (currently in-memory)
 *  - Email verification before activation (Supabase already supports)
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

  // One trial per email in the last 30 days
  if (hasRecentTrialForEmail(email)) {
    return NextResponse.json(
      {
        allowed: false,
        reason: "A trial has already been started with this email recently. Sign in instead, or contact support if you need a new trial.",
      },
      { status: 403 },
    );
  }

  // Max 3 trials per IP in the last 30 days
  if (hasRecentTrialForIp(ipHash)) {
    return NextResponse.json(
      {
        allowed: false,
        reason: "Trial limit reached for this network. Contact support if you need access.",
      },
      { status: 403 },
    );
  }

  // All checks pass — record the trial start
  recordTrialSignup(email, ipHash);

  return NextResponse.json({ allowed: true });
}
