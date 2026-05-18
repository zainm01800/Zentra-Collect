/**
 * Thin wrapper around the Resend SDK for system transactional emails.
 * No-ops gracefully when RESEND_API_KEY is not set (local / demo deploys).
 */

import { Resend } from "resend";

const FROM =
  process.env.RESEND_FROM_EMAIL ?? "Zentra Collect <noreply@zentracollect.co.uk>";

let _client: Resend | null = null;

function getClient(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  if (!_client) _client = new Resend(process.env.RESEND_API_KEY);
  return _client;
}

export interface TransactionalEmailOptions {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export async function sendTransactionalEmail(opts: TransactionalEmailOptions): Promise<void> {
  const client = getClient();
  if (!client) {
    console.info("[transactional] RESEND_API_KEY not set — skipping email to", opts.to);
    return;
  }

  const { error } = await client.emails.send({
    from: FROM,
    to: [opts.to],
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
  });

  if (error) {
    console.error("[transactional] Resend send failed:", error);
  }
}
