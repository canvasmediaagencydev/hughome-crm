-- =============================================================================
-- seed_mockdata50_customers.sql — ลูกค้า + พนักงานขาย ให้ตรงกับไฟล์
-- Hughome_Sales_Template_MockData50.xlsx (50 แถว)
--
-- 🔴 ห้ามรันกับ production Phase 2 — เป็นข้อมูลปลอมทั้งหมด
-- 🚫 ห้ามย้ายเข้า supabase/migrations/
-- ✅ รันซ้ำได้
--
-- แก้ 3 ปัญหาที่ทำให้ upload แล้ว unmatched 50/50:
--   1. เบอร์ทั้ง 17 เบอร์ในไฟล์ไม่มีใน user_profiles
--   2. พนักงานขาย S029 อยู่ในไฟล์แต่ไม่ได้ seed
--   3. แคมเปญ x2 เดิม (23/07-05/08) คลุมแค่ 4 วันท้ายของข้อมูล
--
-- ⚠️ ชนกับชุดสาธิตหลัก — อ่านก่อนรัน
--   ข้อ 3 ข้างล่างขยายแคมเปญ x2 เป็น 2026-07-15 ซึ่งทำให้ไฟล์สาธิตใน docs/demo/
--   ได้ 874 แต้มแทนที่จะเป็น 687 และ verify-demo-ready.js ตก 3 ข้อ
--   ไฟล์ Hughome_Sales_Template_MockData50.xlsx เองก็ไม่มีอยู่ในรีโปแล้ว
--
--   ชุดสาธิตที่ใช้จริงตอนนี้คือ docs/demo/ (10 แถว · 687 แต้ม)
--   จะรันไฟล์นี้ก็ต่อเมื่อมีไฟล์ 50 แถวอยู่ในมือ และให้ยอมรับว่า docs/demo/ จะใช้ไม่ได้ชั่วคราว
--   กลับคืนด้วย: node scripts/repair-demo-data.js
-- =============================================================================

-- 1. พนักงานขายที่ขาด (S01-S04 seed ไปแล้ว เหลือ S029)
INSERT INTO sales_reps (code, full_name)
SELECT 'S029', 'สมหญิง'
WHERE NOT EXISTS (SELECT 1 FROM sales_reps WHERE upper(code)='S029');

-- 2. ลูกค้า 17 คน — เบอร์/ชื่อ ตรงกับในไฟล์เป๊ะ
INSERT INTO user_profiles (line_user_id, phone, first_name, last_name, display_name, role, birthday) VALUES
  ('Udemo50-0000000001', '0811112222', 'จันทร์จิรา', 'สายทอง', 'จันทร์จิรา สายทอง', 'contractor', DATE '1975-01-01'),
  ('Udemo50-0000000002', '0812345678', 'สมชาย', 'ใจดี', 'สมชาย ใจดี', 'homeowner', DATE '1978-06-08'),
  ('Udemo50-0000000003', '0821111222', 'สมหมาย', 'ทองคำ', 'สมหมาย ทองคำ', 'contractor', DATE '1981-11-15'),
  ('Udemo50-0000000004', '0822223333', 'กิตติศักดิ์', 'ประเสริฐ', 'กิตติศักดิ์ ประเสริฐ', 'homeowner', DATE '1984-04-22'),
  ('Udemo50-0000000005', '0833332222', 'ณัฐพล', 'ศรีสวัสดิ์', 'ณัฐพล ศรีสวัสดิ์', 'contractor', DATE '1987-09-01'),
  ('Udemo50-0000000006', '0833334444', 'พรทิพย์', 'นาคดี', 'พรทิพย์ นาคดี', 'homeowner', DATE '1990-02-08'),
  ('Udemo50-0000000007', '0844443333', 'สุพัตรา', 'บุญมี', 'สุพัตรา บุญมี', 'contractor', DATE '1993-07-15'),
  ('Udemo50-0000000008', '0844445555', 'ธีระพงษ์', 'ใหญ่โต', 'ธีระพงษ์ ใหญ่โต', 'homeowner', DATE '1996-12-22'),
  ('Udemo50-0000000009', '0855554444', 'มานี', 'รักไทย', 'มานี รักไทย', 'contractor', DATE '1999-05-01'),
  ('Udemo50-0000000010', '0855556666', 'ศิริพร', 'วงศ์ทอง', 'ศิริพร วงศ์ทอง', 'homeowner', DATE '1977-10-08'),
  ('Udemo50-0000000011', '0866667777', 'ปิยะดา', 'สุขใจ', 'ปิยะดา สุขใจ', 'contractor', DATE '1980-03-15'),
  ('Udemo50-0000000012', '0866668888', 'อนุชา', 'ปัญญาดี', 'อนุชา ปัญญาดี', 'homeowner', DATE '1983-08-22'),
  ('Udemo50-0000000013', '0877776666', 'อารีย์', 'พร้อมพงษ์', 'อารีย์ พร้อมพงษ์', 'contractor', DATE '1986-01-01'),
  ('Udemo50-0000000014', '0877779999', 'นภาพร', 'มั่งคั่ง', 'นภาพร มั่งคั่ง', 'homeowner', DATE '1989-06-08'),
  ('Udemo50-0000000015', '0888889999', 'ธนพล', 'มั่งมี', 'ธนพล มั่งมี', 'contractor', DATE '1992-11-15'),
  ('Udemo50-0000000016', '0898765432', 'วรรณภา', 'ช่วยชุบ', 'วรรณภา ช่วยชุบ', 'homeowner', DATE '1995-04-22'),
  ('Udemo50-0000000017', '0899998888', 'วิชัย', 'แก้วมณี', 'วิชัย แก้วมณี', 'contractor', DATE '1998-09-01')
ON CONFLICT DO NOTHING;

-- 3. ขยายแคมเปญ x2 ให้คลุมช่วงข้อมูล (เดิม 23/07-05/08 คลุมแค่ 4 วันท้าย)
--    ต้องไม่ทับแคมเปญ 1.5x (01/06-30/06) — EXCLUDE constraint บังคับอยู่
UPDATE point_campaigns
   SET starts_on = DATE '2026-07-15', ends_on = DATE '2026-08-05'
 WHERE name = 'ฮักโฮมกลางปี รับแต้ม 2 เท่า';

-- ตรวจหลังรัน
-- SELECT count(*) FROM user_profiles WHERE line_user_id LIKE 'Udemo50-%';  -- 17
-- SELECT code, full_name FROM sales_reps ORDER BY code;                    -- 5 แถว (S01-S04, S029)
-- SELECT name, multiplier, starts_on, ends_on FROM point_campaigns ORDER BY starts_on;

-- CLEANUP (รันแยกตอนเลิกใช้)
-- DELETE FROM point_transactions WHERE user_id IN (SELECT id FROM user_profiles WHERE line_user_id LIKE 'Udemo50-%');
-- DELETE FROM point_batch_ledger WHERE user_id IN (SELECT id FROM user_profiles WHERE line_user_id LIKE 'Udemo50-%');
-- DELETE FROM user_profiles WHERE line_user_id LIKE 'Udemo50-%';
