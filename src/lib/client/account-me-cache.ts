/**
 * Lightweight in-flight request dedup for /api/account/me.
 *
 * Audit §9: AccountSync, CheckoutSuccessBanner, and AccountBilling all
 * polled /api/account/me independently on mount, often within the same
 * tick. This dedups concurrent calls into a single request — short
 * 5-second cache so genuinely-stale checks still happen.
 */

const STALE_AFTER_MS = 5_000;

type CacheEntry = {
  promise: Promise<unknown> | null;
  fetchedAt: number;
  data: unknown;
};

const cache: CacheEntry = { promise: null, fetchedAt: 0, data: null };

export async function fetchAccountMe(force = false): Promise<unknown> {
  const now = Date.now();
  if (!force && cache.data && now - cache.fetchedAt < STALE_AFTER_MS) {
    return cache.data;
  }
  if (cache.promise) return cache.promise;

  cache.promise = (async () => {
    try {
      const res = await fetch("/api/account/me");
      if (!res.ok) return null;
      const data = await res.json();
      cache.data = data;
      cache.fetchedAt = Date.now();
      return data;
    } finally {
      cache.promise = null;
    }
  })();
  return cache.promise;
}
