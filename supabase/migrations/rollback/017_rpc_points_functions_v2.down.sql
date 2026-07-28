-- rollback 017_rpc_points_functions_v2.sql
-- คืน award_points_from_batch + void_batch เป็นเวอร์ชันของ 010_rpc_points_functions.sql
-- (คัดลอกมาทั้งตัวโดยเจตนา — ไฟล์ rollback ต้องรันได้เองไม่พึ่งไฟล์อื่น)
--
-- ⚠️ เวอร์ชันนี้อ้าง promo_codes และ point_batch_ledger.promo_code_id
--    plpgsql resolve ชื่อตารางตอน "รัน" ไม่ใช่ตอนสร้าง → CREATE ผ่านแม้ยังไม่ถอย 015
--    แต่จะ error ตอนเรียกใช้ ถ้ายังไม่ได้รัน 015 down

CREATE OR REPLACE FUNCTION award_points_from_batch(p_batch_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_batch        point_batches%ROWTYPE;
  v_earned_month date := date_trunc('month', (now() AT TIME ZONE 'Asia/Bangkok'))::date;
  v_expires_at   date := ((date_trunc('month', (now() AT TIME ZONE 'Asia/Bangkok'))::date + interval '1 month')::date - 1) + 365;
  v_row          jsonb;
  v_user_id      uuid;
  v_points       integer;
  v_promo        uuid;
  v_new_balance  integer;
  v_total        integer := 0;
BEGIN
  SELECT * INTO v_batch FROM point_batches WHERE id = p_batch_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'batch % not found', p_batch_id; END IF;
  IF v_batch.status <> 'previewed' THEN
    RAISE EXCEPTION 'batch % is % (must be previewed to commit)', p_batch_id, v_batch.status;
  END IF;

  FOR v_row IN
    SELECT e FROM jsonb_array_elements(v_batch.raw_rows) e
    WHERE e->>'status' = 'valid'
    ORDER BY e->>'user_id'
  LOOP
    v_user_id := (v_row->>'user_id')::uuid;
    v_points  := (v_row->>'points')::integer;
    v_promo   := NULLIF(v_row->>'promo_code_id', '')::uuid;
    IF v_points IS NULL OR v_points <= 0 THEN
      RAISE EXCEPTION 'invalid points for user % in batch %', v_user_id, p_batch_id;
    END IF;

    PERFORM 1 FROM user_profiles WHERE id = v_user_id FOR UPDATE;

    INSERT INTO point_batch_ledger (
      user_id, source_batch_id, source, points_earned, points_remaining,
      earned_month, expires_at, gross_amount, discount_amount, net_amount,
      promo_code_id, multiplier
    ) VALUES (
      v_user_id, p_batch_id, 'batch', v_points, v_points,
      v_earned_month, v_expires_at,
      (v_row->>'gross')::numeric, (v_row->>'discount')::numeric, (v_row->>'net')::numeric,
      v_promo, COALESCE((v_row->>'multiplier')::numeric, 1)
    );

    UPDATE user_profiles
      SET points_balance = points_balance + v_points, updated_at = now()
      WHERE id = v_user_id
      RETURNING points_balance INTO v_new_balance;

    INSERT INTO point_transactions (user_id, type, points, balance_after, source, source_batch_id, description)
    VALUES (v_user_id, 'earned', v_points, v_new_balance, 'batch', p_batch_id, 'Batch award');

    IF v_promo IS NOT NULL THEN
      UPDATE promo_codes SET usage_count = usage_count + 1 WHERE id = v_promo;
    END IF;

    v_total := v_total + v_points;
  END LOOP;

  UPDATE point_batches
    SET status = 'committed', committed_at = now(), total_points = v_total
    WHERE id = p_batch_id;

  RETURN v_total;
END;
$$;

CREATE OR REPLACE FUNCTION void_batch(p_batch_id uuid, p_admin uuid, p_reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_batch       point_batches%ROWTYPE;
  v_lot         point_batch_ledger%ROWTYPE;
  v_new_balance integer;
BEGIN
  SELECT * INTO v_batch FROM point_batches WHERE id = p_batch_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'batch % not found', p_batch_id; END IF;
  IF v_batch.status <> 'committed' THEN
    RAISE EXCEPTION 'batch % is % (only committed can be voided)', p_batch_id, v_batch.status;
  END IF;

  FOR v_lot IN
    SELECT * FROM point_batch_ledger
    WHERE source_batch_id = p_batch_id AND points_remaining > 0
    ORDER BY user_id
  LOOP
    PERFORM 1 FROM user_profiles WHERE id = v_lot.user_id FOR UPDATE;

    UPDATE point_batch_ledger SET points_remaining = 0 WHERE id = v_lot.id;

    UPDATE user_profiles
      SET points_balance = points_balance - v_lot.points_remaining, updated_at = now()
      WHERE id = v_lot.user_id
      RETURNING points_balance INTO v_new_balance;

    INSERT INTO point_transactions (user_id, type, points, balance_after, source, source_batch_id, created_by, description)
    VALUES (v_lot.user_id, 'refund', -v_lot.points_remaining, v_new_balance, 'batch', p_batch_id, p_admin, 'Batch voided: ' || COALESCE(p_reason, ''));

    IF v_lot.promo_code_id IS NOT NULL THEN
      UPDATE promo_codes SET usage_count = GREATEST(usage_count - 1, 0) WHERE id = v_lot.promo_code_id;
    END IF;
  END LOOP;

  UPDATE point_batches
    SET status = 'voided', voided_by = p_admin, voided_at = now(), void_reason = p_reason
    WHERE id = p_batch_id;
END;
$$;

REVOKE ALL ON FUNCTION award_points_from_batch(uuid)    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION void_batch(uuid, uuid, text)     FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION award_points_from_batch(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION void_batch(uuid, uuid, text)  TO service_role;
