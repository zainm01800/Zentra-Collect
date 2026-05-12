-- Track what happened after each chase action.
-- Lets the user see which chases actually turned into cash.
--
-- invoice_ref is the invoice number string (always present).
-- outcome is one of: sent | promised | paid | dispute | snoozed

create table if not exists public.zentra_chase_outcomes (
  id                  uuid          primary key default gen_random_uuid(),
  account_id          uuid          not null references public.zentra_accounts(id) on delete cascade,
  invoice_ref         text          not null,
  client_name         text          not null,
  amount_outstanding  numeric(12,2),
  outcome             text          not null check (
                        outcome in ('sent', 'promised', 'paid', 'dispute', 'snoozed')
                      ),
  promised_date       date,
  notes               text,
  logged_by           uuid          references auth.users(id) on delete set null,
  created_at          timestamptz   not null default now()
);

alter table public.zentra_chase_outcomes enable row level security;

create policy "members can access chase outcomes"
  on public.zentra_chase_outcomes
  for all
  using  (public.zentra_is_account_member(account_id))
  with check (public.zentra_is_account_member(account_id));

create index if not exists zentra_chase_outcomes_account_idx
  on public.zentra_chase_outcomes (account_id, created_at desc);
