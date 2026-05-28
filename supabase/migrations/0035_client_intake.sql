-- 0035_client_intake.sql
--
-- Client data intake flow: bookkeepers generate shareable upload links for
-- their clients so clients can send invoice CSVs / bank statements without
-- the bookkeeper needing account access.
--
-- Tables:
--   zentra_intake_tokens   — one row per generated link; expires after 30 days
--   zentra_intake_uploads  — files uploaded by clients against a token

-- ── Intake tokens ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.zentra_intake_tokens (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id      uuid        NOT NULL REFERENCES public.zentra_accounts(id) ON DELETE CASCADE,
  client_id       text        NOT NULL,
  client_name     text        NOT NULL,
  bookkeeper_name text,
  token           text        NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'base64url'),
  expires_at      timestamptz NOT NULL DEFAULT now() + interval '30 days',
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- RLS: anyone can SELECT a non-expired token (needed to render the public intake page)
ALTER TABLE public.zentra_intake_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_valid_intake_token" ON public.zentra_intake_tokens
  FOR SELECT USING (expires_at > now());

CREATE POLICY "bookkeeper_manage_intake_tokens" ON public.zentra_intake_tokens
  FOR ALL USING (
    account_id IN (
      SELECT account_id FROM public.zentra_account_members WHERE user_id = auth.uid()
    )
  );

-- ── Intake uploads ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.zentra_intake_uploads (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id         uuid        NOT NULL REFERENCES public.zentra_intake_tokens(id) ON DELETE CASCADE,
  account_id       uuid        NOT NULL,
  client_id        text        NOT NULL,
  upload_type      text        NOT NULL CHECK (upload_type IN ('invoices', 'bank_statement', 'receipts', 'other')),
  file_name        text        NOT NULL,
  file_size_bytes  integer,
  raw_content      text        NOT NULL,  -- raw CSV text (receipts: base64-encoded image)
  uploaded_at      timestamptz NOT NULL DEFAULT now(),
  imported_at      timestamptz            -- set when bookkeeper imports it into their workspace
);

ALTER TABLE public.zentra_intake_uploads ENABLE ROW LEVEL SECURITY;

-- Anyone can INSERT an upload as long as the referenced token is still valid
CREATE POLICY "public_insert_intake_upload" ON public.zentra_intake_uploads
  FOR INSERT WITH CHECK (
    token_id IN (
      SELECT id FROM public.zentra_intake_tokens WHERE expires_at > now()
    )
  );

-- Bookkeepers can read and update uploads for their account
CREATE POLICY "bookkeeper_read_intake_uploads" ON public.zentra_intake_uploads
  FOR SELECT USING (
    account_id IN (
      SELECT account_id FROM public.zentra_account_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "bookkeeper_update_intake_uploads" ON public.zentra_intake_uploads
  FOR UPDATE USING (
    account_id IN (
      SELECT account_id FROM public.zentra_account_members WHERE user_id = auth.uid()
    )
  );
