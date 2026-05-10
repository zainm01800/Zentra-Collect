import type { SmtpConfig } from "./smtp";
import { sendEmail } from "./smtp";

export type DraftInvoice = {
  invoiceId: string;
  customerName: string;
  toEmail: string;
  invoiceNumber: string;
  amountOutstanding: number;
  daysOverdue: number;
  subject: string;
  bodyText: string;
  bodyHtml: string;
};

export type SendCycleResult = {
  sent: number;
  failed: number;
  skipped: number;
  log: Array<{
    invoiceId: string;
    toEmail: string;
    status: "sent" | "failed" | "skipped";
    error?: string;
  }>;
};

export async function runSendCycle(
  config: SmtpConfig,
  drafts: DraftInvoice[],
  maxPerRun: number,
): Promise<SendCycleResult> {
  const result: SendCycleResult = { sent: 0, failed: 0, skipped: 0, log: [] };
  const queue = drafts.slice(0, maxPerRun);

  for (const draft of queue) {
    if (!draft.toEmail || !draft.toEmail.includes("@")) {
      result.skipped++;
      result.log.push({ invoiceId: draft.invoiceId, toEmail: draft.toEmail, status: "skipped" });
      continue;
    }

    const outcome = await sendEmail(
      config,
      draft.toEmail,
      draft.subject,
      draft.bodyHtml,
      draft.bodyText,
    );

    if (outcome.ok) {
      result.sent++;
      result.log.push({ invoiceId: draft.invoiceId, toEmail: draft.toEmail, status: "sent" });
    } else {
      result.failed++;
      result.log.push({
        invoiceId: draft.invoiceId,
        toEmail: draft.toEmail,
        status: "failed",
        error: outcome.error,
      });
    }
  }

  return result;
}

export function buildEmailBody(
  draft: Pick<
    DraftInvoice,
    "customerName" | "invoiceNumber" | "amountOutstanding" | "daysOverdue"
  >,
  messageText: string,
  fromName: string,
): { subject: string; bodyText: string; bodyHtml: string } {
  const subject = `Re: Invoice ${draft.invoiceNumber} — ${draft.daysOverdue} days overdue`;

  const bodyText = `${messageText}\n\n---\nSent via ${fromName}`;

  const bodyHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#111;padding:24px">
  <p style="white-space:pre-wrap;line-height:1.6">${escapeHtml(messageText)}</p>
  <hr style="border:none;border-top:1px solid #e5e5e5;margin:24px 0" />
  <p style="font-size:12px;color:#999">Sent via ${escapeHtml(fromName)}</p>
</body>
</html>`.trim();

  return { subject, bodyText, bodyHtml };
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
