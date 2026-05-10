/**
 * Sentry — Node.js / server runtime config.
 * Captures server-side errors from Next.js Route Handlers, server components, etc.
 */

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
    environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? "development",
    enabled: Boolean(dsn) && process.env.NODE_ENV !== "test",
  });
}
