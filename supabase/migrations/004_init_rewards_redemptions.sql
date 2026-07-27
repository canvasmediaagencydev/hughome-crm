-- 004_init_rewards_redemptions.sql — MIGRATION_PLAN.md §4.1
-- Δ redemptions vs old: status uses new redemption_status enum; added
-- pickup_code / delivered_at / delivered_by; dropped shipping_address /
-- tracking_number (pickup at store only).

CREATE TABLE rewards (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name           text NOT NULL,
  description    text,
  points_cost    integer NOT NULL CHECK (points_cost > 0),
  category       text,
  image_url      text,
  stock_quantity integer,                          -- null = unlimited
  is_active      boolean NOT NULL DEFAULT true,
  is_archived    boolean NOT NULL DEFAULT false,
  sort_order     integer,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CHECK (stock_quantity IS NULL OR stock_quantity >= 0)
);

CREATE TABLE redemptions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES user_profiles(id) ON DELETE RESTRICT, -- keep redemption history; never orphan a redemption
  reward_id    uuid NOT NULL REFERENCES rewards(id) ON DELETE RESTRICT,       -- can't delete a reward that was redeemed (audit)
  points_used  integer NOT NULL CHECK (points_used > 0),
  quantity     integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  status       redemption_status NOT NULL DEFAULT 'requested',
  pickup_code  text,                                                          -- QR at store → delivered
  processed_by uuid REFERENCES admin_users(id) ON DELETE SET NULL,            -- keep record, forget actor
  processed_at timestamptz,
  delivered_by uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  delivered_at timestamptz,
  admin_notes  text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX redemptions_user_idx   ON redemptions (user_id, created_at DESC);
CREATE INDEX redemptions_status_idx ON redemptions (status);
