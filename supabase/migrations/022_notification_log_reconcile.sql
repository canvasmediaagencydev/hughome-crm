-- 022_notification_log_reconcile.sql — MIGRATION_PLAN.md §6.3, §9.2 (Sprint 7)
--
-- 1. notification_log — กันส่ง LINE push ซ้ำ (เตือนหมดอายุ / แจ้งหมดอายุแล้ว / วันเกิด)
--    cron รันซ้ำ (retry, deploy ใหม่, กดมือ) ต้องไม่ยิงข้อความเดิมให้ลูกค้าอีกรอบ
--    key = (user_id, kind, window_key) · window_key ต่อ kind:
--      expiry_warning  → expires_at ของ lot ('YYYY-MM-DD')  → เตือน 1 ครั้งต่อ lot-วันหมดอายุ
--      expiry_executed → วันที่รัน ('YYYY-MM-DD')
--      birthday        → ปี ('YYYY')
--    ลง log เฉพาะเมื่อ push สำเร็จ — push ล้มให้รอบถัดไปลองใหม่
--
-- 2. balance_reconcile_log — ผล cron reconcile รายวัน (อ่านอย่างเดียว ไม่ auto-fix)
--
-- 3. reconcile_balances() — คืนรายชื่อ user ที่ points_balance ≠ SUM(ledger.points_remaining)
--    STABLE / อ่านอย่างเดียว · ทำใน DB เพราะ PostgREST aggregate ข้ามตารางไม่ได้
--    (lot ที่ voided มี points_remaining = 0 เสมอ — void_batch เซ็ตให้ — จึงไม่ต้องกรอง)

-- ===========================================================================
-- 1. notification_log
-- ===========================================================================
CREATE TABLE notification_log (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE, -- ลูกค้าหาย log ก็ไม่มีความหมาย
  kind       text NOT NULL CHECK (kind IN ('expiry_warning', 'expiry_executed', 'birthday')),
  window_key text NOT NULL CHECK (char_length(window_key) BETWEEN 1 AND 32),
  payload    jsonb,                                   -- สิ่งที่ส่งไป (แต้ม/วันที่) ไว้ตรวจย้อนหลัง
  sent_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, kind, window_key)
);
CREATE INDEX notification_log_user_idx ON notification_log (user_id, sent_at DESC);

ALTER TABLE notification_log ENABLE ROW LEVEL SECURITY;

-- ===========================================================================
-- 2. balance_reconcile_log
-- ===========================================================================
CREATE TABLE balance_reconcile_log (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_at         timestamptz NOT NULL DEFAULT now(),
  checked_users  integer NOT NULL,
  mismatch_count integer NOT NULL,
  details        jsonb NOT NULL DEFAULT '[]'::jsonb  -- [{user_id, points_balance, ledger_remaining, drift}]
);
CREATE INDEX balance_reconcile_log_run_idx ON balance_reconcile_log (run_at DESC);

ALTER TABLE balance_reconcile_log ENABLE ROW LEVEL SECURITY;

-- ===========================================================================
-- 3. reconcile_balances() → mismatched users only (empty = invariant holds)
-- ===========================================================================
CREATE OR REPLACE FUNCTION reconcile_balances()
RETURNS TABLE (user_id uuid, points_balance integer, ledger_remaining bigint, drift bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT u.id,
         u.points_balance,
         COALESCE(l.remaining, 0),
         u.points_balance - COALESCE(l.remaining, 0)
    FROM user_profiles u
    LEFT JOIN (
      SELECT pbl.user_id, SUM(pbl.points_remaining) AS remaining
        FROM point_batch_ledger pbl
       GROUP BY pbl.user_id
    ) l ON l.user_id = u.id
   WHERE u.points_balance <> COALESCE(l.remaining, 0)
   ORDER BY u.id;
$$;

REVOKE ALL ON FUNCTION reconcile_balances()   FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION reconcile_balances() TO service_role;
