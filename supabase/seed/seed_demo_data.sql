-- =============================================================================
-- seed_demo_data.sql — ข้อมูลสาธิต flow "upload Excel → แต้มเข้าลูกค้า"
--
-- 🔴🔴 ห้ามรันกับ production ของ Phase 2 เด็ดขาด 🔴🔴
--    ไฟล์นี้ใส่ลูกค้าปลอม พนักงานปลอม และแคมเปญปลอมลงฐาน
--    ถ้าหลุดขึ้น production ของสาขาจริง = ลูกค้าปลอมปนกับลูกค้าจริง ~700 คน
--    และแคมเปญ x2 จะไปคูณแต้มให้ยอดซื้อจริงทุกใบในช่วงวันที่ที่ระบุ
--
-- 🚫 ห้ามย้ายไฟล์นี้เข้า supabase/migrations/ — `supabase db push` จะรันอัตโนมัติ
--    (กติกาเหล็กข้อ 2 ใน supabase/README.md · MIGRATION_PLAN.md §9.6)
--    รันด้วยมือเท่านั้น: Dashboard → SQL Editor → วางทั้งไฟล์ → Run
--
-- ✅ รันซ้ำได้ (idempotent) — ไม่สร้างข้อมูลซ้ำถ้ามีอยู่แล้ว
--
-- วิธีลบข้อมูลสาธิตทิ้ง: ดูท้ายไฟล์ (บล็อก CLEANUP)
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 1. พนักงานขาย 4 คน
--    code ต้องผ่าน CHECK sales_reps_code_format = ^[A-Za-z0-9_-]{1,16}$
--    (ห้ามมีตัวคั่น ' · ' อยู่ข้างใน ไม่งั้น parser ตัด label ผิด)
-- ---------------------------------------------------------------------------
INSERT INTO sales_reps (code, full_name, phone) VALUES
  ('S01', 'สมชาย มั่นคง',    '0800000101'),
  ('S02', 'ปราณี ศรีสุข',     '0800000102'),
  ('S03', 'ธนากร ใจงาม',     '0800000103'),
  ('S04', 'จันทร์เพ็ญ ทองดี', '0800000104')
ON CONFLICT DO NOTHING;   -- ชน unique index บน upper(code)


-- ---------------------------------------------------------------------------
-- 2. แคมเปญ 2 ช่วง — ⚠️ ห้ามซ้อนกัน
--    point_campaigns_no_overlap เป็น EXCLUDE constraint: ถ้าช่วงทับกัน
--    Postgres จะ reject ทั้ง transaction (error 23P01) และ seed ทั้งไฟล์จะไม่ลง
--
--      แคมเปญ A: 2026-06-01 → 2026-06-30   (จบไปแล้ว)
--      แคมเปญ B: 2026-07-23 → 2026-08-05   (คลุมครึ่งหลังของสัปดาห์สาธิต)
--      แคมเปญ C: 2026-08-15 → 2026-12-31   (กำลังดำเนินอยู่วันนี้)
--      ห่างกัน 22 วัน — ไม่มีทางทับ
--
--    B ตั้งใจให้คลุม "ครึ่งหลัง" ของสัปดาห์สาธิต (20–26 ก.ค.) เท่านั้น
--    ถ้าคลุมทั้งสัปดาห์ ทุกแถวจะ x2 หมด → ลูกค้าไม่เห็นความต่างของตัวคูณ
--
--    ไม่มี unique constraint บน name → ใช้ WHERE NOT EXISTS กันรันซ้ำ
--    (ถ้าใช้ ON CONFLICT เฉย ๆ การรันรอบสองจะชน EXCLUDE กับตัวเองแล้วพัง)
-- ---------------------------------------------------------------------------
INSERT INTO point_campaigns (name, description, multiplier, starts_on, ends_on, is_active)
SELECT 'ต้นฤดูฝน รับแต้ม 1.5 เท่า', 'แคมเปญสาธิต (จบแล้ว)', 1.50, DATE '2026-06-01', DATE '2026-06-30', true
WHERE NOT EXISTS (SELECT 1 FROM point_campaigns WHERE name = 'ต้นฤดูฝน รับแต้ม 1.5 เท่า');

INSERT INTO point_campaigns (name, description, multiplier, starts_on, ends_on, is_active)
SELECT 'ฮักโฮมกลางปี รับแต้ม 2 เท่า', 'แคมเปญสาธิต (คลุมครึ่งหลังของสัปดาห์สาธิต)', 2.00, DATE '2026-07-23', DATE '2026-08-05', true
WHERE NOT EXISTS (SELECT 1 FROM point_campaigns WHERE name = 'ฮักโฮมกลางปี รับแต้ม 2 เท่า');

-- แคมเปญ C: 2026-08-15 → 2026-12-31 · x1.5 — ช่วง "กำลังดำเนินอยู่" ตอนที่เดโม
--   มีไว้เพื่อให้หน้าแคมเปญมีแถว active จริงตอนสาธิต และเพื่อให้บิลที่คีย์สดวันนี้ได้ตัวคูณ
--   ไม่ทับ B (จบ 2026-08-05) และไม่แตะสัปดาห์สาธิต 20–26 ก.ค. → ยอด 687 แต้มไม่เปลี่ยน
INSERT INTO point_campaigns (name, description, multiplier, starts_on, ends_on, is_active)
SELECT 'ฮักโฮมปลายฝน รับแต้ม 1.5 เท่า', 'แคมเปญสาธิต (กำลังดำเนินอยู่)', 1.50, DATE '2026-08-15', DATE '2026-12-31', true
WHERE NOT EXISTS (SELECT 1 FROM point_campaigns WHERE name = 'ฮักโฮมปลายฝน รับแต้ม 1.5 เท่า');


-- ---------------------------------------------------------------------------
-- 3. ลูกค้าสาธิต 8 คน
--    ⚠️ line_user_id UNIQUE NOT NULL · birthday NOT NULL · phone UNIQUE
--
--    line_user_id ขึ้นต้น 'Udemo-' โดยตั้งใจ — ไม่ใช่ LINE ID จริง คนพวกนี้ login ไม่ได้
--    ใช้สาธิต "การจับคู่เบอร์จากไฟล์ Excel" อย่างเดียว
--    (LINE push ก็ไม่ถูกส่ง เพราะ id ไม่มีจริง + NOTIFICATIONS_ENABLED=false)
--
--    เบอร์ใช้ช่วง 08000000xx ที่ไม่มีผู้ใช้จริง — กันโทรไปโดนคนอื่น
--    ห้ามเปลี่ยนเป็นเบอร์จริงของใครเด็ดขาด
-- ---------------------------------------------------------------------------
INSERT INTO user_profiles (line_user_id, phone, first_name, last_name, display_name, role, birthday) VALUES
  ('Udemo-0000000001', '0800000001', 'สมชาย',     'มั่นคง',   'สมชาย มั่นคง',     'contractor', DATE '1985-03-12'),
  ('Udemo-0000000002', '0800000002', 'ปราณี',      'ศรีสุข',    'ปราณี ศรีสุข',      'homeowner',  DATE '1990-07-28'),
  ('Udemo-0000000003', '0800000003', 'ธนากร',      'ใจงาม',    'ธนากร ใจงาม',      'contractor', DATE '1978-11-05'),
  ('Udemo-0000000004', '0800000004', 'วรรณภา',    'พูนผล',    'วรรณภา พูนผล',    'homeowner',  DATE '1995-01-20'),
  ('Udemo-0000000005', '0800000005', 'อนุชา',      'แก้วใส',    'อนุชา แก้วใส',      'contractor', DATE '1982-09-30'),
  ('Udemo-0000000006', '0800000006', 'จันทร์เพ็ญ', 'ทองดี',    'จันทร์เพ็ญ ทองดี', 'homeowner',  DATE '1988-05-17'),
  ('Udemo-0000000007', '0800000007', 'ประเสริฐ',   'วงศ์ไทย',  'ประเสริฐ วงศ์ไทย',  'contractor', DATE '1975-12-02'),
  ('Udemo-0000000008', '0800000008', 'มาลี',       'บุญมาก',   'มาลี บุญมาก',       'homeowner',  DATE '1992-04-08')
ON CONFLICT DO NOTHING;   -- ชน unique บน line_user_id หรือ phone


-- ---------------------------------------------------------------------------
-- ตรวจหลังรัน
-- ---------------------------------------------------------------------------
-- SELECT code, full_name, is_active FROM sales_reps ORDER BY code;                    -- คาดหวัง 4 แถว
-- SELECT name, multiplier, starts_on, ends_on FROM point_campaigns ORDER BY starts_on; -- คาดหวัง 3 แถว ไม่ทับกัน
-- SELECT phone, display_name, points_balance FROM user_profiles
--   WHERE line_user_id LIKE 'Udemo-%' ORDER BY phone;                                  -- คาดหวัง 8 แถว · 0 แต้ม


-- =============================================================================
-- CLEANUP — ลบข้อมูลสาธิตทิ้งหลังจบ demo (คัดลอกไปรันแยก อย่ารันพร้อมข้างบน)
-- =============================================================================
-- ⚠️ ต้องลบ batch ที่ commit ไปแล้วก่อน ไม่งั้น FK ON DELETE RESTRICT จะกัน
--    (void batch ผ่านหน้าเว็บก่อน แล้วค่อยลบ)
--
-- DELETE FROM point_transactions WHERE user_id IN (SELECT id FROM user_profiles WHERE line_user_id LIKE 'Udemo-%');
-- DELETE FROM point_batch_ledger  WHERE user_id IN (SELECT id FROM user_profiles WHERE line_user_id LIKE 'Udemo-%');
-- DELETE FROM point_batches       WHERE file_name LIKE 'demo-%';
-- DELETE FROM user_profiles       WHERE line_user_id LIKE 'Udemo-%';
-- DELETE FROM point_campaigns     WHERE description LIKE 'แคมเปญสาธิต%';
-- DELETE FROM sales_reps          WHERE code IN ('S01','S02','S03','S04');
