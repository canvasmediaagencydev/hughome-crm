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
