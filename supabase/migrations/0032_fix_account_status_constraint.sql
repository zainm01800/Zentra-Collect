-- Migration: Add 'past_due' to zentra_accounts.status CHECK constraint
-- The Stripe webhook writes status = 'past_due' on payment_failed events,
-- but the original constraint didn't include it, causing DB errors.

ALTER TABLE public.zentra_accounts
  DROP CONSTRAINT IF EXISTS zentra_accounts_status_check;

ALTER TABLE public.zentra_accounts
  ADD CONSTRAINT zentra_accounts_status_check CHECK (
    status IN ('demo', 'trialing', 'active', 'beta', 'expired', 'cancelled', 'past_due')
  );
