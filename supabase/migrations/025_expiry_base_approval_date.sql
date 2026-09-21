-- 025_expiry_base_approval_date.sql — Sprint 9R · wiki/14 §3 "Point expiry" · Q4 ยืนยันแล้ว 2026-09-21
--
-- award_points_from_batch v5 — เหมือน 024 ทุกอย่าง ยกเว้นฐานอายุแต้ม:
--   เดิม (017/020/024): earned_month = เดือนที่ซื้อ · expires_at = สิ้นเดือนที่ซื้อ + 365
--   ใหม่:               earned_month = เดือนที่อนุมัติ · expires_at = วันที่อนุมัติ (เวลาไทย) + 365
--
-- ผลที่ลูกค้ารับทราบแล้ว: อัปโหลดช้า = แต้มอยู่ได้นานขึ้น · อัปโหลด 100 แถวพร้อมกัน = หมดอายุวันเดียวกันทั้งหมด
-- lot ที่ออกก่อนหน้านี้ไม่ถูกแก้ย้อนหลัง · purchase_date ยังคุมตัวคูณแคมเปญและช่วงสัปดาห์เหมือนเดิม
-- expire-points-monthly รันทุกวันอยู่แล้ว (wiki/07) จึงรองรับ lot ที่หมดอายุกลางเดือนได้

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
  v_approved_on   date := (now() AT TIME ZONE 'Asia/Bangkok')::date;
BEGIN
  PERFORM 1 FROM admin_users WHERE id = p_admin AND is_active;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'admin % not found or inactive (cannot commit batch %)', p_admin, p_batch_id;
  END IF;

  SELECT * INTO v_batch FROM point_batches WHERE id = p_batch_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'batch % not found', p_batch_id; END IF;
  -- (024) แต้มเข้าได้เฉพาะชุดที่ถูกส่งให้ผู้อนุมัติแล้วเท่านั้น
  IF v_batch.status <> 'pending_approval' THEN
    RAISE EXCEPTION 'batch % is % (must be pending_approval to commit)', p_batch_id, v_batch.status;
  END IF;

  FOR v_row IN
    SELECT e FROM jsonb_array_elements(v_batch.raw_rows) e
    -- duplicate_amount = ยอดซ้ำในไฟล์ที่ parser เตือนไว้ (Sprint 9R A4) — ผู้อนุมัติเห็นแล้วกดอนุมัติ จึงให้แต้มเหมือน valid
    WHERE e->>'status' IN ('valid', 'duplicate_amount')
    ORDER BY e->>'user_id'
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

    IF v_purchase_date < v_batch.week_start OR v_purchase_date > v_batch.week_end THEN
      RAISE EXCEPTION 'purchase_date % outside batch week %..% (user %)',
        v_purchase_date, v_batch.week_start, v_batch.week_end, v_user_id;
    END IF;

    PERFORM 1 FROM sales_reps WHERE id = v_sales_rep_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'sales_rep % not found (batch %)', v_sales_rep_id, p_batch_id;
    END IF;

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

    -- v5 (Q4 ยืนยัน 2026-09-21): อายุแต้ม 365 วันนับจาก "วันที่อนุมัติ" (วันนี้ตามเวลาไทย)
    -- ไม่ใช่เดือนที่ซื้อ · purchase_date ยังใช้หาตัวคูณแคมเปญและตรวจสัปดาห์เหมือนเดิม
    -- lot เก่าที่ออกก่อน 025 ไม่ถูกแก้ย้อนหลัง
    v_earned_month := date_trunc('month', v_approved_on)::date;
    v_expires_at   := v_approved_on + 365;

    PERFORM 1 FROM user_profiles WHERE id = v_user_id FOR UPDATE;

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
