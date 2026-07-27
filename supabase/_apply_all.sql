-- =============================================================================
-- _apply_all.sql — HugHome CRM Pilot · รวม migration 001–012 + seed tenant_code
-- สร้างอัตโนมัติจาก supabase/migrations/0??_*.sql (อย่าแก้ไฟล์นี้มือ — แก้ที่ migration ต้นทาง)
-- วิธี apply: Supabase Dashboard → SQL Editor → New query → วางทั้งไฟล์ → Run
-- =============================================================================


-- ═══════════════════════════════════════════════════════════════════════════
-- ▶ FILE: 001_init_enums.sql
-- ═══════════════════════════════════════════════════════════════════════════
-- 001_init_enums.sql — Phase 1 target enums (fresh DB, no ALTER TYPE needed)
-- MIGRATION_PLAN.md §4.3

-- Customer type (used by user_profiles.role)
CREATE TYPE user_role AS ENUM ('contractor', 'homeowner');

-- Points ledger movement type (carried from old system unchanged)
CREATE TYPE transaction_type AS ENUM ('earned', 'spent', 'expired', 'bonus', 'refund');

-- Redemption lifecycle — TARGET values (differs from old system which used
-- 'processing'/'shipped'; pickup-at-store only, so no shipping states).
CREATE TYPE redemption_status AS ENUM ('requested', 'approved', 'ready', 'delivered', 'cancelled');

-- Weekly batch upload lifecycle
CREATE TYPE batch_status AS ENUM ('draft', 'previewed', 'committed', 'voided');


-- ═══════════════════════════════════════════════════════════════════════════
-- ▶ FILE: 002_init_core_tables.sql
-- ═══════════════════════════════════════════════════════════════════════════
-- 002_init_core_tables.sql — MIGRATION_PLAN.md §4.1
-- Core tables carried from the old system, adjusted to the target shape.
-- NOTE on FK ordering: some columns reference tables created later
-- (admin_users → 003, point_batches → 006). Those FK constraints are added
-- in the migration where the target table exists. Columns are created here.

-- ---------------------------------------------------------------------------
-- app_config — instance-level config (key/value TEXT).
-- Holds tenant_code so the app can verify at boot that the connected DB matches
-- NEXT_PUBLIC_TENANT_CODE (MIGRATION_PLAN.md §9.1). Kept SEPARATE from
-- point_settings (which is numeric-only) to avoid mixing text/number and to
-- keep it out of the point-settings admin UI. Value is set PER INSTANCE by a
-- manual seed (see supabase/README.md) — never hardcoded in a shared migration.
-- ---------------------------------------------------------------------------
CREATE TABLE app_config (
  key        text PRIMARY KEY,
  value      text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- user_profiles — one row per LINE user.
-- Δ vs old: birthday NOT NULL (§4.1); role uses user_role enum; dropped
-- points_expire_at (replaced by point_batch_ledger) and legacy counters/flags
-- not in the new model.
-- ---------------------------------------------------------------------------
CREATE TABLE user_profiles (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  line_user_id   text UNIQUE NOT NULL,
  role           user_role,                       -- null until onboarding sets it
  first_name     text,
  last_name      text,
  display_name   text,
  picture_url    text,
  phone          text UNIQUE,                      -- batch upload matches by phone → unique
  birthday       date NOT NULL,                    -- required from day one (§4.1)
  customer_code  text,
  points_balance integer NOT NULL DEFAULT 0,       -- authoritative; invariant = SUM(ledger.points_remaining)
  last_login_at  timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CHECK (points_balance >= 0)
);

-- ---------------------------------------------------------------------------
-- point_settings — numeric key/value config (unchanged structure).
-- e.g. row setting_key='baht_per_point'. created_by/updated_by are audit-only
-- uuids WITHOUT an FK (matches the old system; keeps this table admin-table-free).
-- ---------------------------------------------------------------------------
CREATE TABLE point_settings (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key   text UNIQUE NOT NULL,
  setting_value numeric NOT NULL,
  description   text,
  is_active     boolean NOT NULL DEFAULT true,
  created_by    uuid,
  updated_by    uuid,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Core default (instance-agnostic; admin can edit via /admin/point-settings).
INSERT INTO point_settings (setting_key, setting_value, description)
VALUES ('baht_per_point', 100, 'จำนวนบาทต่อ 1 แต้ม (net / baht_per_point)');

-- ---------------------------------------------------------------------------
-- point_transactions — audit ledger of every points movement.
-- Δ vs old: added source + source_batch_id; dropped reference_id/reference_type.
-- `points` is signed (+earned, −spent/expired). balance_after = snapshot.
-- FK source_batch_id → point_batches added in 006 (ordering).
-- created_by → admin_users added in 003 (ordering).
-- ---------------------------------------------------------------------------
CREATE TABLE point_transactions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES user_profiles(id) ON DELETE RESTRICT, -- never delete a user with history (audit + points integrity)
  type            transaction_type NOT NULL,
  points          integer NOT NULL,
  balance_after   integer NOT NULL,
  source          text NOT NULL CHECK (source IN ('batch', 'redemption', 'expiry', 'manual')),
  source_batch_id uuid,   -- FK added in 006
  description     text,
  created_by      uuid,   -- admin_users(id) for manual; FK added in 003
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX point_transactions_user_idx ON point_transactions (user_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- tags + user_tags — customer segmentation.
-- tags.created_by → admin_users (FK added in 003).
-- ---------------------------------------------------------------------------
CREATE TABLE tags (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name             text NOT NULL,
  color            text NOT NULL DEFAULT '#999999',
  line_audience_id bigint,
  created_by       uuid,   -- FK added in 003
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE user_tags (
  user_id     uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE, -- tag link is meaningless once the user is gone
  tag_id      uuid NOT NULL REFERENCES tags(id) ON DELETE CASCADE,          -- removing a tag unassigns it everywhere
  assigned_by uuid,   -- admin_users(id); FK added in 003
  assigned_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, tag_id)
);

-- ---------------------------------------------------------------------------
-- user_notes — free-text admin notes on a user.
-- created_by_admin_id → admin_users (FK added in 003).
-- ---------------------------------------------------------------------------
CREATE TABLE user_notes (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE, -- notes belong to the user; gone with them
  note_content        text NOT NULL,
  created_by_admin_id uuid,   -- FK added in 003
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX user_notes_user_idx ON user_notes (user_id);


-- ═══════════════════════════════════════════════════════════════════════════
-- ▶ FILE: 003_init_admin_rbac.sql
-- ═══════════════════════════════════════════════════════════════════════════
-- 003_init_admin_rbac.sql — MIGRATION_PLAN.md §4.1, §7
-- Admin RBAC, fully separate from LINE users. Also wires the admin-actor FKs
-- for columns created in 002 (point_transactions.created_by, tags.created_by,
-- user_tags.assigned_by, user_notes.created_by_admin_id) now that admin_users
-- exists. These ADD CONSTRAINTs are FK wiring forced by the file order
-- (core 002 before admin 003), not data migration.

CREATE TABLE admin_users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id  uuid UNIQUE NOT NULL,          -- Supabase auth.users id
  email         text UNIQUE NOT NULL,
  full_name     text,
  is_active     boolean NOT NULL DEFAULT true,
  last_login_at timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE admin_roles (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text UNIQUE NOT NULL,           -- 'super_admin', 'manager', ...
  display_name text NOT NULL,
  description  text,
  is_system    boolean NOT NULL DEFAULT false, -- system roles can't be deleted via UI
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE admin_permissions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  permission_key text UNIQUE NOT NULL,         -- 'batches.commit', ...
  category     text NOT NULL,
  display_name text NOT NULL,
  description  text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE admin_role_permissions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id       uuid NOT NULL REFERENCES admin_roles(id) ON DELETE CASCADE,        -- drop mappings with the role
  permission_id uuid NOT NULL REFERENCES admin_permissions(id) ON DELETE CASCADE,  -- drop mappings with the permission
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (role_id, permission_id)
);

CREATE TABLE admin_user_roles (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,  -- drop role links with the admin
  role_id       uuid NOT NULL REFERENCES admin_roles(id) ON DELETE CASCADE,  -- drop links when the role is removed
  assigned_by   uuid REFERENCES admin_users(id) ON DELETE SET NULL,          -- keep the assignment, forget who assigned
  assigned_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (admin_user_id, role_id)
);

-- --- Wire admin-actor FKs for 002 columns (ON DELETE SET NULL: keep the row,
-- --- drop the actor link when the admin is deleted) ------------------------
ALTER TABLE point_transactions
  ADD CONSTRAINT point_transactions_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES admin_users(id) ON DELETE SET NULL;

ALTER TABLE tags
  ADD CONSTRAINT tags_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES admin_users(id) ON DELETE SET NULL;

ALTER TABLE user_tags
  ADD CONSTRAINT user_tags_assigned_by_fkey
  FOREIGN KEY (assigned_by) REFERENCES admin_users(id) ON DELETE SET NULL;

ALTER TABLE user_notes
  ADD CONSTRAINT user_notes_created_by_admin_id_fkey
  FOREIGN KEY (created_by_admin_id) REFERENCES admin_users(id) ON DELETE SET NULL;


-- ═══════════════════════════════════════════════════════════════════════════
-- ▶ FILE: 004_init_rewards_redemptions.sql
-- ═══════════════════════════════════════════════════════════════════════════
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


-- ═══════════════════════════════════════════════════════════════════════════
-- ▶ FILE: 005_create_promo_codes.sql
-- ═══════════════════════════════════════════════════════════════════════════
-- 005_create_promo_codes.sql — MIGRATION_PLAN.md §4.2
-- Promo codes are keyed by sales staff in the Excel batch (never by customers).

CREATE TABLE promo_codes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code        text UNIQUE NOT NULL,
  name        text NOT NULL,
  description text,
  multiplier  numeric(4,2) NOT NULL CHECK (multiplier > 0),
  starts_at   timestamptz NOT NULL,
  expires_at  timestamptz NOT NULL,
  max_uses    integer CHECK (max_uses IS NULL OR max_uses > 0),
  usage_count integer NOT NULL DEFAULT 0 CHECK (usage_count >= 0),
  is_active   boolean NOT NULL DEFAULT true,      -- soft-delete flag (Sprint 6)
  created_by  uuid REFERENCES admin_users(id) ON DELETE SET NULL, -- keep the promo, forget creator
  created_at  timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_at > starts_at)
);

-- Case-insensitive uniqueness (matching is case-insensitive, §12).
CREATE UNIQUE INDEX promo_codes_code_upper_idx ON promo_codes (upper(code));


-- ═══════════════════════════════════════════════════════════════════════════
-- ▶ FILE: 006_create_point_batches.sql
-- ═══════════════════════════════════════════════════════════════════════════
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


-- ═══════════════════════════════════════════════════════════════════════════
-- ▶ FILE: 007_create_point_batch_ledger.sql
-- ═══════════════════════════════════════════════════════════════════════════
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


-- ═══════════════════════════════════════════════════════════════════════════
-- ▶ FILE: 008_create_notification_channels.sql
-- ═══════════════════════════════════════════════════════════════════════════
-- 008_create_notification_channels.sql — MIGRATION_PLAN.md §4.2
-- Telegram / LINE group push targets for team alerts (used from Sprint 8).
-- `token` is a full credential → must be stored/handled carefully (§9.5).

CREATE TABLE notification_channels (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type       text NOT NULL CHECK (type IN ('telegram', 'line_group')),
  token      text,
  target_id  text NOT NULL,
  events     text[] NOT NULL DEFAULT ARRAY['redemption.created'],
  is_active  boolean NOT NULL DEFAULT true,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);


-- ═══════════════════════════════════════════════════════════════════════════
-- ▶ FILE: 009_create_line_quota_cache.sql
-- ═══════════════════════════════════════════════════════════════════════════
-- 009_create_line_quota_cache.sql — MIGRATION_PLAN.md §4.2
-- Single-row cache of LINE message quota (refreshed ~every 15 min, §6.2).
-- id is pinned to 1 so there is always exactly one row.

CREATE TABLE line_quota_cache (
  id          integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  quota_limit integer,
  consumed    integer,
  fetched_at  timestamptz NOT NULL DEFAULT now()
);


-- ═══════════════════════════════════════════════════════════════════════════
-- ▶ FILE: 010_rpc_points_functions.sql
-- ═══════════════════════════════════════════════════════════════════════════
-- 010_rpc_points_functions.sql — MIGRATION_PLAN.md §4.4
-- All money/points mutations go through these RPCs. Every function locks the
-- affected user_profiles row(s) FOR UPDATE before computing, is SECURITY
-- DEFINER, sets a fixed search_path, and is revoked from anon/authenticated
-- (only service_role — used by the server — may execute).
--
-- Invariant kept everywhere: user_profiles.points_balance == SUM(point_batch_ledger.points_remaining)
--
-- Helper convention:
--   earned_month = 1st of the current month in Asia/Bangkok
--   expires_at   = (last day of earned_month) + 365 days   (§4.2)

-- ===========================================================================
-- award_points_from_batch(p_batch_id) → integer (total points awarded)
-- ---------------------------------------------------------------------------
-- raw_rows CONTRACT (produced by the Sprint 4 parser, stored at preview):
--   raw_rows is a JSON array; VALID+matched rows are objects with:
--     { "status":"valid", "user_id":<uuid>, "points":<int>0>,
--       "gross":<num>, "discount":<num>, "net":<num>,
--       "promo_code_id":<uuid|null>, "multiplier":<num> }
--   Rows without status='valid' (invalid/unmatched) are ignored here.
-- ===========================================================================
CREATE OR REPLACE FUNCTION award_points_from_batch(p_batch_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_batch        point_batches%ROWTYPE;
  v_earned_month date := date_trunc('month', (now() AT TIME ZONE 'Asia/Bangkok'))::date;
  v_expires_at   date := ((date_trunc('month', (now() AT TIME ZONE 'Asia/Bangkok'))::date + interval '1 month')::date - 1) + 365;
  v_row          jsonb;
  v_user_id      uuid;
  v_points       integer;
  v_promo        uuid;
  v_new_balance  integer;
  v_total        integer := 0;
BEGIN
  SELECT * INTO v_batch FROM point_batches WHERE id = p_batch_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'batch % not found', p_batch_id; END IF;
  IF v_batch.status <> 'previewed' THEN
    RAISE EXCEPTION 'batch % is % (must be previewed to commit)', p_batch_id, v_batch.status;
  END IF;

  FOR v_row IN
    SELECT e FROM jsonb_array_elements(v_batch.raw_rows) e
    WHERE e->>'status' = 'valid'
    ORDER BY e->>'user_id'          -- deterministic lock order → avoid deadlocks
  LOOP
    v_user_id := (v_row->>'user_id')::uuid;
    v_points  := (v_row->>'points')::integer;
    v_promo   := NULLIF(v_row->>'promo_code_id', '')::uuid;
    IF v_points IS NULL OR v_points <= 0 THEN
      RAISE EXCEPTION 'invalid points for user % in batch %', v_user_id, p_batch_id;
    END IF;

    -- Lock the user before touching balance.
    PERFORM 1 FROM user_profiles WHERE id = v_user_id FOR UPDATE;

    INSERT INTO point_batch_ledger (
      user_id, source_batch_id, source, points_earned, points_remaining,
      earned_month, expires_at, gross_amount, discount_amount, net_amount,
      promo_code_id, multiplier
    ) VALUES (
      v_user_id, p_batch_id, 'batch', v_points, v_points,
      v_earned_month, v_expires_at,
      (v_row->>'gross')::numeric, (v_row->>'discount')::numeric, (v_row->>'net')::numeric,
      v_promo, COALESCE((v_row->>'multiplier')::numeric, 1)
    );

    UPDATE user_profiles
      SET points_balance = points_balance + v_points, updated_at = now()
      WHERE id = v_user_id
      RETURNING points_balance INTO v_new_balance;

    INSERT INTO point_transactions (user_id, type, points, balance_after, source, source_batch_id, description)
    VALUES (v_user_id, 'earned', v_points, v_new_balance, 'batch', p_batch_id, 'Batch award');

    IF v_promo IS NOT NULL THEN
      UPDATE promo_codes SET usage_count = usage_count + 1 WHERE id = v_promo;
    END IF;

    v_total := v_total + v_points;
  END LOOP;

  UPDATE point_batches
    SET status = 'committed', committed_at = now(), total_points = v_total
    WHERE id = p_batch_id;

  RETURN v_total;
END;
$$;

-- ===========================================================================
-- void_batch(p_batch_id, p_admin, p_reason) → void
-- Reverses the still-remaining points of a committed batch (safe: never drives
-- a balance negative). Points a customer already spent are not clawed back.
-- ===========================================================================
CREATE OR REPLACE FUNCTION void_batch(p_batch_id uuid, p_admin uuid, p_reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_batch       point_batches%ROWTYPE;
  v_lot         point_batch_ledger%ROWTYPE;
  v_new_balance integer;
BEGIN
  SELECT * INTO v_batch FROM point_batches WHERE id = p_batch_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'batch % not found', p_batch_id; END IF;
  IF v_batch.status <> 'committed' THEN
    RAISE EXCEPTION 'batch % is % (only committed can be voided)', p_batch_id, v_batch.status;
  END IF;

  FOR v_lot IN
    SELECT * FROM point_batch_ledger
    WHERE source_batch_id = p_batch_id AND points_remaining > 0
    ORDER BY user_id
  LOOP
    PERFORM 1 FROM user_profiles WHERE id = v_lot.user_id FOR UPDATE;

    UPDATE point_batch_ledger SET points_remaining = 0 WHERE id = v_lot.id;

    UPDATE user_profiles
      SET points_balance = points_balance - v_lot.points_remaining, updated_at = now()
      WHERE id = v_lot.user_id
      RETURNING points_balance INTO v_new_balance;

    INSERT INTO point_transactions (user_id, type, points, balance_after, source, source_batch_id, created_by, description)
    VALUES (v_lot.user_id, 'refund', -v_lot.points_remaining, v_new_balance, 'batch', p_batch_id, p_admin, 'Batch voided: ' || COALESCE(p_reason, ''));

    IF v_lot.promo_code_id IS NOT NULL THEN
      UPDATE promo_codes SET usage_count = GREATEST(usage_count - 1, 0) WHERE id = v_lot.promo_code_id;
    END IF;
  END LOOP;

  UPDATE point_batches
    SET status = 'voided', voided_by = p_admin, voided_at = now(), void_reason = p_reason
    WHERE id = p_batch_id;
END;
$$;

-- ===========================================================================
-- redeem_reward(p_user, p_reward, p_qty) → uuid (redemption id)
-- Locks user, checks stock + balance, deducts FIFO from active lots.
-- ===========================================================================
CREATE OR REPLACE FUNCTION redeem_reward(p_user uuid, p_reward uuid, p_qty integer)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_reward       rewards%ROWTYPE;
  v_cost         integer;
  v_balance      integer;
  v_remaining    integer;
  v_take         integer;
  v_lot          point_batch_ledger%ROWTYPE;
  v_redemption   uuid;
  v_new_balance  integer;
BEGIN
  IF p_qty IS NULL OR p_qty <= 0 THEN RAISE EXCEPTION 'quantity must be > 0'; END IF;

  -- Lock the user first, then read the reward.
  SELECT points_balance INTO v_balance FROM user_profiles WHERE id = p_user FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'user % not found', p_user; END IF;

  SELECT * INTO v_reward FROM rewards WHERE id = p_reward FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'reward % not found', p_reward; END IF;
  IF NOT v_reward.is_active OR v_reward.is_archived THEN
    RAISE EXCEPTION 'reward % is not available', p_reward;
  END IF;
  IF v_reward.stock_quantity IS NOT NULL AND v_reward.stock_quantity < p_qty THEN
    RAISE EXCEPTION 'reward % out of stock', p_reward;
  END IF;

  v_cost := v_reward.points_cost * p_qty;
  IF v_balance < v_cost THEN
    RAISE EXCEPTION 'insufficient points: have %, need %', v_balance, v_cost;
  END IF;

  -- FIFO deduction: soonest-expiring active lots first.
  v_remaining := v_cost;
  FOR v_lot IN
    SELECT * FROM point_batch_ledger
    WHERE user_id = p_user AND points_remaining > 0 AND expires_at >= (now() AT TIME ZONE 'Asia/Bangkok')::date
    ORDER BY expires_at ASC, created_at ASC
    FOR UPDATE
  LOOP
    EXIT WHEN v_remaining <= 0;
    v_take := LEAST(v_lot.points_remaining, v_remaining);
    UPDATE point_batch_ledger SET points_remaining = points_remaining - v_take WHERE id = v_lot.id;
    v_remaining := v_remaining - v_take;
  END LOOP;

  IF v_remaining > 0 THEN
    -- Balance said enough but active lots didn't cover it → invariant broken.
    RAISE EXCEPTION 'ledger/balance mismatch for user % (short by %)', p_user, v_remaining;
  END IF;

  UPDATE user_profiles
    SET points_balance = points_balance - v_cost, updated_at = now()
    WHERE id = p_user
    RETURNING points_balance INTO v_new_balance;

  IF v_reward.stock_quantity IS NOT NULL THEN
    UPDATE rewards SET stock_quantity = stock_quantity - p_qty, updated_at = now() WHERE id = p_reward;
  END IF;

  INSERT INTO redemptions (user_id, reward_id, points_used, quantity, status)
  VALUES (p_user, p_reward, v_cost, p_qty, 'requested')
  RETURNING id INTO v_redemption;

  INSERT INTO point_transactions (user_id, type, points, balance_after, source, description)
  VALUES (p_user, 'spent', -v_cost, v_new_balance, 'redemption', 'Redeem: ' || v_reward.name);

  RETURN v_redemption;
END;
$$;

-- ===========================================================================
-- expire_ledger_batches(p_as_of) → integer (points expired)
-- Zeros every lot whose expires_at < p_as_of and adjusts balances. Lots are
-- kept (points_remaining=0) as history — never deleted (§7 rule).
-- ===========================================================================
CREATE OR REPLACE FUNCTION expire_ledger_batches(p_as_of date)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_lot         point_batch_ledger%ROWTYPE;
  v_new_balance integer;
  v_total       integer := 0;
BEGIN
  FOR v_lot IN
    SELECT * FROM point_batch_ledger
    WHERE points_remaining > 0 AND expires_at < p_as_of
    ORDER BY user_id
  LOOP
    PERFORM 1 FROM user_profiles WHERE id = v_lot.user_id FOR UPDATE;

    UPDATE point_batch_ledger SET points_remaining = 0 WHERE id = v_lot.id;

    UPDATE user_profiles
      SET points_balance = points_balance - v_lot.points_remaining, updated_at = now()
      WHERE id = v_lot.user_id
      RETURNING points_balance INTO v_new_balance;

    INSERT INTO point_transactions (user_id, type, points, balance_after, source, source_batch_id, description)
    VALUES (v_lot.user_id, 'expired', -v_lot.points_remaining, v_new_balance, 'expiry', v_lot.source_batch_id, 'Points expired');

    v_total := v_total + v_lot.points_remaining;
  END LOOP;

  RETURN v_total;
END;
$$;

-- ===========================================================================
-- adjust_points_manual(p_user, p_delta, p_admin, p_note) → integer (new balance)
-- +delta creates a manual lot; −delta deducts FIFO. Keeps the ledger invariant.
-- ===========================================================================
CREATE OR REPLACE FUNCTION adjust_points_manual(p_user uuid, p_delta integer, p_admin uuid, p_note text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_balance      integer;
  v_earned_month date := date_trunc('month', (now() AT TIME ZONE 'Asia/Bangkok'))::date;
  v_expires_at   date := ((date_trunc('month', (now() AT TIME ZONE 'Asia/Bangkok'))::date + interval '1 month')::date - 1) + 365;
  v_remaining    integer;
  v_take         integer;
  v_lot          point_batch_ledger%ROWTYPE;
  v_new_balance  integer;
BEGIN
  IF p_delta = 0 THEN RAISE EXCEPTION 'delta must be non-zero'; END IF;

  SELECT points_balance INTO v_balance FROM user_profiles WHERE id = p_user FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'user % not found', p_user; END IF;

  IF v_balance + p_delta < 0 THEN
    RAISE EXCEPTION 'adjustment would make balance negative (have %, delta %)', v_balance, p_delta;
  END IF;

  IF p_delta > 0 THEN
    INSERT INTO point_batch_ledger (user_id, source_batch_id, source, points_earned, points_remaining, earned_month, expires_at, multiplier)
    VALUES (p_user, NULL, 'manual', p_delta, p_delta, v_earned_month, v_expires_at, 1);
  ELSE
    v_remaining := -p_delta;
    FOR v_lot IN
      SELECT * FROM point_batch_ledger
      WHERE user_id = p_user AND points_remaining > 0 AND expires_at >= (now() AT TIME ZONE 'Asia/Bangkok')::date
      ORDER BY expires_at ASC, created_at ASC
      FOR UPDATE
    LOOP
      EXIT WHEN v_remaining <= 0;
      v_take := LEAST(v_lot.points_remaining, v_remaining);
      UPDATE point_batch_ledger SET points_remaining = points_remaining - v_take WHERE id = v_lot.id;
      v_remaining := v_remaining - v_take;
    END LOOP;
    IF v_remaining > 0 THEN
      RAISE EXCEPTION 'ledger/balance mismatch for user % (short by %)', p_user, v_remaining;
    END IF;
  END IF;

  UPDATE user_profiles
    SET points_balance = points_balance + p_delta, updated_at = now()
    WHERE id = p_user
    RETURNING points_balance INTO v_new_balance;

  INSERT INTO point_transactions (user_id, type, points, balance_after, source, created_by, description)
  VALUES (p_user, (CASE WHEN p_delta > 0 THEN 'bonus' ELSE 'spent' END)::transaction_type, p_delta, v_new_balance, 'manual', p_admin, p_note);

  RETURN v_new_balance;
END;
$$;

-- --- Lock down execution: server (service_role) only ------------------------
REVOKE ALL ON FUNCTION award_points_from_batch(uuid)            FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION void_batch(uuid, uuid, text)            FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION redeem_reward(uuid, uuid, integer)      FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION expire_ledger_batches(date)            FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION adjust_points_manual(uuid, integer, uuid, text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION award_points_from_batch(uuid)            TO service_role;
GRANT EXECUTE ON FUNCTION void_batch(uuid, uuid, text)            TO service_role;
GRANT EXECUTE ON FUNCTION redeem_reward(uuid, uuid, integer)      TO service_role;
GRANT EXECUTE ON FUNCTION expire_ledger_batches(date)            TO service_role;
GRANT EXECUTE ON FUNCTION adjust_points_manual(uuid, integer, uuid, text) TO service_role;


-- ═══════════════════════════════════════════════════════════════════════════
-- ▶ FILE: 011_rls_policies.sql
-- ═══════════════════════════════════════════════════════════════════════════
-- 011_rls_policies.sql — MIGRATION_PLAN.md §4.4, §9
-- Security model for Phase 1: ALL data access goes through server API routes
-- using the service_role key (which BYPASSES RLS). Therefore we enable RLS on
-- every table with NO permissive policies for anon/authenticated → those roles
-- are denied by default (defense in depth). If a future flow needs direct
-- client reads with the anon key, add narrow SELECT policies then (Sprint 2).

ALTER TABLE app_config             ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE point_settings         ENABLE ROW LEVEL SECURITY;
ALTER TABLE point_transactions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_tags              ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_notes             ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users            ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_roles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_permissions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_user_roles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE rewards                ENABLE ROW LEVEL SECURITY;
ALTER TABLE redemptions            ENABLE ROW LEVEL SECURITY;
ALTER TABLE promo_codes            ENABLE ROW LEVEL SECURITY;
ALTER TABLE point_batches          ENABLE ROW LEVEL SECURITY;
ALTER TABLE point_batch_ledger     ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_channels  ENABLE ROW LEVEL SECURITY;
ALTER TABLE line_quota_cache       ENABLE ROW LEVEL SECURITY;


-- ═══════════════════════════════════════════════════════════════════════════
-- ▶ FILE: 012_seed_permissions_roles.sql
-- ═══════════════════════════════════════════════════════════════════════════
-- 012_seed_permissions_roles.sql — MIGRATION_PLAN.md §7
-- Permissions + 6 system roles for the new batch/points model.
-- (No OCR/scan permissions — that flow is removed in the new system, §7.)
-- Idempotent (ON CONFLICT DO NOTHING) so it can be re-run safely.

-- --- Permissions -----------------------------------------------------------
INSERT INTO admin_permissions (permission_key, category, display_name) VALUES
  ('dashboard.view',       'dashboard',     'ดูแดชบอร์ด'),
  ('users.view',           'users',         'ดูผู้ใช้'),
  ('users.edit',           'users',         'แก้ไขผู้ใช้'),
  ('users.manage_points',  'users',         'จัดการแต้มผู้ใช้'),
  ('users.manage_notes',   'users',         'จัดการโน้ตผู้ใช้'),
  ('users.manage_tags',    'users',         'จัดการแท็กผู้ใช้'),
  ('tags.view',            'tags',          'ดูแท็ก'),
  ('tags.manage',          'tags',          'จัดการแท็ก'),
  ('rewards.view',         'rewards',       'ดูรางวัล'),
  ('rewards.create',       'rewards',       'สร้างรางวัล'),
  ('rewards.edit',         'rewards',       'แก้ไขรางวัล'),
  ('rewards.delete',       'rewards',       'ลบรางวัล'),
  ('redemptions.view',     'redemptions',   'ดูคำขอแลก'),
  ('redemptions.process',  'redemptions',   'ดำเนินการคำขอแลก'),
  ('redemptions.deliver',  'redemptions',   'ส่งมอบของรางวัล'),
  ('batches.view',         'batches',       'ดู batch'),
  ('batches.upload',       'batches',       'อัปโหลด batch'),
  ('batches.commit',       'batches',       'commit batch'),
  ('batches.review',       'batches',       'สุ่มตรวจ batch'),
  ('batches.void',         'batches',       'ยกเลิก batch'),
  ('promos.view',          'promos',        'ดูโปรโมชัน'),
  ('promos.manage',        'promos',        'จัดการโปรโมชัน'),
  ('notifications.manage', 'notifications', 'จัดการการแจ้งเตือน'),
  ('reports.view',         'reports',       'ดูรายงาน'),
  ('settings.edit',        'settings',      'แก้ไขการตั้งค่า'),
  ('admins.manage',        'admins',        'จัดการแอดมิน'),
  ('sales.entry',          'sales',         'คีย์ยอดขาย')
ON CONFLICT (permission_key) DO NOTHING;

-- --- Roles (all is_system so they can't be deleted via UI) -----------------
INSERT INTO admin_roles (name, display_name, is_system, description) VALUES
  ('super_admin',      'Super Admin',      true, 'สิทธิ์ทั้งหมด (bypass ใน admin-auth.ts)'),
  ('manager',          'ผู้จัดการ',          true, 'ดูภาพรวม สุ่มตรวจ/ยกเลิก batch จัดการคำขอแลก'),
  ('accounting',       'บัญชี',              true, 'อัปโหลดและ commit batch'),
  ('sales_staff',      'พนักงานขาย',         true, 'คีย์ยอดขาย'),
  ('reward_manager',   'Reward Manager',   true, 'จัดการรางวัลและการแลก'),
  ('customer_support', 'Customer Support', true, 'ดูแลผู้ใช้และคำขอแลก')
ON CONFLICT (name) DO NOTHING;

-- --- Role → permission mappings --------------------------------------------
-- super_admin: every permission (belt-and-suspenders; code also bypasses).
INSERT INTO admin_role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM admin_roles r CROSS JOIN admin_permissions p
WHERE r.name = 'super_admin'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- manager
INSERT INTO admin_role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM admin_roles r JOIN admin_permissions p ON true
WHERE r.name = 'manager' AND p.permission_key IN (
  'dashboard.view', 'reports.view',
  'batches.view', 'batches.review', 'batches.void',
  'redemptions.view', 'redemptions.process', 'redemptions.deliver',
  'users.view'
) ON CONFLICT (role_id, permission_id) DO NOTHING;

-- accounting
INSERT INTO admin_role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM admin_roles r JOIN admin_permissions p ON true
WHERE r.name = 'accounting' AND p.permission_key IN (
  'batches.view', 'batches.upload', 'batches.commit',
  'promos.view', 'users.view'
) ON CONFLICT (role_id, permission_id) DO NOTHING;

-- sales_staff
INSERT INTO admin_role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM admin_roles r JOIN admin_permissions p ON true
WHERE r.name = 'sales_staff' AND p.permission_key IN (
  'sales.entry', 'users.view'
) ON CONFLICT (role_id, permission_id) DO NOTHING;

-- reward_manager
INSERT INTO admin_role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM admin_roles r JOIN admin_permissions p ON true
WHERE r.name = 'reward_manager' AND p.permission_key IN (
  'rewards.view', 'rewards.create', 'rewards.edit', 'rewards.delete',
  'redemptions.view', 'redemptions.process', 'redemptions.deliver'
) ON CONFLICT (role_id, permission_id) DO NOTHING;

-- customer_support
INSERT INTO admin_role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM admin_roles r JOIN admin_permissions p ON true
WHERE r.name = 'customer_support' AND p.permission_key IN (
  'users.view', 'users.edit', 'users.manage_notes', 'redemptions.view'
) ON CONFLICT (role_id, permission_id) DO NOTHING;


-- ═══════════════════════════════════════════════════════════════════════════
-- ▶ instance config: tenant_code (ต่อ instance — pilot)
-- ═══════════════════════════════════════════════════════════════════════════
INSERT INTO app_config(key,value) VALUES ('tenant_code','pilot')
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;


-- ═══════════════════════════════════════════════════════════════════════════
-- ▶ VERIFICATION — รันหลัง apply เพื่อเช็คว่าขึ้นครบ
-- ═══════════════════════════════════════════════════════════════════════════
-- SELECT count(*) FROM pg_tables WHERE schemaname='public';                    -- คาดหวัง 19
-- SELECT count(*) FROM pg_tables WHERE schemaname='public'
--   AND tablename IN ('receipts','receipt_images');                       -- คาดหวัง 0 (ไม่มี receipts)
-- SELECT count(*) FROM admin_permissions;                                 -- คาดหวัง 27
-- SELECT count(*) FROM admin_roles;                                       -- คาดหวัง 6
-- SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
--   WHERE n.nspname='public' AND p.proname IN ('award_points_from_batch','void_batch','redeem_reward','expire_ledger_batches','adjust_points_manual');  -- คาดหวัง 5
-- SELECT value FROM app_config WHERE key='tenant_code';                    -- คาดหวัง 'pilot'
