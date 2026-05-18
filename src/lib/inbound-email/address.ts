import { createHmac } from "crypto";

const INBOUND_DOMAIN = process.env.INBOUND_EMAIL_DOMAIN ?? "in.zentracollect.co.uk";

/**
 * Derives a stable, unguessable inbound email address for an account.
 * Uses the token stored in zentra_inbound_settings, not the account ID directly,
 * so it can be rotated if the address is ever leaked.
 */
export function buildInboundAddress(token: string): string {
  return `reply-${token}@${INBOUND_DOMAIN}`;
}

/**
 * Extracts the token from an inbound address like reply-{token}@in.zentracollect.co.uk
 * Returns null if the address doesn't match the expected pattern.
 */
export function extractTokenFromAddress(address: string): string | null {
  const domain = `@${INBOUND_DOMAIN}`;
  if (!address.endsWith(domain)) return null;
  const local = address.slice(0, -domain.length);
  if (!local.startsWith("reply-")) return null;
  return local.slice("reply-".length) || null;
}

/**
 * Generates a webhook signature for verifying inbound webhook payloads from
 * Resend or Postmark. Compare against the X-Webhook-Signature header.
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
): boolean {
  const secret = process.env.INBOUND_WEBHOOK_SECRET;
  if (!secret) return true; // no secret configured — skip verification in dev

  const expected = createHmac("sha256", secret)
    .update(payload)
    .digest("hex");

  return expected === signature;
}
