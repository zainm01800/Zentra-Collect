-- Add TrueLayer as an allowed OAuth provider so bank connections can be
-- stored in the existing zentra_oauth_connections table.

ALTER TABLE public.zentra_oauth_connections
  DROP CONSTRAINT IF EXISTS zentra_oauth_connections_provider_check;

ALTER TABLE public.zentra_oauth_connections
  ADD CONSTRAINT zentra_oauth_connections_provider_check
  CHECK (provider IN ('xero', 'quickbooks', 'freeagent', 'sage', 'truelayer'));

-- Also add two extra columns to record human-readable bank account details
-- so the UI can display "Barclays · ****1234" without hitting the API.

ALTER TABLE public.zentra_oauth_connections
  ADD COLUMN IF NOT EXISTS bank_account_id   text,
  ADD COLUMN IF NOT EXISTS bank_account_name text,
  ADD COLUMN IF NOT EXISTS bank_provider_name text;
