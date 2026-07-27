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
