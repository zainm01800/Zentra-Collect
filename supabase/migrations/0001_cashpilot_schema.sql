create table if not exists public.users (
  id uuid primary key,
  email text not null unique,
  full_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  sender_name text,
  reply_to_email text,
  xero_tenant_id text,
  stripe_customer_id text,
  created_at timestamptz not null default now()
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  xero_contact_id text,
  name text not null,
  email text,
  phone text,
  preferred_contact_name text,
  escalation_contact_email text,
  relationship_type text not null default 'regular client',
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  xero_invoice_id text,
  invoice_number text not null,
  amount numeric(12, 2) not null,
  currency text not null default 'GBP',
  issue_date date not null,
  due_date date not null,
  status text not null default 'Not due',
  last_chased_at timestamptz,
  follow_up_date date,
  promised_payment_date date,
  chase_count integer not null default 0,
  payment_link text,
  notes text,
  line_items jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reminder_templates (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  tone text not null,
  subject text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.reminder_activity (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  activity_type text not null,
  title text not null,
  description text,
  email_subject text,
  email_body text,
  created_at timestamptz not null default now()
);

create table if not exists public.settings (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  default_tone text not null default 'Neutral',
  payment_terms text not null default '14 days',
  late_fee_enabled boolean not null default false,
  default_reminder_schedule text not null default '3, 10, 24, 45 days overdue',
  brand_voice_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists invoices_business_due_date_idx
  on public.invoices (business_id, due_date);

create index if not exists invoices_business_status_idx
  on public.invoices (business_id, status);

create index if not exists reminder_activity_invoice_idx
  on public.reminder_activity (invoice_id, created_at desc);
