-- 017_rpc_points_functions_v2.sql — แทนที่ award_points_from_batch + void_batch จาก 010
-- MIGRATION_PLAN.md §4.4
--
-- เปลี่ยน 3 อย่าง:
--   1. earned_month/expires_at คิดจาก purchase_date "รายแถว" (เดิมใช้ now() ตอน commit
--      ทั้ง batch → บัญชีอัปโหลดคาบเดือนแล้วลูกค้าได้อายุแต้มยาวขึ้นฟรี 1 เดือน)
--   2. เก็บ purchase_date / bill_no / sales_rep_id / campaign_id ลง ledger (สาวกลับได้)
--   3. เลิกใช้ promo_codes → campaign ผูกช่วงวันที่ · RPC ตรวจซ้ำว่าตัวคูณตรงกับ campaign จริง
--
-- ⚠️ ถ้า campaign ถูกปิด (is_active=false) หรือแก้ช่วงวันที่ ระหว่าง preview → commit
--    ตัวตรวจด้านล่างจะ RAISE และ commit ล้มทั้ง batch โดยเจตนา (ให้ preview ใหม่)
--    ยอมให้ล้มดังกว่าปล่อยแต้มผิดตัวคูณเข้าบัญชีลูกค้า

-- ===========================================================================
-- award_points_from_batch(p_batch_id) → integer (total points awarded)
-- ---------------------------------------------------------------------------
-- raw_rows CONTRACT (produced by the Sprint 4 parser, stored at preview):
--   raw_rows is a JSON array; VALID+matched rows are objects with:
--     { "status":"valid", "user_id":<uuid>, "points":<int>0>,
--       "purchase_date":"YYYY-MM-DD", "bill_no":<text>, "sales_rep_id":<uuid>,
--       "gross":<num>, "discount":<num>, "net":<num>,
--       "campaign_id":<uuid|null>, "multiplier":<num> }
--   Rows without status='valid' (invalid/unmatched) are ignored here.
-- ===========================================================================
CREATE OR REPLACE FUNCTION award_points_from_batch(p_batch_id uuid)
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

    INSERT INTO point_transactions (user_id, type, points, balance_after, source, source_batch_id, description)
    VALUES (v_user_id, 'earned', v_points, v_new_balance, 'batch', p_batch_id,
            'Batch award · bill ' || v_bill_no);

    v_total := v_total + v_points;
  END LOOP;

  UPDATE point_batches
    SET status = 'committed', committed_at = now(), total_points = v_total
    WHERE id = p_batch_id;

  RETURN v_total;
END;
$$;

-- ===========================================================================
-- void_batch(p_batch_id, p_admin, p_reason) → void
-- คืนแต้มที่ยังเหลือ + มาร์ค ledger ทั้ง batch เป็น voided
-- ---------------------------------------------------------------------------
-- ต่างจาก 010: เซ็ต voided=true ทุกแถวของ batch (ไม่ใช่แค่แถวที่ยังมีแต้มเหลือ)
-- ไม่งั้นเลขบิลของแถวที่ลูกค้าใช้แต้มไปแล้ว จะยังถูก unique index กันไว้ตลอดกาล
-- และตัด logic promo_codes.usage_count ที่ตารางไม่มีอยู่แล้ว
-- ===========================================================================
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
    VALUES (v_lot.user_id, 'refund', -v_lot.points_remaining, v_new_balance, 'batch', p_batch_id, p_admin,
            'Batch voided: ' || COALESCE(p_reason, ''));
  END LOOP;

  -- ปลดล็อกเลขบิลทั้ง batch — รวมแถวที่ points_remaining เป็น 0 อยู่แล้ว
  -- (ลูกค้าใช้แต้มไปแล้ว/แต้มหมดอายุ) ซึ่ง loop ข้างบนข้ามไป
  UPDATE point_batch_ledger SET voided = true
    WHERE source_batch_id = p_batch_id AND NOT voided;

  UPDATE point_batches
    SET status = 'voided', voided_by = p_admin, voided_at = now(), void_reason = p_reason
    WHERE id = p_batch_id;
END;
$$;

-- --- Re-assert execution grants (CREATE OR REPLACE keeps them, but be explicit) ---
REVOKE ALL ON FUNCTION award_points_from_batch(uuid)    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION void_batch(uuid, uuid, text)     FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION award_points_from_batch(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION void_batch(uuid, uuid, text)  TO service_role;
