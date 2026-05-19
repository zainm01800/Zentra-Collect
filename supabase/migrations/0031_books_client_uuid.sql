-- 0031_books_client_uuid.sql
--
-- Adds client_uuid to the four books tables to make the localStorage→
-- Supabase bulk sync idempotent. Without this, a returning user whose
-- local cache contains both server-issued rows and local-only rows
-- could push duplicates on re-sync (each push-then-hydrate cycle would
-- re-insert anything missing a server id).
--
-- The client_uuid is the local id generated client-side (e.g. trip-XXXX,
-- q-XXXX, cn-XXXX, or the TrueLayer transaction_id for direct income).
-- A unique partial index per account makes upsert-on-conflict trivial.

alter table zentra_mileage_trips    add column if not exists client_uuid text;
alter table zentra_quotes           add column if not exists client_uuid text;
alter table zentra_credit_notes     add column if not exists client_uuid text;

create unique index if not exists zentra_mileage_trips_account_clientuuid_uniq
  on zentra_mileage_trips (account_id, client_uuid)
  where client_uuid is not null;

create unique index if not exists zentra_quotes_account_clientuuid_uniq
  on zentra_quotes (account_id, client_uuid)
  where client_uuid is not null;

create unique index if not exists zentra_credit_notes_account_clientuuid_uniq
  on zentra_credit_notes (account_id, client_uuid)
  where client_uuid is not null;

-- ── Cancel-survey feedback ─────────────────────────────────────────────────
-- Records the reason given when a user opens the cancel modal, plus
-- whether they paused, cancelled, or kept their plan. Drives retention
-- analytics. Not RLS-exposed to non-admin reads — only writes by members.
create table if not exists zentra_cancel_feedback (
  id          uuid        primary key default gen_random_uuid(),
  account_id  uuid        not null references zentra_accounts(id) on delete cascade,
  user_id     uuid,
  reason      text        not null,
  detail      text,
  action      text        not null check (action in ('pause','cancel','kept')),
  created_at  timestamptz not null default now()
);
alter table zentra_cancel_feedback enable row level security;
create policy "members can insert feedback" on zentra_cancel_feedback
  for insert with check (zentra_is_account_member(account_id));
create index on zentra_cancel_feedback (account_id, created_at desc);

-- ── Monthly recap email opt-in ─────────────────────────────────────────────
-- Default true on signup. Users can opt out from /settings/account.
alter table zentra_accounts
  add column if not exists monthly_recap_emails boolean not null default true;
