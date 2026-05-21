-- 0035_workspace_data_sync.sql
--
-- Single-table workspace sync: stores localStorage blobs per account per data
-- type so every device a user signs into gets the same data restored.
--
-- data_type values:
--   'invoices'        → zentra.importedInvoices.v1  (Invoice[])
--   'expenses'        → zentra.expenses.v1           (RichEntry[])
--   'bank_statements' → zentra.bankStatements.v2     (SavedStatement[])
--
-- Mileage is handled separately by zentra_mileage_trips + server actions.

create table if not exists public.zentra_workspace_data (
  id          uuid        primary key default gen_random_uuid(),
  account_id  uuid        not null references public.zentra_accounts(id) on delete cascade,
  data_type   text        not null check (data_type in ('invoices','expenses','bank_statements')),
  payload     jsonb       not null default '[]'::jsonb,
  updated_at  timestamptz not null default now(),
  constraint zentra_workspace_data_account_type_uniq unique (account_id, data_type)
);

alter table public.zentra_workspace_data enable row level security;

create policy "members manage workspace data"
  on public.zentra_workspace_data
  for all
  using  (zentra_is_account_member(account_id))
  with check (zentra_is_account_member(account_id));

create index on public.zentra_workspace_data (account_id);
