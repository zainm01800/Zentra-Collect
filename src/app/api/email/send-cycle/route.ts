import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { runSendCycle } from "@/lib/email/send-engine";
import { buildEmailBody } from "@/lib/email/send-engine";
import { decryptPassword } from "@/lib/email/crypto";
import type { SmtpConfig } from "@/lib/email/smtp";
import { signPaymentToken, buildPortalUrl } from "@/lib/customer-portal/token";

// Called by Vercel cron (schedule: hourly) or manually for testing.
// Authorization via CRON_SECRET env var.
// Pulls SMTP settings + send log from Supabase, builds drafts from stored invoice data,
// then sends up to maxPerRun emails and logs results.

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

// Vercel cron fires GET requests; POST is kept for manual/test triggers.
export const GET = (req: NextRequest) => POST(req);

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const admin = getAdmin();
  if (!admin) {
    // Supabase not configured — nothing to send
    return NextResponse.json({ ok: true, sent: 0, failed: 0, skipped: 0, log: [], reason: "supabase_not_configured" });
  }

  try {
    // 1. Load all enabled email settings accounts
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: settingsRows, error: settingsError } = await (admin as any)
      .from("zentra_email_settings")
      .select("*")
      .eq("is_enabled", true);

    if (settingsError) {
      console.error("[send-cycle] failed to load settings:", settingsError.message);
      return NextResponse.json({ ok: false, error: settingsError.message }, { status: 500 });
    }

    if (!settingsRows?.length) {
      return NextResponse.json({ ok: true, sent: 0, failed: 0, skipped: 0, log: [], reason: "no_enabled_accounts" });
    }

    // 2. Check send window (hour + day of week)
    const now = new Date();
    const currentHourUtc = now.getUTCHours();
    const currentDayIso = now.getUTCDay() === 0 ? 0 : now.getUTCDay(); // 0=Sun, 1=Mon...

    let totalSent = 0;
    let totalFailed = 0;
    let totalSkipped = 0;
    const allLogs: unknown[] = [];

    for (const settings of settingsRows) {
      // Check if this account's send window matches now
      const allowedHour: number = settings.send_hour_utc ?? 9;
      const allowedDays: string = settings.send_days ?? "1,2,3,4,5";
      const allowedDayList = allowedDays.split(",").map(Number);

      if (currentHourUtc !== allowedHour || !allowedDayList.includes(currentDayIso)) {
        continue; // Not the right time for this account
      }

      // 3. Load invoices that need chasing from zentra_invoices
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: invoiceRows } = await (admin as any)
        .from("zentra_invoices")
        .select("id, customer_name, customer_email, invoice_number, amount_outstanding, due_date, days_overdue, recommended_action, draft_subject, draft_body")
        .eq("account_id", settings.account_id)
        .eq("queue_status", "active")
        .in("recommended_action", ["SEND_PAYMENT_REMINDER", "SEND_FINAL_NOTICE", "SEND_OVERDUE_NOTICE"])
        .not("customer_email", "is", null)
        .order("days_overdue", { ascending: false })
        .limit(settings.max_per_run ?? 5);

      if (!invoiceRows?.length) continue;

      // 4. Filter out invoices sent to in the last 7 days
      const invoiceIds = invoiceRows.map((r: { id: string }) => r.id);
      const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: recentLog } = await (admin as any)
        .from("zentra_email_send_log")
        .select("invoice_id")
        .in("invoice_id", invoiceIds)
        .gte("sent_at", cutoff)
        .eq("status", "sent");

      const recentlySentIds = new Set((recentLog ?? []).map((r: { invoice_id: string }) => r.invoice_id));
      const eligibleInvoices = invoiceRows.filter((r: { id: string }) => !recentlySentIds.has(r.id));

      if (!eligibleInvoices.length) continue;

      // 5. Build email drafts
      const smtpConfig: SmtpConfig = {
        host: settings.smtp_host,
        port: settings.smtp_port,
        user: settings.smtp_user,
        password: decryptPassword(settings.smtp_password_enc),
        fromName: settings.from_name ?? "Zentra Collect",
      };

      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
      const senderName = settings.from_name ?? "Zentra Collect";

      const drafts = eligibleInvoices.map((inv: {
        id: string;
        customer_name: string;
        customer_email: string;
        invoice_number: string;
        amount_outstanding: number;
        due_date: string;
        days_overdue: number;
        draft_body?: string;
      }) => {
        // Sign a portal token so the customer can pay, promise a date, or
        // explain the delay from one secure link. Returns null when
        // PAYMENT_TOKEN_SECRET isn't configured — email still goes out,
        // just without the portal link.
        const portalToken = signPaymentToken({
          invoiceId:     inv.id,
          invoiceNumber: inv.invoice_number,
          customerName:  inv.customer_name,
          amount:        inv.amount_outstanding,
          dueDate:       inv.due_date,
          businessName:  senderName,
          businessEmail: settings.smtp_user,
        });

        const baseMessage = inv.draft_body ?? `Hi,\n\nThis is a reminder that invoice ${inv.invoice_number} for £${inv.amount_outstanding.toFixed(2)} is ${inv.days_overdue} days overdue.\n\nPlease arrange payment at your earliest convenience.\n\nThank you.`;

        // Append a plain-text portal link so recipients on text-only mail
        // clients still see the pay-online affordance (the HTML body also
        // embeds a QR code that links to the same URL).
        const messageText = portalToken && siteUrl
          ? `${baseMessage}\n\nPay online: ${buildPortalUrl(siteUrl, portalToken)}`
          : baseMessage;

        const { subject, bodyText, bodyHtml } = buildEmailBody(
          {
            customerName: inv.customer_name,
            invoiceNumber: inv.invoice_number,
            amountOutstanding: inv.amount_outstanding,
            daysOverdue: inv.days_overdue,
          },
          messageText,
          senderName,
          { portalToken: portalToken ?? undefined },
        );
        return {
          invoiceId: inv.id,
          customerName: inv.customer_name,
          toEmail: inv.customer_email,
          invoiceNumber: inv.invoice_number,
          amountOutstanding: inv.amount_outstanding,
          daysOverdue: inv.days_overdue,
          subject,
          bodyText,
          bodyHtml,
        };
      });

      // 6. Send
      const result = await runSendCycle(smtpConfig, drafts, settings.max_per_run ?? 5);
      totalSent += result.sent;
      totalFailed += result.failed;
      totalSkipped += result.skipped;

      // 7. Log results to Supabase
      if (result.log.length) {
        const logRows = result.log.map((entry) => ({
          account_id: settings.account_id,
          invoice_id: entry.invoiceId,
          to_email: entry.toEmail,
          subject: drafts.find((d: { invoiceId: string }) => d.invoiceId === entry.invoiceId)?.subject ?? "",
          status: entry.status,
          error_message: entry.error ?? null,
        }));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (admin as any).from("zentra_email_send_log").insert(logRows);
      }

      allLogs.push(...result.log);
    }

    return NextResponse.json({ ok: true, sent: totalSent, failed: totalFailed, skipped: totalSkipped, log: allLogs });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Send cycle failed" },
      { status: 500 },
    );
  }
}
