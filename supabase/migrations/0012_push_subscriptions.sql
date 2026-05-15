-- Migration: 0012_push_subscriptions
-- Creates the zentra_push_subscriptions table for Web Push notification delivery.
-- One row per browser/device subscription endpoint. Multiple rows per account
-- (user may have installed the PWA on phone + desktop).

CREATE TABLE IF NOT EXISTS zentra_push_subscriptions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id      uuid NOT NULL REFERENCES zentra_accounts(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- The full PushSubscription JSON: { endpoint, keys: { p256dh, auth } }
  endpoint        text NOT NULL,
  p256dh          text NOT NULL,
  auth            text NOT NULL,

  -- User agent string for display in settings ("Chrome on iPhone", etc.)
  user_agent      text,

  -- Notification preferences per subscription
  notify_digest           boolean NOT NULL DEFAULT true,
  notify_escalations      boolean NOT NULL DEFAULT true,
  notify_import_complete  boolean NOT NULL DEFAULT true,

  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  -- One subscription per endpoint per account — re-subscribing updates keys
  UNIQUE (account_id, endpoint)
);

-- Indexes for cron query: fetch all active subscriptions for an account
CREATE INDEX IF NOT EXISTS idx_push_subs_account
  ON zentra_push_subscriptions (account_id);

CREATE INDEX IF NOT EXISTS idx_push_subs_user
  ON zentra_push_subscriptions (user_id);

-- updated_at auto-maintenance
CREATE OR REPLACE FUNCTION zentra_push_subs_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS push_subs_updated_at ON zentra_push_subscriptions;
CREATE TRIGGER push_subs_updated_at
  BEFORE UPDATE ON zentra_push_subscriptions
  FOR EACH ROW EXECUTE FUNCTION zentra_push_subs_set_updated_at();

-- RLS
ALTER TABLE zentra_push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can manage their own subscriptions only
CREATE POLICY "Users manage own push subscriptions"
  ON zentra_push_subscriptions
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Service role (Cron / server API routes) can read all subscriptions to send
-- notifications — handled via the service-role key which bypasses RLS.
