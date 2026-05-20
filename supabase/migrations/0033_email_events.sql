-- Migration: 0033_email_events
-- Creates zentra_email_events for Resend open/click tracking
-- Idempotent: handles case where table was partially created

CREATE TABLE IF NOT EXISTS public.zentra_email_events (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id       uuid        NOT NULL REFERENCES public.zentra_accounts(id) ON DELETE CASCADE,
  invoice_id       text,
  invoice_number   text,
  customer_name    text,
  resend_email_id  text        UNIQUE,
  sent_at          timestamptz NOT NULL DEFAULT now(),
  opened_at        timestamptz,
  click_count      integer     NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- Add columns that may be missing if table was previously created with an older schema
ALTER TABLE public.zentra_email_events
  ADD COLUMN IF NOT EXISTS resend_email_id text;

ALTER TABLE public.zentra_email_events
  ADD COLUMN IF NOT EXISTS invoice_id text;

ALTER TABLE public.zentra_email_events
  ADD COLUMN IF NOT EXISTS invoice_number text;

ALTER TABLE public.zentra_email_events
  ADD COLUMN IF NOT EXISTS customer_name text;

ALTER TABLE public.zentra_email_events
  ADD COLUMN IF NOT EXISTS opened_at timestamptz;

ALTER TABLE public.zentra_email_events
  ADD COLUMN IF NOT EXISTS click_count integer NOT NULL DEFAULT 0;

-- Add unique constraint on resend_email_id if not already present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'zentra_email_events_resend_email_id_key'
      AND conrelid = 'public.zentra_email_events'::regclass
  ) THEN
    ALTER TABLE public.zentra_email_events
      ADD CONSTRAINT zentra_email_events_resend_email_id_key UNIQUE (resend_email_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_email_events_account   ON public.zentra_email_events(account_id);
CREATE INDEX IF NOT EXISTS idx_email_events_resend_id ON public.zentra_email_events(resend_email_id);

-- RLS
ALTER TABLE public.zentra_email_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'zentra_email_events'
      AND policyname = 'owner_select_email_events'
  ) THEN
    CREATE POLICY "owner_select_email_events" ON public.zentra_email_events
      FOR SELECT USING (
        account_id IN (
          SELECT id FROM public.zentra_accounts WHERE owner_user_id = auth.uid()
        )
      );
  END IF;
END $$;
