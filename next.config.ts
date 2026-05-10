import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  /* config options here */
};

// Wrap with Sentry. When SENTRY env vars are absent, this is a no-op
// — no source-map upload, no overhead, no Sentry features active.
const sentryWebpackPluginOptions = {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.SENTRY_AUTH_TOKEN,
  // Don't upload source maps in dev or when no auth token is configured.
  disableLogger: true,
  hideSourceMaps: true,
  widenClientFileUpload: true,
};

// Only apply the wrapper when there's actually a DSN configured.
// Avoids confusing build warnings during local dev.
const shouldWrap =
  Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN) &&
  Boolean(process.env.SENTRY_AUTH_TOKEN);

export default shouldWrap
  ? withSentryConfig(nextConfig, sentryWebpackPluginOptions)
  : nextConfig;
