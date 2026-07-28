-- 020_rpc_award_v3_commit_actor.sql — MIGRATION_PLAN.md §4.4
-- award_points_from_batch v3 — รับ p_admin เข้ามาบันทึกว่าใครกดให้แต้มเข้า
--
-- ต่างจาก v2 (017) 3 จุด:
--   1. signature เปลี่ยน → (p_batch_id, p_admin) · DROP ตัว 1 argument ทิ้ง
--      ไม่ทำ overload เพราะ overload คือช่องให้เผลอเรียกตัวที่ไม่บันทึกคน
--   2. point_batches.committed_by = p_admin (คู่กับ committed_at ตาม CHECK ใน 019)
--   3. point_transactions.created_by = p_admin — เดิม batch award เป็น NULL
--      ทำให้ประวัติแต้มของลูกค้าตอบไม่ได้ว่าใครปล่อยเข้า (manual adjust ตอบได้อยู่แล้ว)

DROP FUNCTION IF EXISTS award_points_from_batch(uuid);

CREATE OR REPLACE FUNCTION award_points_from_batch(p_batch_id uuid, p_admin uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_batch         point_batches%ROWTYPE;
  v_row           jsonb;
  v_user_id       uuid;
  v_points        integer;
  v_purchase_date date;
  v_bill_no       text;
  v_sales_rep_id  uuid;
  v_campaign_id   uuid;
  v_multiplier    numeric;
  v_expected_mult numeric;
  v_earned_month  date;
  v_expires_at    date;
  v_new_balance   integer;
  v_total         integer := 0;
BEGIN
  -- คนกด commit ต้องเป็น admin ที่มีจริงและยังใช้งานได้ — ไม่งั้น audit trail โกหก
  PERFORM 1 FROM admin_users WHERE id = p_admin AND is_active;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'admin % not found or inactive (cannot commit batch %)', p_admin, p_batch_id;
  END IF;

  SELECT * INTO v_batch FROM point_batches WHERE id = p_batch_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'batch % not found', p_batch_id; END IF;
  IF v_batch.status <> 'previewed' THEN
    RAISE EXCEPTION 'batch % is % (must be previewed to commit)', p_batch_id, v_batch.status;
  END IF;

  FOR v_row IN
    SELECT e FROM jsonb_array_elements(v_batch.raw_rows) e
    WHERE e->>'status' = 'valid'
    ORDER BY e->>'user_id'          -- deterministic lock order → avoid deadlocks
  LOOP
    v_user_id       := (v_row->>'user_id')::uuid;
    v_points        := (v_row->>'points')::integer;
    v_purchase_date := (v_row->>'purchase_date')::date;
    v_bill_no       := btrim(v_row->>'bill_no');
    v_sales_rep_id  := (v_row->>'sales_rep_id')::uuid;
    v_campaign_id   := NULLIF(v_row->>'campaign_id', '')::uuid;
    v_multiplier    := COALESCE((v_row->>'multiplier')::numeric, 1);

    IF v_points IS NULL OR v_points <= 0 THEN
      RAISE EXCEPTION 'invalid points for user % in batch %', v_user_id, p_batch_id;
    END IF;
    IF v_purchase_date IS NULL OR v_bill_no IS NULL OR v_bill_no = '' OR v_sales_rep_id IS NULL THEN
      RAISE EXCEPTION 'row for user % in batch % missing purchase_date/bill_no/sales_rep_id',
        v_user_id, p_batch_id;
    END IF;

    -- วันที่ซื้อต้องอยู่ในสัปดาห์ที่บัญชีประกาศตอนอัปโหลด (กันยอดข้ามสัปดาห์แอบเข้ามา)
    IF v_purchase_date < v_batch.week_start OR v_purchase_date > v_batch.week_end THEN
      RAISE EXCEPTION 'purchase_date % outside batch week %..% (user %)',
        v_purchase_date, v_batch.week_start, v_batch.week_end, v_user_id;
    END IF;

    -- พนักงานขายต้องมีจริง (ไม่บังคับว่ายัง active — ลาออกไปแล้วยังต้อง commit ยอดเก่าได้)
    PERFORM 1 FROM sales_reps WHERE id = v_sales_rep_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'sales_rep % not found (batch %)', v_sales_rep_id, p_batch_id;
    END IF;

    -- ตัวคูณต้องตรงกับ campaign ที่ active และคลุม purchase_date จริง ๆ
    -- (campaign ห้ามซ้อนช่วงตาม 014 → คลุมได้ไม่เกิน 1 ตัว จึงไม่ต้อง tie-break)
    SELECT c.multiplier INTO v_expected_mult
      FROM point_campaigns c
      WHERE c.is_active
        AND v_purchase_date BETWEEN c.starts_on AND c.ends_on;
    v_expected_mult := COALESCE(v_expected_mult, 1);

    IF v_campaign_id IS NOT NULL THEN
      PERFORM 1 FROM point_campaigns c
        WHERE c.id = v_campaign_id AND c.is_active
          AND v_purchase_date BETWEEN c.starts_on AND c.ends_on;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'campaign % no longer active/covering % — re-preview batch %',
          v_campaign_id, v_purchase_date, p_batch_id;
      END IF;
    END IF;

    IF v_multiplier <> v_expected_mult THEN
      RAISE EXCEPTION 'multiplier % does not match campaign multiplier % for % — re-preview batch %',
        v_multiplier, v_expected_mult, v_purchase_date, p_batch_id;
    END IF;

    -- อายุแต้มยึด "เดือนที่ซื้อจริง" รายแถว
    v_earned_month := date_trunc('month', v_purchase_date)::date;
    v_expires_at   := ((v_earned_month + interval '1 month')::date - 1) + 365;

    -- Lock the user before touching balance.
    PERFORM 1 FROM user_profiles WHERE id = v_user_id FOR UPDATE;

    -- bill_no ซ้ำจะโดน pbl_bill_no_active_idx เตะที่นี่ → ทั้ง batch rollback (all-or-nothing)
    INSERT INTO point_batch_ledger (
      user_id, source_batch_id, source, points_earned, points_remaining,
      earned_month, expires_at, gross_amount, discount_amount, net_amount,
      purchase_date, bill_no, sales_rep_id, campaign_id, multiplier
    ) VALUES (
      v_user_id, p_batch_id, 'batch', v_points, v_points,
      v_earned_month, v_expires_at,
      (v_row->>'gross')::numeric, (v_row->>'discount')::numeric, (v_row->>'net')::numeric,
      v_purchase_date, v_bill_no, v_sales_rep_id, v_campaign_id, v_multiplier
    );

    UPDATE user_profiles
      SET points_balance = points_balance + v_points, updated_at = now()
      WHERE id = v_user_id
      RETURNING points_balance INTO v_new_balance;

    -- created_by = คนกด commit → ประวัติแต้มของลูกค้าตอบได้ว่าใครปล่อยเข้า
    INSERT INTO point_transactions (
      user_id, type, points, balance_after, source, source_batch_id, created_by, description
    ) VALUES (
      v_user_id, 'earned', v_points, v_new_balance, 'batch', p_batch_id, p_admin,
      'Batch award · bill ' || v_bill_no
    );

    v_total := v_total + v_points;
  END LOOP;

  UPDATE point_batches
    SET status = 'committed', committed_at = now(), committed_by = p_admin, total_points = v_total
    WHERE id = p_batch_id;

  RETURN v_total;
END;
$$;

REVOKE ALL ON FUNCTION award_points_from_batch(uuid, uuid)    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION award_points_from_batch(uuid, uuid) TO service_role;
