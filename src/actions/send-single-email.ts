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
 *
 * Outbound emails are instrumented with:
 *   - a 1x1 tracking pixel (open events)
 *   - per-link redirect rewriter (click events)
 * Both flow into zentra_email_events via /api/track/{open,click}.
 */

import { randomUUID } from "crypto";
import { createSupabaseServerClient as createServerClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/smtp";
import { decryptPassword } from "@/lib/email/crypto";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://zentracollect.co.uk";

/**
 * Replace plain zentracollect URLs in the HTML body with tracked
 * redirects through /api/track/click. Only rewrites our own domain
 * (open-redirect protection handled server-side too).
 */
function rewriteLinksForTracking(html: string, messageId: string, accountId: string): string {
  return html.replace(
    /href="(https?:\/\/(?:www\.)?zentracollect\.co\.uk[^"]*)"/gi,
    (_match, url: string) => {
      const encoded = Buffer.from(url, "utf-8")
        .toString("base64")
        .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
      const tracked =
        `${SITE_URL}/api/track/click?m=${encodeURIComponent(messageId)}` +
        `&a=${encodeURIComponent(accountId)}&u=${encoded}`;
      return `href="${tracked}"`;
    },
  );
}

/** 1x1 tracking pixel appended to the HTML body. */
function trackingPixelHtml(messageId: string, accountId: string): string {
  const src =
    `${SITE_URL}/api/track/open?m=${encodeURIComponent(messageId)}` +
    `&a=${encodeURIComponent(accountId)}`;
  return `<img src="${src}" alt="" width="1" height="1" style="display:block;width:1px;height:1px;border:0;outline:none" />`;
}

export interface OutstandingInvoice {
  invoiceNumber?: string;
  dueDate?:       string;
  amountOutstanding: number;
  daysOverdue?:   number;
}

export interface SendSingleEmailInput {
  to:                   string;
  subject:              string;
  bodyText:             string;
  invoiceRef:           string;
  clientName:           string;
  outstandingInvoices?: OutstandingInvoice[];
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
    const accountId = account.id as string;
    const messageId = randomUUID();

    // Load SMTP settings and business reply-to email in parallel
    const [{ data: settings }, { data: business }] = await Promise.all([
      supabase
        .from("zentra_email_settings")
        .select("smtp_host, smtp_port, smtp_user, smtp_password_enc, from_name")
        .eq("account_id", accountId)
        .maybeSingle(),
      supabase
        .from("zentra_businesses")
        .select("reply_to_email, contact_email")
        .eq("account_id", accountId)
        .maybeSingle(),
    ]);

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

    // reply_to_email takes priority; fall back to contact_email; fall back to the SMTP from address
    const replyTo = business?.reply_to_email || business?.contact_email || undefined;

    const config = {
      host:     settings.smtp_host,
      port:     settings.smtp_port ?? 587,
      user:     settings.smtp_user,
      password,
      fromName: settings.from_name ?? "Zentra Collect",
      replyTo,
    };

    // Plain-text → HTML wrapper
    const escapedBody = input.bodyText
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    // Optional statement-of-account table
    let statementHtml = "";
    if (input.outstandingInvoices && input.outstandingInvoices.length > 0) {
      const fmt = (n: number) =>
        new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n);
      const total = input.outstandingInvoices.reduce((s, i) => s + i.amountOutstanding, 0);
      const rows = input.outstandingInvoices.map((inv) => `
        <tr>
          <td style="padding:6px 12px;border-bottom:1px solid #e5e0d4;font-size:13px">${inv.invoiceNumber ?? "—"}</td>
          <td style="padding:6px 12px;border-bottom:1px solid #e5e0d4;font-size:13px">${inv.dueDate ?? "—"}</td>
          <td style="padding:6px 12px;border-bottom:1px solid #e5e0d4;font-size:13px;text-align:right">${fmt(inv.amountOutstanding)}</td>
          <td style="padding:6px 12px;border-bottom:1px solid #e5e0d4;font-size:13px;text-align:right;color:${(inv.daysOverdue ?? 0) > 30 ? "#b91c1c" : "#374151"}">${inv.daysOverdue != null ? `${inv.daysOverdue}d` : "—"}</td>
        </tr>`).join("");
      statementHtml = `
        <div style="margin-top:24px">
          <p style="font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:#8d8472;margin-bottom:8px">Statement of outstanding invoices</p>
          <table style="width:100%;border-collapse:collapse;background:#faf5e8;border:1px solid #e5e0d4;border-radius:8px;overflow:hidden">
            <thead>
              <tr style="background:#f0ead8">
                <th style="padding:7px 12px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:#6b6253">Invoice</th>
                <th style="padding:7px 12px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:#6b6253">Due date</th>
                <th style="padding:7px 12px;text-align:right;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:#6b6253">Amount</th>
                <th style="padding:7px 12px;text-align:right;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:#6b6253">Overdue</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
            <tfoot>
              <tr style="background:#f0ead8">
                <td colspan="2" style="padding:8px 12px;font-size:13px;font-weight:600">Total outstanding</td>
                <td style="padding:8px 12px;font-size:13px;font-weight:700;text-align:right">${fmt(total)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>`;
    }

    const rawBodyHtml = `<pre style="font-family:sans-serif;white-space:pre-wrap;line-height:1.6">${escapedBody}</pre>${statementHtml}`;

    // Inject email tracking: rewrite same-origin links through /api/track/click,
    // append a 1x1 open pixel. Both endpoints fail-soft if the events table
    // is missing or Supabase isn't configured.
    const bodyHtml =
      rewriteLinksForTracking(rawBodyHtml, messageId, accountId) +
      trackingPixelHtml(messageId, accountId);

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
