-- 0036_secure_legacy_tables.sql
--
-- SECURITY FIX. The Supabase Advisor flagged "RLS Disabled in Public" on the
-- legacy CashPilot-era tables (migration 0001). The current app uses the
-- zentra_* tables exclusively — these legacy tables are unused, but with RLS
-- disabled they are readable/writable through the public (anon) API key.
--
-- Enabling RLS with NO policies denies all access via the anon/authenticated
-- roles (the service role still bypasses RLS). Since nothing in the app reads
-- these tables, this is safe and closes the exposure.
--
-- If any of these tables are ever brought back into use, add explicit policies
-- scoped by owner/business membership.

ALTER TABLE public.users              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.businesses         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminder_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminder_activity  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings           ENABLE ROW LEVEL SECURITY;
