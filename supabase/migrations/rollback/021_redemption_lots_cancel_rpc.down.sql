-- rollback 021_redemption_lots_cancel_rpc.sql
-- ถอด cancel_redemption + redemption_lots และคืน redeem_reward เป็นเวอร์ชัน 010
-- คัดลอกมาทั้งตัวโดยเจตนา — ไฟล์ rollback ต้องรันได้เองไม่พึ่งไฟล์อื่น
--
-- ⚠️ ถอยแล้ว POST /api/admin/redemptions/:id/cancel จะเรียก RPC ที่ไม่มี → ยกเลิกใบแลกไม่ได้
--    จนกว่าจะ revert โค้ด route ด้วย · ประวัติว่าใบไหนหักจาก lot ไหนหายถาวร

DROP FUNCTION IF EXISTS cancel_redemption(uuid, uuid, text);
DROP TABLE IF EXISTS redemption_lots;

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

  INSERT INTO redemptions (user_id, reward_id, points_used, quantity, status)
  VALUES (p_user, p_reward, v_cost, p_qty, 'requested')
  RETURNING id INTO v_redemption;

  INSERT INTO point_transactions (user_id, type, points, balance_after, source, description)
  VALUES (p_user, 'spent', -v_cost, v_new_balance, 'redemption', 'Redeem: ' || v_reward.name);

  RETURN v_redemption;
END;
$$;

REVOKE ALL ON FUNCTION redeem_reward(uuid, uuid, integer)    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION redeem_reward(uuid, uuid, integer) TO service_role;
