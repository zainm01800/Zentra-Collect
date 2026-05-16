/**
 * Customer-facing portal tokens.
 *
 * The customer doesn't have a Zentra login — every page they touch
 * (/pay/[token], /pay/[token]/promise, /pay/[token]/reason) is reached
 * via a self-contained signed token in the URL that contains the entire
 * invoice payload they need to see.
 *
 * Security model:
 *   - HMAC-SHA256 over the JSON payload using PAYMENT_TOKEN_SECRET
 *   - Tokens are stateless — no DB lookup, no Supabase roundtrip
 *   - Tokens carry an expiry (default 90 days from creation)
 *   - Tampering with any field invalidates the signature
 *
 * This is server-only — uses Node crypto. Never bundle for client.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

// ── Payload ───────────────────────────────────────────────────────────────────

export interface PaymentTokenPayload {
  /** Invoice identifier (whatever ID the user's system uses). */
  invoiceId:     string;
  /** Invoice number for display. */
  invoiceNumber: string;
  /** Customer name — shown on the public page. */
  customerName:  string;
  /** Amount owed at time of token issue (in GBP, e.g. 1500.50). */
  amount:        number;
  /** ISO date string for the original due date. */
  dueDate:       string;
  /** The user's business name (shown as the creditor). */
  businessName:  string;
  /** Reply-to email shown for queries. */
  businessEmail: string;
  /**
   * Optional early-payment discount. When present and the customer pays
   * on or before deadlineIso, percent (0-100) is taken off the invoice
   * amount at checkout. Server re-derives the discounted total — the
   * portal flag is just UI intent, never the source of truth.
   */
  earlyPay?: {
    percent:     number;
    deadlineIso: string;
  };
  /** Issued-at timestamp (seconds). */
  iat:           number;
  /** Expiry timestamp (seconds). */
  exp:           number;
}

// ── Config ────────────────────────────────────────────────────────────────────

const DEFAULT_EXPIRY_DAYS = 90;

function getSecret(): string | null {
  const secret = process.env.PAYMENT_TOKEN_SECRET;
  if (!secret || secret.length < 32) return null;
  return secret;
}

export function isPortalConfigured(): boolean {
  return getSecret() !== null;
}

// ── Encoding helpers ─────────────────────────────────────────────────────────

function base64urlEncode(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlDecode(s: string): Buffer {
  const pad = s.length % 4 === 0 ? 0 : 4 - (s.length % 4);
  const padded = s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat(pad);
  return Buffer.from(padded, "base64");
}

// ── Sign + verify ─────────────────────────────────────────────────────────────

/**
 * Create a signed token for a given invoice. Returns null when no secret
 * is configured (caller should fall back to "portal not available" UI).
 */
export function signPaymentToken(
  partial: Omit<PaymentTokenPayload, "iat" | "exp">,
  expiryDays: number = DEFAULT_EXPIRY_DAYS,
): string | null {
  const secret = getSecret();
  if (!secret) return null;

  const now = Math.floor(Date.now() / 1000);
  const payload: PaymentTokenPayload = {
    ...partial,
    iat: now,
    exp: now + expiryDays * 24 * 60 * 60,
  };

  const payloadJson = JSON.stringify(payload);
  const payloadB64 = base64urlEncode(Buffer.from(payloadJson, "utf8"));

  const sig = createHmac("sha256", secret).update(payloadB64).digest();
  const sigB64 = base64urlEncode(sig);

  return `${payloadB64}.${sigB64}`;
}

export type VerifyResult =
  | { ok: true;  payload: PaymentTokenPayload }
  | { ok: false; error: "not_configured" | "malformed" | "bad_signature" | "expired" };

/** Verify a token from the URL — returns the payload or a specific failure. */
export function verifyPaymentToken(token: string): VerifyResult {
  const secret = getSecret();
  if (!secret) return { ok: false, error: "not_configured" };

  const parts = token.split(".");
  if (parts.length !== 2) return { ok: false, error: "malformed" };

  const [payloadB64, sigB64] = parts;

  // Recompute the signature with our secret and compare in constant time
  const expected = createHmac("sha256", secret).update(payloadB64).digest();
  let actual: Buffer;
  try {
    actual = base64urlDecode(sigB64);
  } catch {
    return { ok: false, error: "malformed" };
  }
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return { ok: false, error: "bad_signature" };
  }

  // Parse + check expiry
  let payload: PaymentTokenPayload;
  try {
    payload = JSON.parse(base64urlDecode(payloadB64).toString("utf8")) as PaymentTokenPayload;
  } catch {
    return { ok: false, error: "malformed" };
  }
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp < now) return { ok: false, error: "expired" };

  return { ok: true, payload };
}

// ── Early-pay discount helpers ───────────────────────────────────────────────

export interface EarlyPayQuote {
  /** Discount percent (0-100). */
  percent:         number;
  /** Discount in GBP (rounded to 2dp). */
  discountAmount:  number;
  /** Discounted invoice total in GBP (rounded to 2dp). */
  discountedTotal: number;
  /** ISO deadline by which the customer must pay to qualify. */
  deadlineIso:     string;
  /** True if the deadline is in the future (i.e. the offer is live). */
  active:          boolean;
}

/**
 * Compute the early-pay quote for a token. Returns null when the payload
 * has no earlyPay block. Always returns a quote (even if expired) so the
 * portal can render a "discount expired" message if it wants — caller
 * should check `active`.
 */
export function quoteEarlyPay(payload: PaymentTokenPayload, now: Date = new Date()): EarlyPayQuote | null {
  if (!payload.earlyPay) return null;
  const { percent, deadlineIso } = payload.earlyPay;
  const clamped = Math.max(0, Math.min(100, percent));
  const discountAmount  = Math.round(payload.amount * (clamped / 100) * 100) / 100;
  const discountedTotal = Math.round((payload.amount - discountAmount) * 100) / 100;
  const active = new Date(deadlineIso).getTime() >= now.getTime();
  return {
    percent:         clamped,
    discountAmount,
    discountedTotal,
    deadlineIso,
    active,
  };
}

// ── URL builder ──────────────────────────────────────────────────────────────

/** Build a customer-facing URL given a token. */
export function buildPortalUrl(siteUrl: string, token: string): string {
  const trimmed = siteUrl.replace(/\/$/, "");
  return `${trimmed}/pay/${token}`;
}
