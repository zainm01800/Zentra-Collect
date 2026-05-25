-- Fix TrueLayer OAuth connection support.
--
-- Migration 0009 was supposed to add TrueLayer to the provider constraint
-- and add bank info columns, but was never applied to production.
-- This migration is idempotent — safe to run even if 0009 was applied.

-- 1. Allow 'truelayer' as a provider value
ALTER TABLE public.zentra_oauth_connections
  DROP CONSTRAINT IF EXISTS zentra_oauth_connections_provider_check;

ALTER TABLE public.zentra_oauth_connections
  ADD CONSTRAINT zentra_oauth_connections_provider_check
  CHECK (provider IN ('xero', 'quickbooks', 'freeagent', 'sage', 'truelayer'));

-- 2. Add human-readable bank account columns (so the UI can show
--    "Monzo · Current account" without hitting the TrueLayer API on every render)
ALTER TABLE public.zentra_oauth_connections
  ADD COLUMN IF NOT EXISTS bank_account_id   text,
  ADD COLUMN IF NOT EXISTS bank_account_name text,
  ADD COLUMN IF NOT EXISTS bank_provider_name text;
