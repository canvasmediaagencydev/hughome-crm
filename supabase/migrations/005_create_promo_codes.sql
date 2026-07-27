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
