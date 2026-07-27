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
