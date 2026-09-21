-- ═══════════════════════════════════════════════════════════════════════════
-- _apply_024_025.sql — HugHome CRM · migration 024–025 เท่านั้น (incremental)
-- สร้างอัตโนมัติด้วย: node scripts/build-apply-all.js --from 024 --to 025
-- (อย่าแก้ไฟล์นี้มือ — แก้ที่ migration ต้นทางแล้วรัน generator ใหม่)
--
-- ⚠️ ใช้กับ DB ที่ apply migration ก่อน 024 ไปแล้วเท่านั้น
--    ถ้าเป็น DB ใหม่เปล่า ๆ ให้ใช้ _apply_all.sql แทน
-- ไม่มี INSERT tenant_code ในไฟล์นี้ (ตั้งไปแล้วตอน apply ชุดแรก)
-- วิธี apply: Supabase Dashboard → SQL Editor → New query → วางทั้งไฟล์ → Run
-- ═══════════════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════════════════
-- ▶ FILE: 024_batch_approval_flow.sql
-- ═══════════════════════════════════════════════════════════════════════════
-- 024_batch_approval_flow.sql — Sprint 9R (customer meeting 2026-09-21, wiki/14 §3 N6)
--
-- ขั้นตอนใหม่: previewed → pending_approval → committed
--   Maker/บัญชี "ส่งให้ผู้อนุมัติ" (submit) · ผู้อนุมัติ "อนุมัติ" (commit) แต้มจึงเข้า
--   ไม่มีทางลัดจาก previewed ไป committed (ลูกค้าระบุ "ไม่ auto-approve")
--
-- 1. enum batch_status เพิ่มค่า 'pending_approval'
-- 2. point_batches เพิ่ม submitted_by / submitted_at (คู่กันเสมอ เหมือน committed_*)
--    ไม่เพิ่ม approved_by/approved_at — committed_by/committed_at ของ 019/020 คือคนอนุมัติอยู่แล้ว
-- 3. permission ใหม่ batches.approve → super_admin + manager
--    ถอด batches.commit ออกจาก accounting (บัญชีส่งได้ แต่ปล่อยแต้มเองไม่ได้อีก)
-- 4. award_points_from_batch v4 — เหมือน 020 ทุกอย่าง ยกเว้นรับเฉพาะ status = 'pending_approval'
-- 5. void_batch v3 — ยกเลิกได้จาก pending_approval ด้วย (ปฏิเสธก่อนแต้มเข้า ไม่มี ledger ให้คืน)
--
-- ⚠️ ALTER TYPE ... ADD VALUE ใช้ค่าใหม่ใน DML ของ transaction เดียวกันไม่ได้
--    ไฟล์นี้ไม่มี DML ที่อ้าง 'pending_approval' (function body ตรวจตอนรัน ไม่ใช่ตอนสร้าง)
--    ถ้า SQL Editor ฟ้อง "unsafe use of new value" ให้รันบรรทัด ALTER TYPE แยกก่อน แล้วรันที่เหลือ

-- ===========================================================================
-- 1. enum
-- ===========================================================================
ALTER TYPE batch_status ADD VALUE IF NOT EXISTS 'pending_approval' AFTER 'previewed';

-- ===========================================================================
-- 2. point_batches.submitted_by / submitted_at
-- ===========================================================================
ALTER TABLE point_batches
  ADD COLUMN submitted_by uuid REFERENCES admin_users(id) ON DELETE RESTRICT, -- ห้ามลบคนที่ส่งชุดเข้าคิวอนุมัติ
  ADD COLUMN submitted_at timestamptz;

ALTER TABLE point_batches
  ADD CONSTRAINT point_batches_submit_actor CHECK (
    (submitted_at IS NULL AND submitted_by IS NULL)
    OR (submitted_at IS NOT NULL AND submitted_by IS NOT NULL)
  );

CREATE INDEX point_batches_submitted_by_idx ON point_batches (submitted_by, submitted_at);

-- ===========================================================================
-- 3. permission batches.approve
-- ===========================================================================
INSERT INTO admin_permissions (permission_key, category, display_name) VALUES
  ('batches.approve', 'batches', 'อนุมัติ batch (แต้มเข้า)')
ON CONFLICT (permission_key) DO NOTHING;

INSERT INTO admin_role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM admin_roles r JOIN admin_permissions p ON true
WHERE r.name IN ('super_admin', 'manager')
  AND p.permission_key = 'batches.approve'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- accounting: ส่งได้ (batches.upload) แต่ปล่อยแต้มเองไม่ได้อีก
DELETE FROM admin_role_permissions rp
USING admin_roles r, admin_permissions p
WHERE rp.role_id = r.id AND rp.permission_id = p.id
  AND r.name = 'accounting' AND p.permission_key = 'batches.commit';

-- ===========================================================================
-- 4. award_points_from_batch v4 — รับเฉพาะ pending_approval
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
  -- v4: แต้มเข้าได้เฉพาะชุดที่ถูกส่งให้ผู้อนุมัติแล้วเท่านั้น (previewed ตรง ๆ ไม่ได้)
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

    -- (024 ยังยึดเดือนที่ซื้อ · 025 เปลี่ยนฐานเป็นวันที่อนุมัติตาม Q4)
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
-- 5. void_batch v3 — ยกเลิกได้ทั้ง committed (คืนแต้ม) และ pending_approval (ปฏิเสธก่อนแต้มเข้า)
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

  IF v_batch.status = 'pending_approval' THEN
    -- ยังไม่มีแต้มเข้า ไม่มี ledger → แค่ปิดชุดพร้อมบันทึกคน/เหตุผล
    UPDATE point_batches
      SET status = 'voided', voided_by = p_admin, voided_at = now(), void_reason = p_reason
      WHERE id = p_batch_id;
    RETURN;
  END IF;

  IF v_batch.status <> 'committed' THEN
    RAISE EXCEPTION 'batch % is % (only committed or pending_approval can be voided)', p_batch_id, v_batch.status;
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


-- ═══════════════════════════════════════════════════════════════════════════
-- ▶ FILE: 025_expiry_base_approval_date.sql
-- ═══════════════════════════════════════════════════════════════════════════
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


-- ═══════════════════════════════════════════════════════════════════════════
-- ▶ VERIFICATION — รันหลัง apply เพื่อเช็คว่าขึ้นครบ
-- ═══════════════════════════════════════════════════════════════════════════
-- SELECT count(*) FROM pg_tables WHERE schemaname='public';                    -- คาดหวัง 20
-- SELECT count(*) FROM pg_tables WHERE schemaname='public'
--   AND tablename IN ('receipts','receipt_images','promo_codes');         -- คาดหวัง 0
-- SELECT count(*) FROM pg_tables WHERE schemaname='public'
--   AND tablename IN ('sales_reps','point_campaigns','redemption_lots','notification_log','balance_reconcile_log');  -- คาดหวัง 5
-- SELECT count(*) FROM admin_permissions;                                 -- คาดหวัง 29
-- SELECT count(*) FROM admin_roles;                                       -- คาดหวัง 6
-- SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
--   WHERE n.nspname='public' AND p.proname IN ('award_points_from_batch','void_batch','redeem_reward','expire_ledger_batches','adjust_points_manual','cancel_redemption','reconcile_balances');  -- คาดหวัง 7
-- SELECT conname FROM pg_constraint WHERE conname='point_campaigns_no_overlap';  -- คาดหวัง 1 แถว
-- SELECT indexname FROM pg_indexes WHERE indexname='pbl_bill_no_active_idx';     -- คาดหวัง 1 แถว
-- SELECT pg_get_function_identity_arguments(p.oid) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
--   WHERE n.nspname='public' AND p.proname='award_points_from_batch';       -- คาดหวัง 'uuid, uuid' (1 แถว)
-- SELECT count(*) FROM information_schema.columns WHERE table_name='point_batches' AND column_name='committed_by';  -- คาดหวัง 1
