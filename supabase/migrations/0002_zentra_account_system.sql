-- Zentra Collect production-ready account/import schema.
-- This migration intentionally uses zentra_* table names so it can coexist
-- with the earlier CashPilot-era MVP schema while the app is migrated.

create extension if not exists pgcrypto;

create table if not exists public.zentra_accounts (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  plan_id text not null check (
    plan_id in (
      'DEMO',
      'TRIAL',
      'FOUNDING_SINGLE',
      'FOUNDING_BOOKKEEPER',
      'SINGLE_BUSINESS',
      'BOOKKEEPER_STARTER',
      'BOOKKEEPER_PRO'
    )
  ),
  status text not null default 'demo' check (
    status in ('demo', 'trialing', 'active', 'beta', 'expired', 'cancelled')
  ),
  trial_started_at timestamptz,
  trial_ends_at timestamptz,
  grace_period_ends_at timestamptz,
  current_period_started_at timestamptz not null default now(),
  stripe_customer_id text,
  stripe_subscription_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.zentra_account_members (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.zentra_accounts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'member', 'viewer')),
  created_at timestamptz not null default now(),
  unique (account_id, user_id)
);

create table if not exists public.zentra_businesses (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.zentra_accounts(id) on delete cascade,
  name text not null,
  trading_name text,
  business_type text not null default 'service_business' check (
    business_type in ('agency', 'consultancy', 'service_business', 'bookkeeping_practice')
  ),
  registered_country text not null default 'UK',
  default_currency text not null default 'GBP',
  contact_email text,
  sender_name text,
  reply_to_email text,
  payment_terms_days integer not null default 14,
  brand_voice_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.zentra_bookkeeper_clients (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.zentra_accounts(id) on delete cascade,
  bookkeeper_business_id uuid references public.zentra_businesses(id) on delete cascade,
  client_business_id uuid not null references public.zentra_businesses(id) on delete cascade,
  portfolio_label text,
  primary_contact_name text,
  primary_contact_email text,
  import_alias text,
  last_import_batch_id uuid,
  notes text,
  created_at timestamptz not null default now(),
  unique (account_id, client_business_id)
);

create table if not exists public.zentra_customers (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.zentra_accounts(id) on delete cascade,
  business_id uuid not null references public.zentra_businesses(id) on delete cascade,
  name text not null,
  email text,
  contact_name text,
  contact_role text,
  ap_email text,
  ap_contact_name text,
  relationship_type text not null default 'regular customer',
  customer_notes text,
  do_not_chase boolean not null default false,
  external_customer_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.zentra_import_batches (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.zentra_accounts(id) on delete cascade,
  business_id uuid not null references public.zentra_businesses(id) on delete cascade,
  bookkeeper_client_id uuid references public.zentra_bookkeeper_clients(id) on delete set null,
  source text not null check (source in ('demo', 'csv', 'excel')),
  file_name text not null,
  file_hash text,
  imported_by uuid references auth.users(id) on delete set null,
  row_count integer not null default 0,
  valid_invoice_count integer not null default 0,
  warning_count integer not null default 0,
  status text not null default 'completed' check (
    status in ('uploaded', 'mapped', 'validated', 'completed', 'failed')
  ),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.zentra_import_mappings (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.zentra_accounts(id) on delete cascade,
  batch_id uuid not null references public.zentra_import_batches(id) on delete cascade,
  source_column text not null,
  target_field text not null,
  confidence text not null check (confidence in ('high', 'medium', 'low')),
  reviewed_by_user boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.zentra_import_diffs (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.zentra_accounts(id) on delete cascade,
  current_batch_id uuid not null references public.zentra_import_batches(id) on delete cascade,
  previous_batch_id uuid references public.zentra_import_batches(id) on delete set null,
  invoice_id uuid,
  customer_id uuid,
  diff_type text not null,
  title text not null,
  description text not null,
  before_value jsonb,
  after_value jsonb,
  severity text not null default 'info' check (severity in ('info', 'attention', 'important')),
  created_at timestamptz not null default now()
);

create table if not exists public.zentra_invoices (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.zentra_accounts(id) on delete cascade,
  business_id uuid not null references public.zentra_businesses(id) on delete cascade,
  bookkeeper_client_id uuid references public.zentra_bookkeeper_clients(id) on delete set null,
  customer_id uuid not null references public.zentra_customers(id) on delete cascade,
  source_batch_id uuid references public.zentra_import_batches(id) on delete set null,
  imported_row_number integer,
  invoice_number text not null,
  invoice_date date,
  due_date date,
  amount numeric(12, 2) not null default 0,
  amount_outstanding numeric(12, 2) not null default 0,
  currency text not null default 'GBP',
  status text not null,
  previous_chase_count integer not null default 0,
  last_chased_date date,
  promised_payment_date date,
  dispute_reason text,
  payment_claimed boolean not null default false,
  remittance_needed boolean not null default false,
  statement_needed boolean not null default false,
  customer_notes text,
  line_items jsonb not null default '[]'::jsonb,
  external_invoice_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, business_id, invoice_number)
);

create table if not exists public.zentra_promises_to_pay (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.zentra_accounts(id) on delete cascade,
  invoice_id uuid not null references public.zentra_invoices(id) on delete cascade,
  promised_amount numeric(12, 2) not null,
  promised_date date not null,
  promised_by text,
  recorded_by uuid references auth.users(id) on delete set null,
  status text not null default 'open' check (status in ('open', 'met', 'missed', 'cancelled')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.zentra_disputes (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.zentra_accounts(id) on delete cascade,
  invoice_id uuid not null references public.zentra_invoices(id) on delete cascade,
  reason text not null,
  raised_by text,
  owner text,
  status text not null default 'open' check (
    status in ('open', 'waiting_on_customer', 'waiting_on_business', 'resolved')
  ),
  next_resolution_date date,
  resolution_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.zentra_activity_events (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.zentra_accounts(id) on delete cascade,
  business_id uuid references public.zentra_businesses(id) on delete cascade,
  invoice_id uuid references public.zentra_invoices(id) on delete cascade,
  customer_id uuid references public.zentra_customers(id) on delete cascade,
  event_type text not null,
  title text not null,
  description text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.zentra_draft_logs (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.zentra_accounts(id) on delete cascade,
  invoice_id uuid references public.zentra_invoices(id) on delete set null,
  scenario text not null,
  tone text not null,
  provider text not null default 'template',
  subject text,
  body text,
  risk_notes text,
  confidence text,
  requires_review boolean not null default true,
  copied_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.zentra_usage_events (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.zentra_accounts(id) on delete cascade,
  event_type text not null,
  usage_type text,
  quantity integer not null default 1,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.zentra_usage_rollups (
  account_id uuid not null references public.zentra_accounts(id) on delete cascade,
  period_start date not null,
  imports_used_this_month integer not null default 0,
  ai_actions_used_this_month integer not null default 0,
  active_invoice_count integer not null default 0,
  client_ledger_count integer not null default 0,
  saved_import_mapping_count integer not null default 0,
  weekly_digest_count_this_month integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (account_id, period_start)
);

create table if not exists public.zentra_beta_access_requests (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  business_name text not null,
  is_bookkeeper boolean not null default false,
  client_ledgers_managed integer,
  accounting_software text,
  approximate_invoices_per_month text,
  biggest_ar_pain text,
  would_upload_sample_file boolean,
  would_pay_founding_pricing text,
  optional_message text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'contacted')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null
);

create table if not exists public.zentra_oauth_connections (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.zentra_accounts(id) on delete cascade,
  business_id uuid references public.zentra_businesses(id) on delete cascade,
  provider text not null check (provider in ('xero', 'quickbooks', 'freeagent', 'sage')),
  provider_tenant_id text,
  encrypted_access_token text,
  encrypted_refresh_token text,
  scopes text[],
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, provider, provider_tenant_id)
);

create index if not exists zentra_account_members_user_idx
  on public.zentra_account_members (user_id);

create index if not exists zentra_businesses_account_idx
  on public.zentra_businesses (account_id);

create index if not exists zentra_customers_business_idx
  on public.zentra_customers (business_id, name);

create index if not exists zentra_invoices_account_due_idx
  on public.zentra_invoices (account_id, due_date);

create index if not exists zentra_invoices_customer_status_idx
  on public.zentra_invoices (customer_id, status);

create index if not exists zentra_activity_invoice_idx
  on public.zentra_activity_events (invoice_id, created_at desc);

create index if not exists zentra_usage_events_account_idx
  on public.zentra_usage_events (account_id, created_at desc);

alter table public.zentra_accounts enable row level security;
alter table public.zentra_account_members enable row level security;
alter table public.zentra_businesses enable row level security;
alter table public.zentra_bookkeeper_clients enable row level security;
alter table public.zentra_customers enable row level security;
alter table public.zentra_import_batches enable row level security;
alter table public.zentra_import_mappings enable row level security;
alter table public.zentra_import_diffs enable row level security;
alter table public.zentra_invoices enable row level security;
alter table public.zentra_promises_to_pay enable row level security;
alter table public.zentra_disputes enable row level security;
alter table public.zentra_activity_events enable row level security;
alter table public.zentra_draft_logs enable row level security;
alter table public.zentra_usage_events enable row level security;
alter table public.zentra_usage_rollups enable row level security;
alter table public.zentra_beta_access_requests enable row level security;
alter table public.zentra_oauth_connections enable row level security;

create or replace function public.zentra_is_account_member(target_account_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.zentra_account_members
    where account_id = target_account_id
      and user_id = auth.uid()
  );
$$;

create policy "members can read accounts"
  on public.zentra_accounts
  for select
  using (public.zentra_is_account_member(id));

create policy "users can create owned accounts"
  on public.zentra_accounts
  for insert
  with check (owner_user_id = auth.uid());

create policy "owners can update accounts"
  on public.zentra_accounts
  for update
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

create policy "members can read memberships"
  on public.zentra_account_members
  for select
  using (public.zentra_is_account_member(account_id));

create policy "owners can add memberships"
  on public.zentra_account_members
  for insert
  with check (
    user_id = auth.uid()
    or exists (
      select 1 from public.zentra_accounts
      where id = account_id and owner_user_id = auth.uid()
    )
  );

create policy "members can access businesses"
  on public.zentra_businesses
  for all
  using (public.zentra_is_account_member(account_id))
  with check (public.zentra_is_account_member(account_id));

create policy "members can access bookkeeper clients"
  on public.zentra_bookkeeper_clients
  for all
  using (public.zentra_is_account_member(account_id))
  with check (public.zentra_is_account_member(account_id));

create policy "members can access customers"
  on public.zentra_customers
  for all
  using (public.zentra_is_account_member(account_id))
  with check (public.zentra_is_account_member(account_id));

create policy "members can access import batches"
  on public.zentra_import_batches
  for all
  using (public.zentra_is_account_member(account_id))
  with check (public.zentra_is_account_member(account_id));

create policy "members can access import mappings"
  on public.zentra_import_mappings
  for all
  using (public.zentra_is_account_member(account_id))
  with check (public.zentra_is_account_member(account_id));

create policy "members can access import diffs"
  on public.zentra_import_diffs
  for all
  using (public.zentra_is_account_member(account_id))
  with check (public.zentra_is_account_member(account_id));

create policy "members can access invoices"
  on public.zentra_invoices
  for all
  using (public.zentra_is_account_member(account_id))
  with check (public.zentra_is_account_member(account_id));

create policy "members can access promises"
  on public.zentra_promises_to_pay
  for all
  using (public.zentra_is_account_member(account_id))
  with check (public.zentra_is_account_member(account_id));

create policy "members can access disputes"
  on public.zentra_disputes
  for all
  using (public.zentra_is_account_member(account_id))
  with check (public.zentra_is_account_member(account_id));

create policy "members can access activity"
  on public.zentra_activity_events
  for all
  using (public.zentra_is_account_member(account_id))
  with check (public.zentra_is_account_member(account_id));

create policy "members can access draft logs"
  on public.zentra_draft_logs
  for all
  using (public.zentra_is_account_member(account_id))
  with check (public.zentra_is_account_member(account_id));

create policy "members can read usage events"
  on public.zentra_usage_events
  for select
  using (public.zentra_is_account_member(account_id));

create policy "members can read usage rollups"
  on public.zentra_usage_rollups
  for select
  using (public.zentra_is_account_member(account_id));

create policy "anyone can request beta access"
  on public.zentra_beta_access_requests
  for insert
  with check (true);

create policy "members can access oauth connections"
  on public.zentra_oauth_connections
  for all
  using (public.zentra_is_account_member(account_id))
  with check (public.zentra_is_account_member(account_id));
