/**
 * GET  /api/email/inbound-settings  — load current inbound config for this account
 * POST /api/email/inbound-settings  — save inbound config (IMAP or forward toggle)
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient, hasSupabaseServerConfig } from "@/lib/supabase/server";
import { encryptPassword } from "@/lib/email/crypto";
import { inferImapHost } from "@/lib/inbound-email/imap-poller";
import { buildInboundAddress } from "@/lib/inbound-email/address";

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function resolveAccountId(req: NextRequest): Promise<string | null> {
  if (!hasSupabaseServerConfig()) return "local";
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("zentra_account_members")
    .select("account_id")
    .eq("user_id", user.id)
    .maybeSingle();
  return data?.account_id ?? null;
}

export async function GET(req: NextRequest) {
  const accountId = await resolveAccountId(req);
  if (!accountId) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const admin = getAdmin();
  if (!admin) {
    return NextResponse.json({ configured: false, forwardAddress: null });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (admin as any)
    .from("zentra_inbound_settings")
    .select("inbound_token, forward_enabled, imap_enabled, imap_email, imap_host, imap_port, imap_tls, imap_last_polled_at")
    .eq("account_id", accountId)
    .maybeSingle();

  if (!data) {
    return NextResponse.json({ configured: false, forwardAddress: null });
  }

  return NextResponse.json({
    configured: data.imap_enabled || data.forward_enabled,
    forwardAddress: data.inbound_token ? buildInboundAddress(data.inbound_token) : null,
    forwardEnabled: data.forward_enabled ?? false,
    imapEnabled: data.imap_enabled ?? false,
    imapEmail: data.imap_email ?? null,
    imapHost: data.imap_host ?? null,
    imapPort: data.imap_port ?? 993,
    imapLastPolledAt: data.imap_last_polled_at ?? null,
  });
}

export async function POST(req: NextRequest) {
  const accountId = await resolveAccountId(req);
  if (!accountId) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const body = await req.json() as {
    method: "imap" | "forward" | "disable_imap" | "disable_forward";
    imapEmail?: string;
    imapPassword?: string; // plaintext — encrypted before storage
  };

  const admin = getAdmin();
  if (!admin) {
    return NextResponse.json({ ok: true, note: "No DB configured — settings not persisted." });
  }

  if (body.method === "imap") {
    if (!body.imapEmail || !body.imapPassword) {
      return NextResponse.json({ error: "Email and password required." }, { status: 400 });
    }
    const { host, port, tls } = inferImapHost(body.imapEmail);
    const encPw = encryptPassword(body.imapPassword);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (admin as any)
      .from("zentra_inbound_settings")
      .upsert({
        account_id: accountId,
        imap_enabled: true,
        imap_email: body.imapEmail,
        imap_host: host,
        imap_port: port,
        imap_tls: tls,
        imap_password_enc: encPw,
        updated_at: new Date().toISOString(),
      }, { onConflict: "account_id" });

    if (error) {
      console.error("[inbound-settings] imap upsert failed:", error.message);
      return NextResponse.json({ error: "Failed to save settings." }, { status: 500 });
    }
    return NextResponse.json({ ok: true, method: "imap", host, port });
  }

  if (body.method === "forward") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (admin as any)
      .from("zentra_inbound_settings")
      .upsert({
        account_id: accountId,
        forward_enabled: true,
        updated_at: new Date().toISOString(),
      }, { onConflict: "account_id" });

    if (error) return NextResponse.json({ error: "Failed to save settings." }, { status: 500 });
    return NextResponse.json({ ok: true, method: "forward" });
  }

  if (body.method === "disable_imap") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin as any)
      .from("zentra_inbound_settings")
      .upsert({ account_id: accountId, imap_enabled: false, updated_at: new Date().toISOString() }, { onConflict: "account_id" });
    return NextResponse.json({ ok: true });
  }

  if (body.method === "disable_forward") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin as any)
      .from("zentra_inbound_settings")
      .upsert({ account_id: accountId, forward_enabled: false, updated_at: new Date().toISOString() }, { onConflict: "account_id" });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown method." }, { status: 400 });
}
