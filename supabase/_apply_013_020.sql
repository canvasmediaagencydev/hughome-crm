-- ============================================================================
-- _apply_013_020.sql — migration 013–020 รวมไฟล์เดียว (ต่อจาก _apply_all.sql)
-- ----------------------------------------------------------------------------
-- วิธีใช้:  Supabase Dashboard → SQL Editor → New query → วางทั้งไฟล์ → Run
--
-- ทั้งหมดอยู่ใน transaction เดียว → ถ้าพังตรงไหน "ย้อนกลับหมด" ไม่มีสภาพครึ่งๆ กลางๆ
-- ถ้าขึ้นแดง ให้ copy ข้อความ error ทั้งอัน (มันจะบอกบรรทัด/constraint ที่พัง) มาให้ดู
-- ฐานจะยังอยู่ในสภาพเดิมเป๊ะ รันซ้ำใหม่ได้หลังแก้
-- ============================================================================

BEGIN;


-- ══════════════════════════════════════════════════════════════════════
-- ▶ FILE: 013_create_sales_reps.sql
-- ══════════════════════════════════════════════════════════════════════

-- 013_create_sales_reps.sql — MIGRATION_PLAN.md §4.2, §12
-- พนักงานขายที่ชื่อโผล่ใน dropdown ของไฟล์ Excel (คอลัมน์ "พนักงานขาย")
--
-- ทำไมไม่ใช้ admin_users: admin_users.auth_user_id เป็น UNIQUE NOT NULL คือต้องเปิด
-- Supabase auth account ให้พนักงานขายทุกคน ซึ่งขัด §13 Non-Goals ที่ระบุว่าไม่ทำ
-- web app ให้พนักงานขาย key เอง — พนักงานขายไม่ล็อกอินระบบเลย กรอก Excel เท่านั้น
--
-- ทำไมชื่อ sales_reps ไม่ใช่ sales_staff: 'sales_staff' ถูกใช้เป็น admin_roles.name
-- ไปแล้วใน 012 (role ของ admin ที่มี permission sales.entry) — เลี่ยงความกำกวม

CREATE TABLE sales_reps (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code       text NOT NULL,                       -- รหัสพนักงาน ใช้เป็นกุญแจจับคู่จากไฟล์ Excel
  full_name  text NOT NULL,
  phone      text,
  is_active  boolean NOT NULL DEFAULT true,        -- ลาออก = ปิด is_active (ห้ามลบ ledger อ้างอยู่)
  created_by uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- จำกัดชุดอักขระของ code ให้ไม่มีทางมีตัวคั่น ' · ' ที่ parser ใช้แยก label
  -- "CODE · ชื่อ" อยู่ข้างใน → invariant ของ parser ถูกบังคับที่ระดับ DB
  CONSTRAINT sales_reps_code_format CHECK (code ~ '^[A-Za-z0-9_-]{1,16}$'),
  CONSTRAINT sales_reps_full_name_len CHECK (char_length(btrim(full_name)) BETWEEN 1 AND 120),
  CONSTRAINT sales_reps_phone_format CHECK (phone IS NULL OR phone ~ '^0[689][0-9]{8}$')
);

-- parser จับคู่ด้วย code (ตัดจาก label) → ต้อง unique แบบไม่สนตัวพิมพ์เล็ก/ใหญ่
CREATE UNIQUE INDEX sales_reps_code_upper_idx ON sales_reps (upper(code));

-- dropdown ใน template + หน้า admin ดึงเฉพาะที่ยัง active
CREATE INDEX sales_reps_active_idx ON sales_reps (full_name) WHERE is_active;


-- ══════════════════════════════════════════════════════════════════════
-- ▶ FILE: 014_create_point_campaigns.sql
-- ══════════════════════════════════════════════════════════════════════

-- 014_create_point_campaigns.sql — MIGRATION_PLAN.md §4.2, §9.7
-- แทน promo_codes: ตัวคูณแต้มพิเศษผูก "ช่วงวันที่" ตั้งจากหลังบ้านเท่านั้น
-- ไม่มีโค้ดให้พนักงานขายกรอกในไฟล์ Excel อีกแล้ว (กันการใส่ตัวคูณเกินสิทธิ์ให้ลูกค้าตัวเอง)
--
-- ห้ามซ้อนช่วง — บังคับด้วย EXCLUDE constraint ไม่ใช่แค่ validate ในแอป
-- ผลคือแต่ละวันมี multiplier ได้ค่าเดียว → parser/RPC เลือก campaign ได้แบบ
-- deterministic ไม่ต้องมีกฎ tie-break (ซึ่งเป็นจุดที่คนเถียงกันเรื่องแต้มภายหลัง)

CREATE TABLE point_campaigns (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  description text,
  multiplier  numeric(4,2) NOT NULL CHECK (multiplier > 0),
  starts_on   date NOT NULL,                       -- inclusive
  ends_on     date NOT NULL,                       -- inclusive
  is_active   boolean NOT NULL DEFAULT true,        -- soft-delete (ledger อ้าง campaign อยู่)
  created_by  uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT point_campaigns_range CHECK (ends_on >= starts_on),
  CONSTRAINT point_campaigns_name_len CHECK (char_length(btrim(name)) BETWEEN 1 AND 120)
);

-- ช่วงวันที่ของ campaign ที่ active ห้ามทับกัน (range gist opclass มีใน core ไม่ต้องลง extension)
ALTER TABLE point_campaigns
  ADD CONSTRAINT point_campaigns_no_overlap
  EXCLUDE USING gist ((daterange(starts_on, ends_on, '[]')) WITH &&)
  WHERE (is_active);

-- lookup ตอน parse: หา campaign ที่คลุม purchase_date ของแต่ละแถว
CREATE INDEX point_campaigns_lookup_idx
  ON point_campaigns (starts_on, ends_on) WHERE is_active;


-- ══════════════════════════════════════════════════════════════════════
-- ▶ FILE: 015_batch_ledger_traceability.sql
-- ══════════════════════════════════════════════════════════════════════

-- 015_batch_ledger_traceability.sql — MIGRATION_PLAN.md §4.2, §9.7
-- เพิ่ม 3 ฟิลด์สาวกลับ (วันที่ซื้อ / เลขที่บิล / พนักงานขาย) ที่ไฟล์ Excel เพิ่มเข้ามา
-- + สลับ promo_code_id → campaign_id + เลิกใช้ promo_codes
--
-- เดิมผู้จัดการสุ่มตรวจได้แค่ "batch นี้ใครอัปโหลด" (= บัญชี) สาวไม่ถึงว่าแถวไหนใครคีย์
-- และเทียบกลับกับบิลจริงไม่ได้เลย → 3 คอลัมน์นี้คือตัวที่ทำให้สุ่มตรวจมีความหมาย

ALTER TABLE point_batch_ledger
  ADD COLUMN purchase_date date,                                              -- วันที่ซื้อจริงต่อแถว → กำหนด earned_month/expires_at
  ADD COLUMN bill_no       text,                                              -- เลขที่บิลตามเอกสารจริง
  ADD COLUMN sales_rep_id  uuid REFERENCES sales_reps(id) ON DELETE RESTRICT, -- RESTRICT: ห้ามลบพนักงานที่มีแต้มค้างในระบบ (ปิด is_active แทน)
  ADD COLUMN campaign_id   uuid REFERENCES point_campaigns(id) ON DELETE RESTRICT, -- RESTRICT: ต้องตอบได้เสมอว่าตัวคูณนี้มาจาก campaign ไหน
  ADD COLUMN voided        boolean NOT NULL DEFAULT false;                    -- ตั้งโดย void_batch → ปลดล็อกเลขบิลให้คีย์ใหม่ได้

-- แถวจาก batch ต้องมี 3 ฟิลด์ครบ · แถวจาก adjust_points_manual (source='manual')
-- ไม่มีบิล/พนักงาน/วันที่ซื้อ ตามธรรมชาติ → บังคับเฉพาะ source='batch'
ALTER TABLE point_batch_ledger
  ADD CONSTRAINT pbl_batch_traceability CHECK (
    source <> 'batch'
    OR (purchase_date IS NOT NULL AND bill_no IS NOT NULL AND sales_rep_id IS NOT NULL)
  );

ALTER TABLE point_batch_ledger
  ADD CONSTRAINT pbl_bill_no_len CHECK (
    bill_no IS NULL OR char_length(btrim(bill_no)) BETWEEN 1 AND 64
  );

-- 🔒 หัวใจกันทุจริต: เลขบิลเดียวขอแต้มได้ครั้งเดียวทั้งระบบ (ข้าม batch ข้ามลูกค้า)
-- batch ที่ถูก void แล้วถูกมาร์ค voided=true → เลขบิลนั้นกลับมาคีย์ใหม่ได้ (แก้ไฟล์ผิดแล้วส่งซ้ำ)
CREATE UNIQUE INDEX pbl_bill_no_active_idx
  ON point_batch_ledger (upper(btrim(bill_no)))
  WHERE bill_no IS NOT NULL AND NOT voided;

-- รายงานรายสัปดาห์ + สุ่มตรวจย้อนหลัง
CREATE INDEX pbl_purchase_date_idx ON point_batch_ledger (purchase_date);
CREATE INDEX pbl_sales_rep_idx     ON point_batch_ledger (sales_rep_id, purchase_date);

-- ---------------------------------------------------------------------------
-- เลิกใช้ promo_codes (ไม่มีข้อมูลจริง — ยังไม่เคยเปิดใช้ใน pilot)
-- DROP COLUMN ก่อน เพื่อให้ FK หายไปก่อน DROP TABLE
-- ---------------------------------------------------------------------------
ALTER TABLE point_batch_ledger DROP COLUMN promo_code_id;
DROP TABLE promo_codes;


-- ══════════════════════════════════════════════════════════════════════
-- ▶ FILE: 016_rls_new_tables.sql
-- ══════════════════════════════════════════════════════════════════════

-- 016_rls_new_tables.sql — ต่อจาก 011
-- ตารางใหม่ต้อง enable RLS ด้วย ไม่งั้น anon/authenticated อ่านได้ตรง ๆ
-- deny-by-default (ไม่มี policy อนุญาต) · server เข้าถึงผ่าน service_role ซึ่ง bypass RLS

ALTER TABLE sales_reps      ENABLE ROW LEVEL SECURITY;
ALTER TABLE point_campaigns ENABLE ROW LEVEL SECURITY;


-- ══════════════════════════════════════════════════════════════════════
-- ▶ FILE: 017_rpc_points_functions_v2.sql
-- ══════════════════════════════════════════════════════════════════════

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


-- ══════════════════════════════════════════════════════════════════════
-- ▶ FILE: 018_permissions_campaigns_salesreps.sql
-- ══════════════════════════════════════════════════════════════════════

-- 018_permissions_campaigns_salesreps.sql — MIGRATION_PLAN.md §7
-- promos.* → campaigns.* (โปรโมชันไม่ใช่โค้ดแล้ว เป็นแคมเปญช่วงวันที่)
-- + salesreps.* สำหรับจัดการรายชื่อพนักงานขายที่ป้อน dropdown ในไฟล์ Excel
-- Idempotent (ON CONFLICT DO NOTHING) รันซ้ำได้
-- permission รวม: 27 − 2 (promos) + 4 = 29

INSERT INTO admin_permissions (permission_key, category, display_name) VALUES
  ('campaigns.view',   'campaigns', 'ดูแคมเปญแต้ม'),
  ('campaigns.manage', 'campaigns', 'จัดการแคมเปญแต้ม'),
  ('salesreps.view',   'salesreps', 'ดูพนักงานขาย'),
  ('salesreps.manage', 'salesreps', 'จัดการพนักงานขาย')
ON CONFLICT (permission_key) DO NOTHING;

-- super_admin: ทุก permission (belt-and-suspenders; code ก็ bypass อยู่แล้ว)
INSERT INTO admin_role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM admin_roles r JOIN admin_permissions p ON true
WHERE r.name = 'super_admin'
  AND p.permission_key IN ('campaigns.view', 'campaigns.manage', 'salesreps.view', 'salesreps.manage')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- manager: ดูได้เท่านั้น — ตอนสุ่มตรวจต้องรู้ว่าแถวนั้นได้ตัวคูณจาก campaign ไหน
-- และพนักงานขายชื่ออะไร แต่ไม่ควรแก้ตัวคูณเองได้ (แยกคนตั้งกฎออกจากคนตรวจ)
INSERT INTO admin_role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM admin_roles r JOIN admin_permissions p ON true
WHERE r.name = 'manager'
  AND p.permission_key IN ('campaigns.view', 'salesreps.view')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- accounting: ดูแคมเปญ (ตรวจ preview) + จัดการรายชื่อพนักงานขาย
-- (บัญชีเป็นคนออก template ให้พนักงาน จึงต้องเพิ่ม/ปิดรายชื่อได้เอง)
-- แต่ตั้งตัวคูณแคมเปญไม่ได้ — คนคีย์ยอดต้องไม่ใช่คนตั้งตัวคูณ
INSERT INTO admin_role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM admin_roles r JOIN admin_permissions p ON true
WHERE r.name = 'accounting'
  AND p.permission_key IN ('campaigns.view', 'salesreps.view', 'salesreps.manage')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ลบ promos.* — ไม่มีระบบ promo code อีกแล้ว
-- mapping ใน admin_role_permissions หายตาม ON DELETE CASCADE ของ permission_id
DELETE FROM admin_permissions WHERE permission_key IN ('promos.view', 'promos.manage');


-- ══════════════════════════════════════════════════════════════════════
-- ▶ FILE: 019_batch_committed_by.sql
-- ══════════════════════════════════════════════════════════════════════

-- 019_batch_committed_by.sql — MIGRATION_PLAN.md §4.2
-- ตอบคำถาม "ใครเป็นคนกดให้แต้มเข้าครั้งนั้น"
--
-- 006 เก็บ uploaded_by / reviewed_by / voided_by ครบ แต่ committed_at มีเวลาโดยไม่มีคน
-- ซึ่งเป็น action ที่สำคัญที่สุด (จุดที่แต้มเข้าบัญชีลูกค้าจริง) และอาจเป็นคนละคนกับคนอัปโหลด
-- เช่น บัญชี A อัปโหลดวันศุกร์ · บัญชี B ตรวจ preview แล้วกด commit วันจันทร์

ALTER TABLE point_batches
  ADD COLUMN committed_by uuid REFERENCES admin_users(id) ON DELETE RESTRICT; -- RESTRICT: ห้ามลบคนที่ปล่อยแต้มเข้าระบบ

-- กันไว้: ถ้า DB นี้มี batch ที่ commit ไปแล้วก่อนมีคอลัมน์นี้ CHECK ข้างล่างจะพัง
-- ให้ล้มพร้อมข้อความที่บอกว่าต้องทำอะไร ไม่ใช่ error งง ๆ จาก constraint
-- (pilot ควรว่าง เพราะ batch upload เป็นงาน Sprint 4–5 ที่ยังไม่ทำ)
DO $$
DECLARE v_committed integer;
BEGIN
  SELECT count(*) INTO v_committed FROM point_batches WHERE committed_at IS NOT NULL;
  IF v_committed > 0 THEN
    RAISE EXCEPTION
      'point_batches มี % แถวที่ committed แล้วแต่ไม่มี committed_by — ต้อง backfill ก่อน เช่น UPDATE point_batches SET committed_by = uploaded_by WHERE committed_at IS NOT NULL AND committed_by IS NULL; แล้วรัน 019 ใหม่',
      v_committed;
  END IF;
END $$;

-- committed_at กับ committed_by ต้องมาคู่กันเสมอ (หรือไม่มีทั้งคู่)
ALTER TABLE point_batches
  ADD CONSTRAINT point_batches_commit_actor CHECK (
    (committed_at IS NULL AND committed_by IS NULL)
    OR (committed_at IS NOT NULL AND committed_by IS NOT NULL)
  );

-- รายงาน "batch ไหนใครปล่อย" + หา batch ของ admin คนหนึ่ง
CREATE INDEX point_batches_committed_by_idx ON point_batches (committed_by, committed_at);


-- ══════════════════════════════════════════════════════════════════════
-- ▶ FILE: 020_rpc_award_v3_commit_actor.sql
-- ══════════════════════════════════════════════════════════════════════

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


COMMIT;

-- ============================================================================
-- ตรวจหลัง Run (รันแยกอีกที)
-- ============================================================================
-- SELECT table_name FROM information_schema.tables
--  WHERE table_schema='public' AND table_name IN ('sales_reps','point_campaigns');   -- ต้องได้ 2 แถว
-- SELECT conname FROM pg_constraint WHERE conname='point_campaigns_no_overlap';      -- ต้องได้ 1 แถว
-- SELECT column_name FROM information_schema.columns
--  WHERE table_name='point_batches' AND column_name='committed_by';                  -- ต้องได้ 1 แถว
-- SELECT count(*) FROM admin_permissions;                                            -- ควรเพิ่มจาก 27
-- ============================================================================
