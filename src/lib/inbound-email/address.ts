import { createHmac, timingSafeEqual } from "crypto";

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
 * Verifies an inbound webhook payload signature.
 *
 * CB-7: previously returned true when no secret was set ("dev convenience").
 * That meant a missing/misnamed secret in production silently disabled
 * verification, letting anyone POST fake replies into zentra_inbound_replies.
 * Now: in production, missing secret fails closed. Uses timing-safe compare.
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
): boolean {
  const secret = process.env.INBOUND_WEBHOOK_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") return false;
    return true; // dev/test only
  }
  if (!signature) return false;

  const expected = createHmac("sha256", secret).update(payload).digest("hex");
  const expectedBuf = Buffer.from(expected, "hex");
  let providedBuf: Buffer;
  try {
    providedBuf = Buffer.from(signature, "hex");
  } catch {
    return false;
  }
  if (expectedBuf.length !== providedBuf.length) return false;
  return timingSafeEqual(expectedBuf, providedBuf);
}
