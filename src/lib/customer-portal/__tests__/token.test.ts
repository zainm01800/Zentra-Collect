/**
 * Tests for lib/customer-portal/token.ts
 *
 * Token security is load-bearing — a bad signature check would let
 * a customer modify the URL to pay the wrong invoice or skip payment.
 */

import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  signPaymentToken,
  verifyPaymentToken,
  isPortalConfigured,
  buildPortalUrl,
  type PaymentTokenPayload,
} from "@/lib/customer-portal/token";

const TEST_SECRET = "test-secret-must-be-at-least-32-characters-long";

function payload(): Omit<PaymentTokenPayload, "iat" | "exp"> {
  return {
    invoiceId:     "inv-123",
    invoiceNumber: "INV-001",
    customerName:  "Acme Ltd",
    amount:        1500.50,
    dueDate:       "2026-05-01",
    businessName:  "Bookkeeper Studio",
    businessEmail: "ar@studio.co.uk",
  };
}

describe("isPortalConfigured", () => {
  let originalSecret: string | undefined;
  beforeEach(() => {
    originalSecret = process.env.PAYMENT_TOKEN_SECRET;
  });
  afterEach(() => {
    if (originalSecret === undefined) delete process.env.PAYMENT_TOKEN_SECRET;
    else process.env.PAYMENT_TOKEN_SECRET = originalSecret;
  });

  it("is false when no secret is set", () => {
    delete process.env.PAYMENT_TOKEN_SECRET;
    expect(isPortalConfigured()).toBe(false);
  });
  it("is false when secret is too short", () => {
    process.env.PAYMENT_TOKEN_SECRET = "short";
    expect(isPortalConfigured()).toBe(false);
  });
  it("is true with a strong secret", () => {
    process.env.PAYMENT_TOKEN_SECRET = TEST_SECRET;
    expect(isPortalConfigured()).toBe(true);
  });
});

describe("signPaymentToken + verifyPaymentToken", () => {
  let originalSecret: string | undefined;
  beforeEach(() => {
    originalSecret = process.env.PAYMENT_TOKEN_SECRET;
    process.env.PAYMENT_TOKEN_SECRET = TEST_SECRET;
  });
  afterEach(() => {
    if (originalSecret === undefined) delete process.env.PAYMENT_TOKEN_SECRET;
    else process.env.PAYMENT_TOKEN_SECRET = originalSecret;
  });

  it("round-trips a payload through sign + verify", () => {
    const token = signPaymentToken(payload());
    expect(token).not.toBeNull();
    const result = verifyPaymentToken(token!);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload.invoiceId).toBe("inv-123");
      expect(result.payload.invoiceNumber).toBe("INV-001");
      expect(result.payload.amount).toBe(1500.50);
      expect(result.payload.iat).toBeGreaterThan(0);
      expect(result.payload.exp).toBeGreaterThan(result.payload.iat);
    }
  });

  it("returns null when no secret is configured", () => {
    delete process.env.PAYMENT_TOKEN_SECRET;
    expect(signPaymentToken(payload())).toBeNull();
  });

  it("rejects a token with no secret configured (not_configured)", () => {
    const token = signPaymentToken(payload())!;
    delete process.env.PAYMENT_TOKEN_SECRET;
    const result = verifyPaymentToken(token);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("not_configured");
  });

  it("rejects a malformed token", () => {
    process.env.PAYMENT_TOKEN_SECRET = TEST_SECRET;
    const result = verifyPaymentToken("not-a-real-token");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("malformed");
  });

  it("rejects a tampered payload", () => {
    const token = signPaymentToken(payload())!;
    // Take valid signature, attach to a different payload
    const [, sig] = token.split(".");
    const tampered = Buffer.from(JSON.stringify({ ...payload(), amount: 0, iat: 1, exp: 9999999999 }), "utf8")
      .toString("base64")
      .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const fakeToken = `${tampered}.${sig}`;
    const result = verifyPaymentToken(fakeToken);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("bad_signature");
  });

  it("rejects an expired token", () => {
    // Sign with -1 day expiry so it's already expired
    const token = signPaymentToken(payload(), -1);
    expect(token).not.toBeNull();
    const result = verifyPaymentToken(token!);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("expired");
  });

  it("rejects a token signed with a different secret", () => {
    const token = signPaymentToken(payload())!;
    process.env.PAYMENT_TOKEN_SECRET = "completely-different-secret-32-chars-long-x";
    const result = verifyPaymentToken(token);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("bad_signature");
  });
});

describe("buildPortalUrl", () => {
  it("joins the site URL and token cleanly", () => {
    expect(buildPortalUrl("https://example.com", "xyz")).toBe("https://example.com/pay/xyz");
  });
  it("handles trailing slash on site URL", () => {
    expect(buildPortalUrl("https://example.com/", "xyz")).toBe("https://example.com/pay/xyz");
  });
});
