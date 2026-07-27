-- 007_create_point_batch_ledger.sql — MIGRATION_PLAN.md §4.2
-- Heart of step-wise expiry: one ledger lot per user per batch, each with its
-- own expires_at. FIFO deduction on redeem. Invariant:
--   user_profiles.points_balance == SUM(points_remaining)  (reconciled daily, §9.2)

CREATE TABLE point_batch_ledger (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES user_profiles(id) ON DELETE RESTRICT, -- never delete a user holding points
  source_batch_id  uuid REFERENCES point_batches(id) ON DELETE RESTRICT,          -- lot traces to its batch; batches are voided not deleted
  source           text NOT NULL DEFAULT 'batch' CHECK (source IN ('batch', 'manual')),
  points_earned    integer NOT NULL CHECK (points_earned > 0),
  points_remaining integer NOT NULL CHECK (points_remaining >= 0),
  earned_month     date NOT NULL,        -- 1st of the month the points were earned
  expires_at       date NOT NULL,        -- (last day of earned_month) + 365 days
  gross_amount     numeric(12,2),
  discount_amount  numeric(12,2),
  net_amount       numeric(12,2),
  promo_code_id    uuid REFERENCES promo_codes(id) ON DELETE SET NULL, -- keep the lot, forget the promo link
  multiplier       numeric(4,2) NOT NULL DEFAULT 1,
  created_at       timestamptz NOT NULL DEFAULT now(),
  CHECK (points_remaining <= points_earned)
);

-- FIFO scan: active lots for a user ordered by soonest expiry.
CREATE INDEX pbl_fifo_idx   ON point_batch_ledger (user_id, expires_at) WHERE points_remaining > 0;
-- Expiry sweep: all lots expiring, regardless of user.
CREATE INDEX pbl_expiry_idx ON point_batch_ledger (expires_at)          WHERE points_remaining > 0;
