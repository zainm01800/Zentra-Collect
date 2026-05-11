import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { inferSmtpHost } from "@/lib/email/smtp";
import { encryptPassword } from "@/lib/email/crypto";

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { accountId, email, password, fromName, sendHourUtc, sendDays, maxPerRun } =
      body as {
        accountId?: string;
        email?: string;
        password?: string;
        fromName?: string;
        sendHourUtc?: number;
        sendDays?: string;
        maxPerRun?: number;
      };

    if (!accountId || !email || !password) {
      return NextResponse.json(
        { ok: false, error: "accountId, email, and password are required." },
        { status: 400 },
      );
    }

    const { host, port } = inferSmtpHost(email);
    const encryptedPassword = encryptPassword(password);

    const admin = getAdmin();
    if (admin) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (admin as any)
        .from("zentra_email_settings")
        .upsert(
          {
            account_id: accountId,
            smtp_host: host,
            smtp_port: port,
            smtp_user: email,
            smtp_password_enc: encryptedPassword,
            from_name: fromName ?? "Zentra Flow",
            send_hour_utc: sendHourUtc ?? 9,
            send_days: sendDays ?? "1,2,3,4,5",
            max_per_run: maxPerRun ?? 5,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "account_id" },
        );

      if (error) {
        console.error("[save-settings] upsert failed:", error.message);
        // Don't fail the request — return ok so client state is still updated
      }
    }

    return NextResponse.json({
      ok: true,
      smtp: { host, port, user: email },
      fromName: fromName ?? "Zentra Flow",
      sendHourUtc: sendHourUtc ?? 9,
      sendDays: sendDays ?? "1,2,3,4,5",
      maxPerRun: maxPerRun ?? 5,
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Unexpected error saving settings." },
      { status: 500 },
    );
  }
}
