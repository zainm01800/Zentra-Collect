-- Financial settings, manual income, and manual bills for Zentra Flow.
--
-- zentra_financial_settings — one row per account; stores bank balance,
--   tax rate, currency, and freelancer classification.
-- zentra_manual_income — ad-hoc income entries (non-invoice cash).
-- zentra_manual_bills — upcoming bills the account owner wants to track.
--
-- All three tables follow the same RLS pattern used throughout the schema:
-- access is gated by zentra_is_account_member() defined in 0002.

-- ── zentra_financial_settings ─────────────────────────────────────────────────

create table if not exists public.zentra_financial_settings (
  id                      uuid        primary key default gen_random_uuid(),
  account_id              uuid        not null references public.zentra_accounts(id) on delete cascade,
  bank_balance            numeric(12,2) default 0,
  bank_balance_updated_at timestamptz,
  tax_rate_percent        numeric(5,2) default 20.00,
  country_code            text        default 'GB',
  freelancer_type         text,
  currency_code           text        default 'GBP',
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  unique (account_id)
);

-- ── zentra_manual_income ──────────────────────────────────────────────────────

create table if not exists public.zentra_manual_income (
  id            uuid          primary key default gen_random_uuid(),
  account_id    uuid          not null references public.zentra_accounts(id) on delete cascade,
  amount        numeric(12,2) not null,
  description   text,
  received_date date          not null,
  source        text,
  created_at    timestamptz   not null default now()
);

-- ── zentra_manual_bills ───────────────────────────────────────────────────────

create table if not exists public.zentra_manual_bills (
  id                  uuid          primary key default gen_random_uuid(),
  account_id          uuid          not null references public.zentra_accounts(id) on delete cascade,
  description         text          not null,
  amount              numeric(12,2) not null,
  due_date            date          not null,
  is_recurring        boolean       default false,
  recurrence_interval text,
  created_at          timestamptz   not null default now()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

create index if not exists zentra_manual_income_account_date_idx
  on public.zentra_manual_income (account_id, received_date desc);

create index if not exists zentra_manual_bills_account_due_idx
  on public.zentra_manual_bills (account_id, due_date);

-- ── Row-level security ────────────────────────────────────────────────────────

alter table public.zentra_financial_settings enable row level security;
alter table public.zentra_manual_income       enable row level security;
alter table public.zentra_manual_bills        enable row level security;

create policy "members can access financial settings"
  on public.zentra_financial_settings
  for all
  using  (public.zentra_is_account_member(account_id))
  with check (public.zentra_is_account_member(account_id));

create policy "members can access manual income"
  on public.zentra_manual_income
  for all
  using  (public.zentra_is_account_member(account_id))
  with check (public.zentra_is_account_member(account_id));

create policy "members can access manual bills"
  on public.zentra_manual_bills
  for all
  using  (public.zentra_is_account_member(account_id))
  with check (public.zentra_is_account_member(account_id));

-- ── updated_at trigger ────────────────────────────────────────────────────────
-- set_updated_at() is a shared helper; create or replace is safe if it already
-- exists from a later migration or Supabase's own moddatetime extension.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_zentra_financial_settings_updated_at
  before update on public.zentra_financial_settings
  for each row
  execute function public.set_updated_at();
