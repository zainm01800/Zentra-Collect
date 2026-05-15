-- Migration 0011: Add unique constraint on zentra_customers (account_id, business_id, name)
--
-- This constraint is required for the import action's customer upsert to work
-- correctly when falling back to onConflict-based upserts. Without it, repeated
-- imports of the same customer produce duplicate rows.
--
-- Safe to run multiple times (IF NOT EXISTS guard).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   pg_constraint
    WHERE  conname = 'zentra_customers_account_business_name_key'
  ) THEN
    ALTER TABLE public.zentra_customers
      ADD CONSTRAINT zentra_customers_account_business_name_key
      UNIQUE (account_id, business_id, name);
  END IF;
END $$;
