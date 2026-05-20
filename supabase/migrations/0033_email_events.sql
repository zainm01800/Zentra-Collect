-- Migration: 0033_email_events
-- Creates zentra_email_events for Resend open/click tracking

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

CREATE INDEX IF NOT EXISTS idx_email_events_account   ON public.zentra_email_events(account_id);
CREATE INDEX IF NOT EXISTS idx_email_events_resend_id ON public.zentra_email_events(resend_email_id);

-- RLS
ALTER TABLE public.zentra_email_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_select_email_events" ON public.zentra_email_events
  FOR SELECT USING (
    account_id IN (
      SELECT id FROM public.zentra_accounts WHERE user_id = auth.uid()
    )
  );
