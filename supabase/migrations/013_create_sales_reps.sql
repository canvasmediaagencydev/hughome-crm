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
