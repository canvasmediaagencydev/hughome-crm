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
