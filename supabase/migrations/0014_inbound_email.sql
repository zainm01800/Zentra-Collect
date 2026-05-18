-- Migration 0014: Inbound email classification
-- Adds two tables:
--   zentra_inbound_settings  — per-account config for both inbound methods
--   zentra_inbound_replies   — classified debtor replies received via either method

-- ── Inbound email settings ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS zentra_inbound_settings (
  account_id            UUID        PRIMARY KEY REFERENCES zentra_accounts(id) ON DELETE CASCADE,

  -- Method A: Forward-to-classify (unique inbound address per account)
  inbound_token         TEXT        NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  forward_enabled       BOOLEAN     NOT NULL DEFAULT false,

  -- Method B: IMAP / Gmail App Password
  imap_enabled          BOOLEAN     NOT NULL DEFAULT false,
  imap_email            TEXT,
  imap_host             TEXT,
  imap_port             INTEGER     DEFAULT 993,
  imap_tls              BOOLEAN     NOT NULL DEFAULT true,
  imap_password_enc     TEXT,       -- AES-256-GCM encrypted, same key as SMTP passwords
  imap_last_polled_at   TIMESTAMPTZ,
  imap_last_uid         BIGINT      DEFAULT 0,  -- highest UID seen, avoids reprocessing

  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Classified inbound replies ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS zentra_inbound_replies (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id              UUID        NOT NULL REFERENCES zentra_accounts(id) ON DELETE CASCADE,

  -- Email provenance
  from_email              TEXT,
  from_name               TEXT,
  subject                 TEXT,
  received_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  source                  TEXT        NOT NULL CHECK (source IN ('imap', 'webhook', 'manual')),

  -- Invoice matching
  matched_invoice_id      TEXT,       -- invoice ID if matched
  matched_customer_name   TEXT,
  match_method            TEXT        CHECK (match_method IN ('email_exact', 'email_fuzzy', 'unmatched')),

  -- Classification result (mirrors ReplyClassificationResult)
  classification          TEXT        NOT NULL,
  confidence              TEXT        NOT NULL CHECK (confidence IN ('high', 'medium', 'low')),
  reason                  TEXT,
  suggested_next_action   TEXT,
  suggested_status_update TEXT,
  extracted_promise_date  TEXT,
  extracted_promise_amount NUMERIC,
  extracted_dispute_reason TEXT,
  requires_manual_review  BOOLEAN     NOT NULL DEFAULT true,
  classifier_source       TEXT        CHECK (classifier_source IN ('rules', 'ai', 'manual_review')),

  -- User action
  reviewed_at             TIMESTAMPTZ,
  dismissed               BOOLEAN     NOT NULL DEFAULT false,

  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_inbound_replies_account     ON zentra_inbound_replies (account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inbound_replies_invoice     ON zentra_inbound_replies (matched_invoice_id) WHERE matched_invoice_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inbound_replies_unreviewed  ON zentra_inbound_replies (account_id) WHERE reviewed_at IS NULL AND dismissed = false;

-- RLS: account members can only see their own replies
ALTER TABLE zentra_inbound_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE zentra_inbound_replies   ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_own_inbound_settings" ON zentra_inbound_settings
  FOR ALL USING (
    account_id IN (
      SELECT account_id FROM zentra_account_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "members_own_inbound_replies" ON zentra_inbound_replies
  FOR ALL USING (
    account_id IN (
      SELECT account_id FROM zentra_account_members WHERE user_id = auth.uid()
    )
  );
