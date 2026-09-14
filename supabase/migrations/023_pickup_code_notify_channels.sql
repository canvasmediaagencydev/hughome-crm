-- 023_pickup_code_notify_channels.sql — MIGRATION_PLAN.md §4.1, §4.2, §6.2 (Sprint 8)
--
-- 1. generate_pickup_code() — รหัสรับของ 8 ตัว จากตัวอักษรที่อ่านไม่สับสน (ไม่มี 0/O/1/I)
--    ลูกค้าเอาไปแสดงเป็น QR ที่หน้าร้าน · แอดมินสแกน/กรอกแล้วเปลี่ยนเป็น delivered
-- 2. redeem_reward v3 — เหมือน 021 ทุกอย่าง + ใส่ pickup_code ตอน INSERT redemptions
--    (อยู่ใน transaction เดียวกับการหักแต้ม → ใบแลกทุกใบมีรหัสเสมอ ไม่มีกรณีหักแต้มแล้วไม่มี QR)
-- 3. UNIQUE partial index บน redemptions.pickup_code — รหัสหนึ่งชี้ใบแลกได้ใบเดียว
-- 4. notification_channels: เพิ่ม last_sent_at / updated_at (หน้า /admin/notifications ใช้แสดง
--    "ส่งล่าสุด" และให้ PATCH จดเวลาแก้ไข) · ไม่แตะ token — เข้ารหัสฝั่งแอป (§9.5)
--
-- ไม่แตะ enum redemption_status — 001 สร้างเป็น 5 ค่าเป้าหมายอยู่แล้ว
-- (requested/approved/ready/delivered/cancelled) · processing/shipped ที่เหลือมีแค่ในโค้ด TS

-- ===========================================================================
-- 1. generate_pickup_code()
-- ===========================================================================
CREATE OR REPLACE FUNCTION generate_pickup_code()
RETURNS text
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- 32 ตัว ไม่มี 0 O 1 I
  v_code     text;
  v_i        integer;
  v_try      integer := 0;
BEGIN
  LOOP
    v_code := '';
    FOR v_i IN 1..8 LOOP
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * 32)::integer, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM redemptions WHERE pickup_code = v_code);
    v_try := v_try + 1;
    IF v_try >= 10 THEN
      RAISE EXCEPTION 'could not generate a unique pickup_code after % tries', v_try;
    END IF;
  END LOOP;
  RETURN v_code;
END;
$$;

REVOKE ALL ON FUNCTION generate_pickup_code() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION generate_pickup_code() TO service_role;

-- ===========================================================================
-- 2. redeem_reward v3 — 021 + pickup_code
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

  -- สร้างใบแลกก่อน เพื่อให้มี id ไปจดคู่กับ lot ที่หัก (ทั้งหมดอยู่ใน tx เดียว ล้มก็หายทั้งก้อน)
  -- v3: ออก pickup_code ที่นี่ — ใบแลกกับรหัสรับของเกิดพร้อมกันเสมอ
  INSERT INTO redemptions (user_id, reward_id, points_used, quantity, status, pickup_code)
  VALUES (p_user, p_reward, v_cost, p_qty, 'requested', generate_pickup_code())
  RETURNING id INTO v_redemption;

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
    INSERT INTO redemption_lots (redemption_id, lot_id, points) VALUES (v_redemption, v_lot.id, v_take);
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

  INSERT INTO point_transactions (user_id, type, points, balance_after, source, description)
  VALUES (p_user, 'spent', -v_cost, v_new_balance, 'redemption', 'Redeem: ' || v_reward.name);

  RETURN v_redemption;
END;
$$;

REVOKE ALL ON FUNCTION redeem_reward(uuid, uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION redeem_reward(uuid, uuid, integer) TO service_role;

-- ===========================================================================
-- 3. pickup_code unique (เฉพาะแถวที่มีรหัส — ใบเก่าก่อน 023 เป็น NULL)
-- ===========================================================================
CREATE UNIQUE INDEX redemptions_pickup_code_key ON redemptions (pickup_code) WHERE pickup_code IS NOT NULL;

-- ===========================================================================
-- 4. notification_channels — เวลาส่งล่าสุด / แก้ไขล่าสุด
-- ===========================================================================
ALTER TABLE notification_channels
  ADD COLUMN last_sent_at timestamptz,
  ADD COLUMN updated_at   timestamptz NOT NULL DEFAULT now();
