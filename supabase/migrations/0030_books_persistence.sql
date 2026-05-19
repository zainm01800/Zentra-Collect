-- 0030_books_persistence.sql
--
-- Persistence for the books features that were previously localStorage-only:
--   - mileage (HMRC AMAP allowance trips)
--   - quotes (draft → sent → accepted → converted)
--   - credit notes (refunds / cancellations that reduce taxable income + VAT)
--   - direct income (bank-feed credits tagged as income with no invoice)
--
-- All tables are RLS-scoped to account members via zentra_is_account_member().
-- Schema mirrors the localStorage shapes in src/lib/{mileage,quotes,credit-notes}.ts
-- and src/lib/banking/direct-income.ts so the client-side reads / writes can
-- map field-for-field without translation.

-- ── Mileage ──────────────────────────────────────────────────────────────────
create table if not exists zentra_mileage_trips (
  id          uuid        primary key default gen_random_uuid(),
  account_id  uuid        not null references zentra_accounts(id) on delete cascade,
  trip_date   date        not null,
  miles       numeric(10, 2) not null check (miles >= 0),
  purpose     text        not null,
  from_to     text,
  created_at  timestamptz not null default now()
);
alter table zentra_mileage_trips enable row level security;
create policy "members manage mileage" on zentra_mileage_trips
  for all using  (zentra_is_account_member(account_id))
         with check (zentra_is_account_member(account_id));
create index on zentra_mileage_trips (account_id, trip_date desc);

-- ── Quotes ───────────────────────────────────────────────────────────────────
create table if not exists zentra_quotes (
  id                       uuid        primary key default gen_random_uuid(),
  account_id               uuid        not null references zentra_accounts(id) on delete cascade,
  quote_number             text        not null,
  customer_name            text        not null,
  customer_email           text,
  issue_date               date        not null,
  expires_on               date,
  status                   text        not null default 'draft'
                                       check (status in ('draft','sent','accepted','declined','converted')),
  -- Line items kept as JSONB — same shape as the localStorage QuoteLineItem[].
  -- Quote line items don't need referential integrity and the count is bounded;
  -- JSONB beats a child table for read performance and write atomicity.
  line_items               jsonb       not null default '[]'::jsonb,
  notes                    text,
  converted_to_invoice_id  text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  unique (account_id, quote_number)
);
alter table zentra_quotes enable row level security;
create policy "members manage quotes" on zentra_quotes
  for all using  (zentra_is_account_member(account_id))
         with check (zentra_is_account_member(account_id));
create index on zentra_quotes (account_id, created_at desc);

-- ── Credit notes ─────────────────────────────────────────────────────────────
create table if not exists zentra_credit_notes (
  id                  uuid        primary key default gen_random_uuid(),
  account_id          uuid        not null references zentra_accounts(id) on delete cascade,
  credit_note_number  text        not null,
  invoice_id          text,
  invoice_number      text,
  customer_name       text        not null,
  issue_date          date        not null,
  reason              text        not null,
  amount_net          numeric(12, 2) not null check (amount_net >= 0),
  vat_rate            numeric(5,  2) not null default 0,
  vat_amount          numeric(12, 2) not null default 0,
  amount_gross        numeric(12, 2) not null,
  created_at          timestamptz not null default now(),
  unique (account_id, credit_note_number)
);
alter table zentra_credit_notes enable row level security;
create policy "members manage credit notes" on zentra_credit_notes
  for all using  (zentra_is_account_member(account_id))
         with check (zentra_is_account_member(account_id));
create index on zentra_credit_notes (account_id, issue_date desc);

-- ── Direct income (tagged bank credits) ──────────────────────────────────────
-- The transaction_id is the TrueLayer transaction reference, which is globally
-- unique within an account's bank-feed scope; we enforce uniqueness so the
-- "tag" action is idempotent (re-tagging the same txn is a no-op).
create table if not exists zentra_direct_income (
  id              uuid        primary key default gen_random_uuid(),
  account_id      uuid        not null references zentra_accounts(id) on delete cascade,
  transaction_id  text        not null,
  amount          numeric(12, 2) not null check (amount > 0),
  income_date     date        not null,
  description     text,
  category        text        not null default 'services'
                              check (category in ('services','products','rental','interest','other')),
  tagged_at       timestamptz not null default now(),
  unique (account_id, transaction_id)
);
alter table zentra_direct_income enable row level security;
create policy "members manage direct income" on zentra_direct_income
  for all using  (zentra_is_account_member(account_id))
         with check (zentra_is_account_member(account_id));
create index on zentra_direct_income (account_id, income_date desc);
