-- rollback 024_batch_approval_flow.sql
-- คืน award_points_from_batch เป็น v3 (020: รับ status = 'previewed') และ void_batch เป็น v2 (017)
-- ถอดคอลัมน์ submitted_* · ลบ permission batches.approve · คืน batches.commit ให้ accounting
-- คัดลอก RPC มาทั้งตัวโดยเจตนา — ไฟล์ rollback ต้องรันได้เองไม่พึ่งไฟล์อื่น
--
-- ⚠️ Postgres ลบค่า enum ไม่ได้ — 'pending_approval' จะค้างอยู่ใน batch_status (ไม่มีใครใช้)
-- ⚠️ ชุดที่ค้าง pending_approval ถูกดึงกลับเป็น previewed (ยังไม่มีแต้มเข้า จึงไม่มีเงินขยับ)
-- ⚠️ ถ้า apply 025 ไปแล้ว ต้องถอย 025 ก่อน (025 ทับ award_points_from_batch อีกรอบ)

UPDATE point_batches
  SET status = 'previewed', submitted_by = NULL, submitted_at = NULL
  WHERE status = 'pending_approval';

ALTER TABLE point_batches DROP CONSTRAINT IF EXISTS point_batches_submit_actor;
DROP INDEX IF EXISTS point_batches_submitted_by_idx;
ALTER TABLE point_batches
  DROP COLUMN IF EXISTS submitted_by,
  DROP COLUMN IF EXISTS submitted_at;

-- คืน batches.commit ให้ accounting (ตาม 012)
INSERT INTO admin_role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM admin_roles r JOIN admin_permissions p ON true
WHERE r.name = 'accounting' AND p.permission_key = 'batches.commit'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- mapping หายตาม ON DELETE CASCADE
DELETE FROM admin_permissions WHERE permission_key = 'batches.approve';

-- ===========================================================================
-- award_points_from_batch v3 (020) — รับ status = 'previewed'
-- ===========================================================================
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

    v_earned_month := date_trunc('month', v_purchase_date)::date;
    v_expires_at   := ((v_earned_month + interval '1 month')::date - 1) + 365;

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

-- ===========================================================================
-- void_batch v2 (017) — เฉพาะ committed
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

  UPDATE point_batch_ledger SET voided = true
    WHERE source_batch_id = p_batch_id AND NOT voided;

  UPDATE point_batches
    SET status = 'voided', voided_by = p_admin, voided_at = now(), void_reason = p_reason
    WHERE id = p_batch_id;
END;
$$;

REVOKE ALL ON FUNCTION void_batch(uuid, uuid, text)     FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION void_batch(uuid, uuid, text)  TO service_role;
