-- Add STARTER_SOLO to the zentra_accounts plan_id constraint.
-- The Starter plan (£13.99/mo) was added after the initial schema was created.

ALTER TABLE public.zentra_accounts
  DROP CONSTRAINT IF EXISTS zentra_accounts_plan_id_check;

ALTER TABLE public.zentra_accounts
  ADD CONSTRAINT zentra_accounts_plan_id_check CHECK (
    plan_id IN (
      'DEMO',
      'TRIAL',
      'STARTER_SOLO',
      'FOUNDING_SINGLE',
      'FOUNDING_BOOKKEEPER',
      'SINGLE_BUSINESS',
      'BOOKKEEPER_STARTER',
      'BOOKKEEPER_PRO'
    )
  );
