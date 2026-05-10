-- Auto-send email settings per account
CREATE TABLE IF NOT EXISTS zentra_email_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id text NOT NULL UNIQUE,
  smtp_host text NOT NULL,
  smtp_port integer NOT NULL DEFAULT 587,
  smtp_user text NOT NULL,
  -- encrypted at rest via Supabase vault; never returned to client
  smtp_password_enc text NOT NULL,
  from_name text NOT NULL DEFAULT 'Zentra Collect',
  is_enabled boolean NOT NULL DEFAULT false,
  armed_at timestamptz,
  -- send rules
  send_hour_utc integer NOT NULL DEFAULT 9 CHECK (send_hour_utc BETWEEN 0 AND 23),
  send_days text NOT NULL DEFAULT '1,2,3,4,5', -- comma-separated ISO weekday (1=Mon)
  max_per_run integer NOT NULL DEFAULT 5,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Log every send attempt (success or failure)
CREATE TABLE IF NOT EXISTS zentra_email_send_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id text NOT NULL,
  invoice_id text NOT NULL,
  to_email text NOT NULL,
  subject text NOT NULL,
  status text NOT NULL CHECK (status IN ('sent', 'failed', 'skipped')),
  error_message text,
  sent_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS zentra_email_send_log_account_idx
  ON zentra_email_send_log (account_id, sent_at DESC);

CREATE INDEX IF NOT EXISTS zentra_email_send_log_invoice_idx
  ON zentra_email_send_log (invoice_id);
