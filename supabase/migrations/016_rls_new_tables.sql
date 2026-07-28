-- 016_rls_new_tables.sql — ต่อจาก 011
-- ตารางใหม่ต้อง enable RLS ด้วย ไม่งั้น anon/authenticated อ่านได้ตรง ๆ
-- deny-by-default (ไม่มี policy อนุญาต) · server เข้าถึงผ่าน service_role ซึ่ง bypass RLS

ALTER TABLE sales_reps      ENABLE ROW LEVEL SECURITY;
ALTER TABLE point_campaigns ENABLE ROW LEVEL SECURITY;
