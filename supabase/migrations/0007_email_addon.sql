-- Track whether the email auto-send add-on has been purchased.
-- Managed independently of the base plan so cancelling the add-on
-- does not affect the subscription tier.

ALTER TABLE public.zentra_accounts
  ADD COLUMN IF NOT EXISTS email_addon boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_addon_subscription_id text;
