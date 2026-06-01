-- 0037_lock_beta_access_requests.sql
--
-- SECURITY FIX. The Supabase Advisor flagged "RLS Policy Always True" on
-- public.zentra_beta_access_requests — a permissive policy let the public
-- (anon API key) READ every beta-access request, exposing applicants' names
-- and emails.
--
-- This table is a write-only public inbox. The /api/beta/request route now
-- uses the service-role client (getSupabaseAdminClient) for both the dedup
-- read and the insert, which bypasses RLS. So we can safely drop ALL policies:
-- RLS stays enabled with no policies, meaning anon/authenticated get NO access
-- while the service role (the API route) still works.

-- Drop every existing policy on the table (names are environment-specific).
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'zentra_beta_access_requests'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.zentra_beta_access_requests', pol.policyname);
  END LOOP;
END $$;

-- Ensure RLS is enabled (no policies → deny-all for anon/authenticated).
ALTER TABLE public.zentra_beta_access_requests ENABLE ROW LEVEL SECURITY;
