-- 0036_workspace_data_expand.sql
--
-- Expand zentra_workspace_data to accept all data types.
-- The original CHECK constraint only allowed ('invoices','expenses','bank_statements').
-- Drop it so any string key is valid — app-level validation keeps it clean.

ALTER TABLE public.zentra_workspace_data
  DROP CONSTRAINT IF EXISTS zentra_workspace_data_data_type_check;
