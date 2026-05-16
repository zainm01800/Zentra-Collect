/**
 * POST /api/digest/send
 *
 * Sends the AI-narrated weekly digest to the signed-in user's own email
 * address using their stored SMTP credentials. Requires:
 *   - The user has configured SMTP via Settings → Email
 *   - Supabase is configured (for credential storage)
 *
 * Body: { narrated: NarratedDigest, brief?: WeeklyDigestBrief, recipientName?: string }
 *
 * Returns: { ok: true } or { ok: false, error, code }
 *   where code ∈ "not_signed_in" | "no_smtp" | "send_failed" | "supabase_unavailable"
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  renderDigestEmailHtml,
  renderDigestEmailText,
  type NarratedDigest,
} from "@/lib/ai/weekly-digest-narration";
import { decryptPassword } from "@/lib/email/crypto";
import { sendEmail, type SmtpConfig } from "@/lib/email/smtp";
import { checkRateLimit } from "@/lib/server/rate-limit";

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

interface SendRequest {
  narrated:      NarratedDigest;
  recipientName?: string;
}

export async function POST(request: Request) {
  const rateLimit = checkRateLimit(request, {
    namespace: "digest-send",
    limit: 5,
    windowMs: 60_000 * 60, // 5 sends / hour — generous but bounded
  });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { ok: false, error: "Too many digest emails sent. Try again in an hour.", code: "rate_limited" },
      { status: 429 },
    );
  }

  let body: SendRequest;
  try {
    body = (await request.json()) as SendRequest;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.narrated?.subject) {
    return NextResponse.json(
      { ok: false, error: "narrated digest is required" },
      { status: 400 },
    );
  }

  const admin = getAdmin();
  if (!admin) {
    return NextResponse.json(
      {
        ok: false,
        code: "supabase_unavailable",
        error: "Email settings are stored server-side — Supabase isn't configured on this deploy.",
      },
      { status: 503 },
    );
  }

  // ── Load most recent email settings row ──────────────────────────────────
  // (we don't have full user auth here yet — for an MVP we read the most-
  // recently-saved settings row. Once auth is fully wired this will scope
  // to the signed-in account_id.)
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: settings, error: settingsError } = await (admin as any)
      .from("zentra_email_settings")
      .select("email, encrypted_password, smtp_host, smtp_port, from_name")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (settingsError || !settings || !settings.email || !settings.encrypted_password) {
      return NextResponse.json(
        {
          ok:    false,
          code:  "no_smtp",
          error:
            "You haven't connected an email account yet. Settings → Email → set up outbound email, then try again.",
        },
        { status: 412 },
      );
    }

    const config: SmtpConfig = {
      host:     settings.smtp_host,
      port:     settings.smtp_port,
      user:     settings.email,
      password: decryptPassword(settings.encrypted_password),
      fromName: settings.from_name || "Zentra Collect",
    };

    const html = renderDigestEmailHtml(body.narrated, config.fromName);
    const text = renderDigestEmailText(body.narrated);

    const result = await sendEmail(config, settings.email, body.narrated.subject, html, text);
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, code: "send_failed", error: result.error },
        { status: 502 },
      );
    }

    return NextResponse.json({ ok: true, messageId: result.messageId });
  } catch (err) {
    console.error("[digest/send]", err);
    return NextResponse.json(
      {
        ok:    false,
        code:  "send_failed",
        error: err instanceof Error ? err.message : "Unexpected server error.",
      },
      { status: 500 },
    );
  }
}
