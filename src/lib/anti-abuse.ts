/**
 * Anti-abuse utilities for trial signup.
 *
 * - Disposable email domain blocklist (curated, not exhaustive)
 * - In-memory rate limiter (acceptable for MVP / single-instance)
 * - Helpers for IP hashing (privacy-preserving rate-limit keys)
 *
 * For production, swap the in-memory rate limiter for Vercel KV / Upstash Redis
 * and persist trial history to Supabase.
 */

import { createHash } from "crypto";

// Curated list. The full disposable-domains list is ~6000 entries; this covers
// the most common offenders. Easy to expand later from `disposable-email-domains`.
const DISPOSABLE_DOMAINS = new Set<string>([
  "10minutemail.com", "10minutemail.net", "guerrillamail.com", "guerrillamail.info",
  "guerrillamail.net", "guerrillamail.org", "guerrillamailblock.com", "sharklasers.com",
  "mailinator.com", "mailinator.net", "mailinator.org", "mailinator2.com",
  "tempmail.com", "temp-mail.org", "temp-mail.io", "tempmailaddress.com",
  "throwawaymail.com", "trashmail.com", "trashmail.net", "trashmail.de",
  "yopmail.com", "yopmail.net", "yopmail.fr", "cool.fr.nf", "courriel.fr.nf",
  "moncourrier.fr.nf", "monemail.fr.nf", "monmail.fr.nf",
  "fakeinbox.com", "fakemailgenerator.com", "getairmail.com", "getnada.com",
  "harakirimail.com", "tempinbox.com", "tempinbox.co.uk",
  "dispostable.com", "maildrop.cc", "mintemail.com", "mohmal.com",
  "mytemp.email", "owlpic.com", "spam4.me", "spamgourmet.com",
  "spamgourmet.net", "spamgourmet.org",
  "tempr.email", "throwaway.email", "tmailinator.com", "trashinbox.com",
  "wegwerfemail.de", "wegwerf-email.de", "wegwerfmail.de", "wegwerfmail.net",
  "wegwerfmail.org", "20minutemail.com", "33mail.com", "anonbox.net",
  "discard.email", "discardmail.com", "dropmail.me", "emailondeck.com",
  "incognitomail.com", "jetable.org", "mt2015.com", "nada.email", "nada.ltd",
  "noemail.com", "openmailbox.org", "tempemail.com", "tempemail.co",
  "tempinbox.xyz", "throwaway.dev", "trashmail.io", "yandex-temp-mail.com",
]);

export function isDisposableEmailDomain(email: string): boolean {
  const at = email.lastIndexOf("@");
  if (at < 0) return false;
  const domain = email.slice(at + 1).trim().toLowerCase();
  if (!domain) return false;
  return DISPOSABLE_DOMAINS.has(domain);
}

/**
 * Free-provider check — flag (not block) consumer email providers.
 * Useful as a "soft signal" rather than a hard block, since some legit
 * solo bookkeepers do use Gmail. Toggle in env if you want hard-block.
 */
const FREE_EMAIL_PROVIDERS = new Set<string>([
  "gmail.com", "googlemail.com",
  "yahoo.com", "yahoo.co.uk", "ymail.com", "rocketmail.com",
  "hotmail.com", "hotmail.co.uk", "outlook.com", "live.com", "msn.com",
  "icloud.com", "me.com", "mac.com",
  "aol.com", "protonmail.com", "proton.me", "tutanota.com", "zoho.com",
  "gmx.com", "gmx.net", "mail.com", "fastmail.com",
]);

export function isFreeEmailProvider(email: string): boolean {
  const at = email.lastIndexOf("@");
  if (at < 0) return false;
  const domain = email.slice(at + 1).trim().toLowerCase();
  return FREE_EMAIL_PROVIDERS.has(domain);
}

export function emailDomain(email: string): string {
  const at = email.lastIndexOf("@");
  if (at < 0) return "";
  return email.slice(at + 1).trim().toLowerCase();
}

export function hashIp(ip: string): string {
  // Salt with a static value so logs/rate-limit keys aren't reversible
  // by anyone with the table dump
  const salt = process.env.IP_HASH_SALT ?? "zentra-mvp-salt";
  return createHash("sha256").update(ip + salt).digest("hex").slice(0, 24);
}

// ──────────────────────────────────────────────────────────────────────────────
// In-memory rate limiter (per-process). For multi-instance, replace with KV.
// ──────────────────────────────────────────────────────────────────────────────

type RateBucket = { count: number; firstHit: number };
const buckets = new Map<string, RateBucket>();

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetMs: number;
};

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || now - existing.firstHit > windowMs) {
    buckets.set(key, { count: 1, firstHit: now });
    return { allowed: true, limit, remaining: limit - 1, resetMs: windowMs };
  }

  existing.count += 1;
  const remaining = Math.max(0, limit - existing.count);
  const allowed = existing.count <= limit;
  const resetMs = windowMs - (now - existing.firstHit);
  return { allowed, limit, remaining, resetMs };
}

// Periodic cleanup so the map doesn't grow forever in long-lived processes
if (typeof globalThis !== "undefined") {
  const g = globalThis as unknown as { __zentraRateGcInstalled?: boolean };
  if (!g.__zentraRateGcInstalled) {
    g.__zentraRateGcInstalled = true;
    setInterval(() => {
      const now = Date.now();
      for (const [key, bucket] of buckets) {
        if (now - bucket.firstHit > 24 * 60 * 60 * 1000) buckets.delete(key);
      }
    }, 60 * 60 * 1000);
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Trial history check (in-memory store; replace with Supabase in production)
// ──────────────────────────────────────────────────────────────────────────────

type TrialRecord = { email: string; ipHash: string; createdAt: number };
const trialHistory: TrialRecord[] = [];

const TRIAL_REUSE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export function hasRecentTrialForEmail(email: string): boolean {
  const cutoff = Date.now() - TRIAL_REUSE_WINDOW_MS;
  return trialHistory.some(
    (r) => r.email.toLowerCase() === email.toLowerCase() && r.createdAt > cutoff,
  );
}

export function hasRecentTrialForIp(ipHash: string): boolean {
  const cutoff = Date.now() - TRIAL_REUSE_WINDOW_MS;
  return trialHistory.filter((r) => r.ipHash === ipHash && r.createdAt > cutoff).length >= 3;
}

export function recordTrialSignup(email: string, ipHash: string) {
  trialHistory.push({ email, ipHash, createdAt: Date.now() });
}
