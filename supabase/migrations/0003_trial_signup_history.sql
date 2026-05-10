-- ─────────────────────────────────────────────────────────────────────────────
-- Trial signup history — anti-abuse
--
-- Tracks every successful trial signup so we can enforce:
--   1. One trial per email address every 30 days
--   2. Max 3 trials per (hashed) IP every 30 days
--   3. Disposable-domain rejections happen *before* this table is touched
--
-- Why a dedicated table (not just auth.users):
--   - We need to record IP hash separately from the user record (auth.users
--     doesn't expose the originating IP cleanly).
--   - We may want to keep a record AFTER an account is deleted so the user
--     can't immediately re-trial under the same email.
--   - We want to query without ever exposing the actual IP — only its salted
--     hash (computed in src/lib/anti-abuse.ts via SHA-256 + IP_HASH_SALT).
--
-- Lookup pattern: filter by lower(email) OR by ip_hash, both bounded by
-- created_at >= now() - 30 days. The two indexes below cover both paths.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.trial_signup_history (
  id uuid primary key default gen_random_uuid(),
  email text not null,                          -- lowercased before insert
  ip_hash text not null,                        -- SHA-256(ip + IP_HASH_SALT), first 24 chars
  business_domain text,                         -- everything after the @
  business_name text,                           -- so support can de-dupe by hand
  user_agent text,                              -- diagnostic only
  created_at timestamptz not null default now()
);

-- Email lookup: "has this email started a trial in the last 30 days?"
create index if not exists trial_signup_history_email_created_idx
  on public.trial_signup_history (lower(email), created_at desc);

-- IP lookup: "how many trials has this network started in the last 30 days?"
create index if not exists trial_signup_history_iphash_created_idx
  on public.trial_signup_history (ip_hash, created_at desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS policies
--
-- Only the service-role key can read/write this table. End users (anon /
-- authenticated) should never see it. The trial-check API route runs
-- server-side with the service-role key, so it bypasses RLS anyway — but
-- enable it as defence-in-depth in case the table is ever queried from a
-- normal client context.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.trial_signup_history enable row level security;

drop policy if exists trial_signup_history_no_anon_read on public.trial_signup_history;
create policy trial_signup_history_no_anon_read
  on public.trial_signup_history
  for select
  to anon, authenticated
  using (false);

drop policy if exists trial_signup_history_no_anon_write on public.trial_signup_history;
create policy trial_signup_history_no_anon_write
  on public.trial_signup_history
  for insert
  to anon, authenticated
  with check (false);

-- ─────────────────────────────────────────────────────────────────────────────
-- Optional housekeeping: drop rows older than 90 days. The 30-day window above
-- is the live anti-abuse rule; we keep an extra 60 days for support/audit
-- before pruning. Run this manually or via pg_cron.
-- ─────────────────────────────────────────────────────────────────────────────

-- Example pg_cron job (uncomment + run once if pg_cron is enabled):
--   select cron.schedule(
--     'prune_trial_signup_history',
--     '0 3 * * *',
--     $$delete from public.trial_signup_history where created_at < now() - interval '90 days'$$
--   );
