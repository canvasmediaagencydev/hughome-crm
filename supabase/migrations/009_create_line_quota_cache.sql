-- 009_create_line_quota_cache.sql — MIGRATION_PLAN.md §4.2
-- Single-row cache of LINE message quota (refreshed ~every 15 min, §6.2).
-- id is pinned to 1 so there is always exactly one row.

CREATE TABLE line_quota_cache (
  id          integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  quota_limit integer,
  consumed    integer,
  fetched_at  timestamptz NOT NULL DEFAULT now()
);
