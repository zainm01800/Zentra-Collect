-- Trader £5/mo waitlist signups
-- Captured from /trader-waitlist via joinTraderWaitlistAction.
-- The server action treats duplicate emails (unique_violation 23505) as
-- a successful resubscribe, so the UNIQUE constraint is load-bearing.

CREATE TABLE IF NOT EXISTS zentra_trader_waitlist (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email       text NOT NULL UNIQUE,
  source      text,                    -- optional UTM / referrer label
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS zentra_trader_waitlist_created_at_idx
  ON zentra_trader_waitlist (created_at DESC);
