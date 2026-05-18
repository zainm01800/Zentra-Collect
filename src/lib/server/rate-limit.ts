/**
 * Lightweight in-memory rate limiter.
 *
 * CB-8: on serverless this is NOT a strong defence — each cold-started
 * lambda container has its own Map. Treat as best-effort throttling that
 * stops simple loops, NOT as a security boundary. For production-grade
 * limits use Upstash (@upstash/ratelimit) backed by Redis.
 *
 * The `x-forwarded-for` header can be spoofed if your edge isn't trusted;
 * we take the FIRST entry (Vercel rewrites it to the real client IP at
 * the edge, so trusting first-entry is safe behind Vercel).
 */

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

// Periodic cleanup so the Map doesn't grow forever in long-running envs.
const MAX_BUCKETS = 10_000;

function pruneIfNeeded(now: number) {
  if (buckets.size < MAX_BUCKETS) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export function checkRateLimit(
  request: Request,
  {
    limit = 20,
    windowMs = 60_000,
    namespace,
  }: {
    limit?: number;
    windowMs?: number;
    namespace: string;
  },
) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const ip =
    forwardedFor?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "local-demo";
  const key = `${namespace}:${ip}`;
  const now = Date.now();
  pruneIfNeeded(now);
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, resetAt: now + windowMs };
  }

  if (bucket.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: bucket.resetAt };
  }

  bucket.count += 1;
  buckets.set(key, bucket);
  return {
    allowed: true,
    remaining: Math.max(0, limit - bucket.count),
    resetAt: bucket.resetAt,
  };
}
