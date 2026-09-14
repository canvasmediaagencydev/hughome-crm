-- 021_redemption_lots_cancel_rpc.sql — MIGRATION_PLAN.md §4.4, §6.2
-- ปิดช่องที่เงินถูกขยับด้วย UPDATE ตรง ๆ ใน API route (ขัดกติกา CLAUDE.md ข้อ 2)
--
-- ปัญหาเดิม: POST /api/admin/redemptions/:id/cancel บวก points_balance เอง
--   → balance ขึ้น แต่ point_batch_ledger ไม่ขยับ (invariant พัง — หลักฐานในฐาน: ลูกค้าทดสอบ
--     balance 400 / ledger 300 ต่างกัน 100 = ใบที่ยกเลิกไป) และ log point_transactions ล้มเงียบ
--     เพราะ insert คอลัมน์ reference_type/reference_id ที่ไม่มีจริง
--
-- ทำ 3 อย่าง:
--   1. redemption_lots — จดว่า redeem_reward หัก FIFO จาก lot ไหนเท่าไร
--      (เดิมไม่จด → ยกเลิกแล้วไม่รู้จะคืนเข้า lot ไหน)
--   2. redeem_reward v2 — เหมือน 010 ทุกอย่าง + insert redemption_lots ต่อ lot ที่หัก
--   3. cancel_redemption(p_redemption, p_admin, p_note) — คืนแต้มเข้า lot เดิม + คืนสต็อก
--      + เปลี่ยน status เป็น cancelled ใน transaction เดียว
--
-- นโยบายอายุแต้มที่คืน (ตัดสินใจแล้ว 2026-09-13): คืนเข้า lot เดิม อายุเท่าเดิม
--   ถ้า lot เดิมหมดอายุไปแล้วระหว่างนั้น แต้มส่วนนั้น "ไม่คืน" — ถือว่าหมดอายุตามปกติ
--   (ไม่ให้อายุใหม่ฟรีจากการ redeem แล้ว cancel)
--   redemption ที่เกิดก่อน 021 ไม่มีแถวใน redemption_lots → คืนเข้า lot ที่ยังไม่หมดอายุ
--   และมีที่ว่าง (points_remaining < points_earned) ไล่จากใกล้หมดอายุก่อน · ส่วนที่ไม่มีที่ว่าง
--   ให้คืน = หักไปจาก lot ที่หมดอายุแล้ว → ไม่คืนเช่นกัน

-- ===========================================================================
-- 1. redemption_lots
-- ===========================================================================
CREATE TABLE redemption_lots (
  redemption_id uuid    NOT NULL REFERENCES redemptions(id)        ON DELETE RESTRICT, -- ประวัติการหัก ห้ามหาย
  lot_id        uuid    NOT NULL REFERENCES point_batch_ledger(id) ON DELETE RESTRICT,
  points        integer NOT NULL CHECK (points > 0),
  PRIMARY KEY (redemption_id, lot_id)
);
CREATE INDEX redemption_lots_lot_idx ON redemption_lots (lot_id);

-- deny-by-default เหมือน 011/016 · server เข้าผ่าน service_role ซึ่ง bypass RLS
ALTER TABLE redemption_lots ENABLE ROW LEVEL SECURITY;

-- ===========================================================================
-- 2. redeem_reward v2 — 010 + จด redemption_lots
--    ต่างจาก 010 จุดเดียว: INSERT redemptions ย้ายขึ้นมาก่อน loop FIFO เพื่อให้มี id
--    ไปจดคู่กับ lot ที่หัก · ลำดับ lock (user → reward) และเงื่อนไขทุกข้อคงเดิม
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
  INSERT INTO redemptions (user_id, reward_id, points_used, quantity, status)
  VALUES (p_user, p_reward, v_cost, p_qty, 'requested')
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

-- ===========================================================================
-- 3. cancel_redemption(p_redemption, p_admin, p_note) → integer (new balance)
--    ยกเลิกได้เฉพาะ requested / approved / ready (§6.2: ห้ามถ้า delivered)
-- ===========================================================================
CREATE OR REPLACE FUNCTION cancel_redemption(p_redemption uuid, p_admin uuid, p_note text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_red          redemptions%ROWTYPE;
  v_reward       rewards%ROWTYPE;
  v_today        date := (now() AT TIME ZONE 'Asia/Bangkok')::date;
  v_rl           redemption_lots%ROWTYPE;
  v_lot          point_batch_ledger%ROWTYPE;
  v_tracked      boolean;
  v_remaining    integer;
  v_room         integer;
  v_take         integer;
  v_refunded     integer := 0;   -- คืนเข้า lot ได้จริง
  v_expired      integer := 0;   -- lot เดิมหมดอายุแล้ว → ไม่คืน
  v_new_balance  integer;
BEGIN
  -- คนกดยกเลิกต้องเป็น admin ที่มีจริงและยังใช้งานได้ — ไม่งั้น audit trail โกหก (เหมือน 020)
  PERFORM 1 FROM admin_users WHERE id = p_admin AND is_active;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'admin % not found or inactive (cannot cancel redemption %)', p_admin, p_redemption;
  END IF;

  SELECT * INTO v_red FROM redemptions WHERE id = p_redemption FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'redemption % not found', p_redemption; END IF;
  IF v_red.status NOT IN ('requested', 'approved', 'ready') THEN
    RAISE EXCEPTION 'redemption % is % (only requested/approved/ready can be cancelled)',
      p_redemption, v_red.status;
  END IF;

  -- ลำดับ lock เหมือน redeem_reward: user → reward → lots
  PERFORM 1 FROM user_profiles WHERE id = v_red.user_id FOR UPDATE;
  SELECT * INTO v_reward FROM rewards WHERE id = v_red.reward_id FOR UPDATE;

  SELECT EXISTS (SELECT 1 FROM redemption_lots WHERE redemption_id = p_redemption) INTO v_tracked;

  IF v_tracked THEN
    -- คืนเข้า lot เดิมตามที่จดไว้ตอน redeem
    FOR v_rl IN
      SELECT * FROM redemption_lots WHERE redemption_id = p_redemption ORDER BY lot_id
    LOOP
      SELECT * INTO v_lot FROM point_batch_ledger WHERE id = v_rl.lot_id FOR UPDATE;
      IF v_lot.expires_at >= v_today THEN
        UPDATE point_batch_ledger SET points_remaining = points_remaining + v_rl.points WHERE id = v_lot.id;
        v_refunded := v_refunded + v_rl.points;
      ELSE
        v_expired := v_expired + v_rl.points;
      END IF;
    END LOOP;
  ELSE
    -- ใบเก่าก่อน 021 ไม่มีบันทึก → คืนเข้า lot ที่ยังไม่หมดอายุและมีที่ว่าง ไล่จากใกล้หมดอายุก่อน
    -- (ที่ว่าง = points_earned - points_remaining คือส่วนที่เคยถูกหักไป)
    v_remaining := v_red.points_used;
    FOR v_lot IN
      SELECT * FROM point_batch_ledger
      WHERE user_id = v_red.user_id
        AND points_remaining < points_earned
        AND expires_at >= v_today
      ORDER BY expires_at ASC, created_at ASC
      FOR UPDATE
    LOOP
      EXIT WHEN v_remaining <= 0;
      v_room := v_lot.points_earned - v_lot.points_remaining;
      v_take := LEAST(v_room, v_remaining);
      UPDATE point_batch_ledger SET points_remaining = points_remaining + v_take WHERE id = v_lot.id;
      INSERT INTO redemption_lots (redemption_id, lot_id, points) VALUES (p_redemption, v_lot.id, v_take);
      v_remaining := v_remaining - v_take;
    END LOOP;
    v_refunded := v_red.points_used - v_remaining;
    v_expired  := v_remaining;
  END IF;

  UPDATE user_profiles
    SET points_balance = points_balance + v_refunded, updated_at = now()
    WHERE id = v_red.user_id
    RETURNING points_balance INTO v_new_balance;

  -- คืนสต็อก (§6.2 คืนแต้ม+สต็อก) — เฉพาะรางวัลที่นับสต็อก
  IF v_reward.stock_quantity IS NOT NULL THEN
    UPDATE rewards SET stock_quantity = stock_quantity + v_red.quantity, updated_at = now()
      WHERE id = v_red.reward_id;
  END IF;

  -- ลง log เสมอ (แม้คืนได้ 0) เพื่อให้ประวัติแต้มของลูกค้าเห็นการยกเลิกทุกครั้ง
  INSERT INTO point_transactions (user_id, type, points, balance_after, source, created_by, description)
  VALUES (
    v_red.user_id, 'refund', v_refunded, v_new_balance, 'redemption', p_admin,
    'Redemption cancelled: ' || v_reward.name
      || CASE WHEN v_expired > 0 THEN ' (' || v_expired || ' points already expired, not refunded)' ELSE '' END
      || CASE WHEN p_note IS NOT NULL AND btrim(p_note) <> '' THEN ' — ' || btrim(p_note) ELSE '' END
  );

  UPDATE redemptions
    SET status = 'cancelled', processed_by = p_admin, processed_at = now(),
        admin_notes = NULLIF(btrim(COALESCE(p_note, '')), ''), updated_at = now()
    WHERE id = p_redemption;

  RETURN v_new_balance;
END;
$$;

-- --- Lock down execution: server (service_role) only ------------------------
REVOKE ALL ON FUNCTION redeem_reward(uuid, uuid, integer)      FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION cancel_redemption(uuid, uuid, text)     FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION redeem_reward(uuid, uuid, integer)   TO service_role;
GRANT EXECUTE ON FUNCTION cancel_redemption(uuid, uuid, text)  TO service_role;
