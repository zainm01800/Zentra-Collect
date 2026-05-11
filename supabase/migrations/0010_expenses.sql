-- 0010_expenses.sql
-- Expense tracking for Zentra Collect.
-- Stores UK self-employed allowable expenses per account.

create table if not exists zentra_expenses (
  id          uuid        primary key default gen_random_uuid(),
  account_id  uuid        not null references zentra_accounts(id) on delete cascade,
  date        date        not null,
  amount      numeric(12, 2) not null check (amount > 0),
  category    text        not null,
  description text,
  created_at  timestamptz not null default now()
);

-- Row-level security
alter table zentra_expenses enable row level security;

create policy "account members can manage their expenses"
  on zentra_expenses
  for all
  using  (zentra_is_account_member(account_id))
  with check (zentra_is_account_member(account_id));

-- Performance: account + date lookups
create index on zentra_expenses (account_id, date desc);
