/**
 * Cache of customer emails on active Direct Debit mandates.
 *
 * Populated by the GoCardless sync, consumed by the chase ranking
 * engine. localStorage so the chase plan can run client-side without
 * an extra API round-trip on every render.
 *
 * Stored as a JSON array of lowercased emails plus a sync timestamp so
 * we can show "last synced 2h ago" later if useful. SSR-safe.
 */

const STORAGE_KEY = "zn:dd-emails:v1";

interface DDCache {
  emails:    string[];
  syncedAt:  string;
}

export function writeDirectDebitEmails(emails: string[]): void {
  if (typeof window === "undefined") return;
  try {
    const payload: DDCache = {
      emails:   emails.map((e) => e.toLowerCase()),
      syncedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* quota — drop */
  }
}

export function readDirectDebitEmails(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as DDCache;
    if (!parsed?.emails || !Array.isArray(parsed.emails)) return new Set();
    return new Set(parsed.emails);
  } catch {
    return new Set();
  }
}

export function clearDirectDebitEmails(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}
