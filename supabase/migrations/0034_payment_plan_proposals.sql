-- Migration: 0034_payment_plan_proposals
-- Customer-proposed instalment plans from the payment portal

CREATE TABLE IF NOT EXISTS public.zentra_payment_plan_proposals (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id          uuid        NOT NULL REFERENCES public.zentra_accounts(id) ON DELETE CASCADE,
  invoice_id          text        NOT NULL,
  invoice_number      text,
  customer_name       text,
  total_amount        numeric(12, 2) NOT NULL,
  instalment_count    integer     NOT NULL CHECK (instalment_count IN (2, 3, 4, 6)),
  instalment_amount   numeric(12, 2) NOT NULL,
  first_payment_date  date        NOT NULL,
  status              text        NOT NULL DEFAULT 'pending'
                                  CHECK (status IN ('pending', 'accepted', 'declined')),
  submitted_at        timestamptz NOT NULL DEFAULT now(),
  reviewed_at         timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ppp_account   ON public.zentra_payment_plan_proposals(account_id);
CREATE INDEX IF NOT EXISTS idx_ppp_invoice   ON public.zentra_payment_plan_proposals(invoice_id);
CREATE INDEX IF NOT EXISTS idx_ppp_status    ON public.zentra_payment_plan_proposals(status);

-- RLS
ALTER TABLE public.zentra_payment_plan_proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_select_proposals" ON public.zentra_payment_plan_proposals
  FOR SELECT USING (
    account_id IN (
      SELECT id FROM public.zentra_accounts WHERE owner_user_id = auth.uid()
    )
  );
