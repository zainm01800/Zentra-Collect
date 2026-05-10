/**
 * Sentry — browser config.
 * Loaded automatically by @sentry/nextjs in the browser bundle.
 *
 * Behaviour:
 *  - If NEXT_PUBLIC_SENTRY_DSN is unset, this is a no-op (zero overhead).
 *  - Set the DSN in production via Vercel env vars to start collecting errors.
 *
 * Privacy note: we set sendDefaultPii=false to avoid logging
 * personally-identifying request data without an explicit decision.
 */

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    sendDefaultPii: false,
    environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? "development",
    // Don't fail on missing DSN in dev
    enabled: Boolean(dsn) && process.env.NODE_ENV !== "test",
  });
}
