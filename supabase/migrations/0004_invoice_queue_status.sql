-- Add queue status to invoices for the active/waiting slot mechanic.
-- queue_status tracks whether an invoice is visible in the active chase queue
-- or is stored but waiting for a slot to free up.
-- promoted_at records when a waiting invoice was promoted to active.
-- source_batch_id already covers import_id — no duplicate column needed.

ALTER TABLE zentra_invoices
  ADD COLUMN IF NOT EXISTS queue_status text NOT NULL DEFAULT 'active'
    CONSTRAINT zentra_invoices_queue_status_check
    CHECK (queue_status IN ('active', 'waiting', 'paid', 'dismissed', 'archived')),
  ADD COLUMN IF NOT EXISTS promoted_at timestamptz;

CREATE INDEX IF NOT EXISTS zentra_invoices_queue_status_idx
  ON zentra_invoices (account_id, queue_status);
