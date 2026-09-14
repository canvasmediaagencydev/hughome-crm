-- 2026-09-13_reconcile_cancel_drift.sql — one-off repair, NOT a migration
--
-- ซ่อม drift ที่เกิดจาก POST /api/admin/redemptions/:id/cancel เวอร์ชันเก่า
-- (บวก points_balance ตรง ๆ โดยไม่คืนเข้า point_batch_ledger และ log point_transactions ล้มเงียบ)
-- อาการ: user_profiles.points_balance > SUM(point_batch_ledger.points_remaining)
--        ส่วนต่าง = points_used ของใบแลกที่ถูก cancelled ไป
--
-- ⚠️ ต้อง apply migration 021 ก่อน (ใช้ตาราง redemption_lots)
-- ⚠️ รันทีละส่วน: ส่วน 0 ดูก่อน · ส่วน 1 ซ่อม · ส่วน 2 ยืนยัน
-- ไม่ระบุตัวลูกค้าด้วยชื่อ/เบอร์ — หา drift จากตัวเลขในฐานเท่านั้น

-- ===========================================================================
-- 0. ดูก่อน: ใครมี drift และใบ cancelled ที่น่าจะเป็นต้นเหตุ
-- ===========================================================================
WITH ledger AS (
  SELECT user_id, COALESCE(SUM(points_remaining), 0) AS remaining
    FROM point_batch_ledger GROUP BY user_id
)
SELECT u.id AS user_id, u.points_balance, COALESCE(l.remaining, 0) AS ledger_remaining,
       u.points_balance - COALESCE(l.remaining, 0) AS drift,
       (SELECT jsonb_agg(jsonb_build_object('id', r.id, 'points_used', r.points_used, 'processed_at', r.processed_at))
          FROM redemptions r WHERE r.user_id = u.id AND r.status = 'cancelled') AS cancelled_redemptions
  FROM user_profiles u LEFT JOIN ledger l ON l.user_id = u.id
 WHERE u.points_balance <> COALESCE(l.remaining, 0);
-- คาดหวัง: 1 แถว drift = 100 และมีใบ cancelled 1 ใบ points_used = 100

-- ===========================================================================
-- 1. ซ่อม — ทำในธุรกรรมเดียว ล้มก็ไม่มีอะไรเปลี่ยน
--    นโยบายเดียวกับ cancel_redemption (021): คืนเข้า lot ที่ยังไม่หมดอายุและมีที่ว่าง
--    ไล่จากใกล้หมดอายุก่อน · ส่วนที่ไม่มีที่ว่าง = หักจาก lot ที่หมดอายุแล้ว → ไม่คืน
--    (หัก balance ลงและ log 'expired')
-- ===========================================================================
BEGIN;

DO $$
DECLARE
  v_user       uuid;
  v_drift      integer;
  v_red        redemptions%ROWTYPE;
  v_lot        point_batch_ledger%ROWTYPE;
  v_today      date := (now() AT TIME ZONE 'Asia/Bangkok')::date;
  v_remaining  integer;
  v_take       integer;
  v_refunded   integer := 0;
  v_balance    integer;
  v_n          integer;
BEGIN
  -- ต้องมี drift อยู่ 1 คนพอดี ไม่งั้นหยุด (ห้ามเดา)
  SELECT count(*) INTO v_n FROM (
    SELECT u.id FROM user_profiles u
     WHERE u.points_balance <> COALESCE((SELECT SUM(points_remaining) FROM point_batch_ledger WHERE user_id = u.id), 0)
  ) d;
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'expected exactly 1 user with drift, found % — inspect step 0 first', v_n;
  END IF;

  SELECT u.id, u.points_balance - COALESCE((SELECT SUM(points_remaining) FROM point_batch_ledger WHERE user_id = u.id), 0)
    INTO v_user, v_drift
    FROM user_profiles u
   WHERE u.points_balance <> COALESCE((SELECT SUM(points_remaining) FROM point_batch_ledger WHERE user_id = u.id), 0);

  IF v_drift <= 0 THEN
    RAISE EXCEPTION 'drift is % (expected positive = unrefunded cancel) — not this script''s case', v_drift;
  END IF;

  -- ใบ cancelled ที่ points_used ตรงกับ drift และยังไม่มีบันทึกใน redemption_lots
  SELECT count(*) INTO v_n FROM redemptions r
   WHERE r.user_id = v_user AND r.status = 'cancelled' AND r.points_used = v_drift
     AND NOT EXISTS (SELECT 1 FROM redemption_lots rl WHERE rl.redemption_id = r.id);
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'expected exactly 1 cancelled redemption with points_used = %, found %', v_drift, v_n;
  END IF;

  SELECT * INTO v_red FROM redemptions r
   WHERE r.user_id = v_user AND r.status = 'cancelled' AND r.points_used = v_drift
     AND NOT EXISTS (SELECT 1 FROM redemption_lots rl WHERE rl.redemption_id = r.id)
   FOR UPDATE;

  PERFORM 1 FROM user_profiles WHERE id = v_user FOR UPDATE;

  -- คืนเข้า lot ที่มีที่ว่างและยังไม่หมดอายุ (balance มี 100 นี้อยู่แล้ว → แตะแค่ ledger)
  v_remaining := v_drift;
  FOR v_lot IN
    SELECT * FROM point_batch_ledger
     WHERE user_id = v_user AND points_remaining < points_earned AND expires_at >= v_today
     ORDER BY expires_at ASC, created_at ASC
     FOR UPDATE
  LOOP
    EXIT WHEN v_remaining <= 0;
    v_take := LEAST(v_lot.points_earned - v_lot.points_remaining, v_remaining);
    UPDATE point_batch_ledger SET points_remaining = points_remaining + v_take WHERE id = v_lot.id;
    INSERT INTO redemption_lots (redemption_id, lot_id, points) VALUES (v_red.id, v_lot.id, v_take);
    v_remaining := v_remaining - v_take;
  END LOOP;
  v_refunded := v_drift - v_remaining;

  -- ส่วนที่คืนเข้า lot ไม่ได้ = หมดอายุแล้ว → เอาออกจาก balance (เดิมถูกบวกไว้ผิด)
  IF v_remaining > 0 THEN
    UPDATE user_profiles SET points_balance = points_balance - v_remaining, updated_at = now()
     WHERE id = v_user RETURNING points_balance INTO v_balance;
    INSERT INTO point_transactions (user_id, type, points, balance_after, source, created_by, description)
    VALUES (v_user, 'expired', -v_remaining, v_balance, 'redemption', v_red.processed_by,
            'Reconcile: cancelled redemption refund into expired lot — removed');
  END IF;

  SELECT points_balance INTO v_balance FROM user_profiles WHERE id = v_user;

  -- log แถว refund ที่ route เก่าทำหาย (created_by = คนที่ยกเลิกใบนั้น ถ้ามี)
  INSERT INTO point_transactions (user_id, type, points, balance_after, source, created_by, description)
  VALUES (v_user, 'refund', v_refunded, v_balance, 'redemption', v_red.processed_by,
          'Reconcile 2026-09-13: refund for cancelled redemption ' || v_red.id
          || ' (old cancel route did not write ledger/transaction)');

  -- invariant ต้องกลับมาจริง
  IF v_balance <> COALESCE((SELECT SUM(points_remaining) FROM point_batch_ledger WHERE user_id = v_user), 0) THEN
    RAISE EXCEPTION 'invariant still broken for user % after repair', v_user;
  END IF;

  RAISE NOTICE 'repaired user %: refunded % into lots, % treated as expired, balance now %',
    v_user, v_refunded, v_remaining, v_balance;
END $$;

COMMIT;

-- ===========================================================================
-- 2. ยืนยัน: ต้องได้ 0 แถว
-- ===========================================================================
SELECT u.id, u.points_balance,
       COALESCE((SELECT SUM(points_remaining) FROM point_batch_ledger WHERE user_id = u.id), 0) AS ledger_remaining
  FROM user_profiles u
 WHERE u.points_balance <> COALESCE((SELECT SUM(points_remaining) FROM point_batch_ledger WHERE user_id = u.id), 0);
