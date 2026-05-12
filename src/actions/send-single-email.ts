"use server";

/**
 * src/actions/send-single-email.ts
 *
 * Server action: send a single chase email directly from the drawer.
 *
 * Reads the account's stored SMTP settings from zentra_email_settings,
 * decrypts the password, and sends via nodemailer.
 *
 * In demo / no-Supabase mode it returns { ok: true, simulated: true }
 * so the UI can show a "sent" confirmation without needing real SMTP.
 */

import { createSupabaseServerClient as createServerClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/smtp";
import { decryptPassword } from "@/lib/email/crypto";

export interface SendSingleEmailInput {
  to:          string;
  subject:     string;
  bodyText:    string;
  invoiceRef:  string;
  clientName:  string;
}

export interface SendSingleEmailResult {
  ok:         boolean;
  simulated?: boolean;
  error?:     string;
}

function isConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

export async function sendSingleEmail(
  input: SendSingleEmailInput,
): Promise<SendSingleEmailResult> {
  // Basic validation
  if (!input.to.includes("@")) {
    return { ok: false, error: "Invalid email address." };
  }
  if (!input.subject.trim()) {
    return { ok: false, error: "Subject is required." };
  }
  if (!input.bodyText.trim()) {
    return { ok: false, error: "Message body is required." };
  }

  // Demo / unconfigured mode — simulate a send
  if (!isConfigured()) {
    return { ok: true, simulated: true };
  }

  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Not authenticated." };

    // Get the account id
    const { data: account } = await supabase
      .from("zentra_accounts")
      .select("id")
      .eq("owner_id", user.id)
      .maybeSingle();

    if (!account) return { ok: false, error: "No account found." };

    // Load SMTP settings
    const { data: settings } = await supabase
      .from("zentra_email_settings")
      .select("smtp_host, smtp_port, smtp_user, smtp_password_enc, from_name")
      .eq("account_id", account.id)
      .maybeSingle();

    if (!settings || !settings.smtp_user || !settings.smtp_password_enc) {
      return {
        ok: false,
        error:
          "SMTP not configured. Go to Settings → Email to add your credentials.",
      };
    }

    const password = decryptPassword(settings.smtp_password_enc);
    if (!password) {
      return { ok: false, error: "Could not decrypt SMTP password. Re-save your email settings." };
    }

    const config = {
      host:     settings.smtp_host,
      port:     settings.smtp_port ?? 587,
      user:     settings.smtp_user,
      password,
      fromName: settings.from_name ?? "Zentra Flow",
    };

    // Simple plain-text → HTML wrapper
    const bodyHtml = `<pre style="font-family:sans-serif;white-space:pre-wrap;line-height:1.6">${input.bodyText
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")}</pre>`;

    const result = await sendEmail(
      config,
      input.to,
      input.subject,
      bodyHtml,
      input.bodyText,
    );

    if (!result.ok) return { ok: false, error: result.error };
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
