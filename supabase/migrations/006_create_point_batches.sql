-- 006_create_point_batches.sql — MIGRATION_PLAN.md §4.2
-- One row per weekly Excel upload. raw_rows holds the parsed preview so commit
-- can award without re-parsing. Also wires point_transactions.source_batch_id
-- now that point_batches exists (FK forced late by file order).

CREATE TABLE point_batches (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  uploaded_by    uuid NOT NULL REFERENCES admin_users(id) ON DELETE RESTRICT, -- preserve audit: can't delete an admin who uploaded batches
  file_name      text NOT NULL,
  file_sha256    text NOT NULL,
  week_start     date NOT NULL,
  week_end       date NOT NULL,
  status         batch_status NOT NULL DEFAULT 'draft',
  total_rows     integer NOT NULL DEFAULT 0,
  valid_rows     integer NOT NULL DEFAULT 0,
  invalid_rows   integer NOT NULL DEFAULT 0,
  unmatched_rows integer NOT NULL DEFAULT 0,
  total_points   integer NOT NULL DEFAULT 0,
  raw_rows       jsonb   NOT NULL DEFAULT '[]',
  committed_at   timestamptz,
  reviewed_by    uuid REFERENCES admin_users(id) ON DELETE SET NULL, -- keep review record, forget actor
  reviewed_at    timestamptz,
  review_note    text,
  voided_by      uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  voided_at      timestamptz,
  void_reason    text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CHECK (week_end >= week_start)
);

-- Block re-uploading the same file (unless a previous upload was voided).
CREATE UNIQUE INDEX point_batches_file_hash_idx
  ON point_batches (file_sha256) WHERE status <> 'voided';

-- Wire the deferred FK from 002. RESTRICT: batches are voided, never deleted,
-- so a batch referenced by a transaction must not be hard-deleted (traceability).
ALTER TABLE point_transactions
  ADD CONSTRAINT point_transactions_source_batch_id_fkey
  FOREIGN KEY (source_batch_id) REFERENCES point_batches(id) ON DELETE RESTRICT;
