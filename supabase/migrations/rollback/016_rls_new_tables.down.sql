-- rollback 016_rls_new_tables.sql
-- ปิด RLS (ตารางจะถูก DROP ตอนถอย 013/014 อยู่แล้ว — ไฟล์นี้เผื่อถอยเฉพาะ 016)
ALTER TABLE IF EXISTS sales_reps      DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS point_campaigns DISABLE ROW LEVEL SECURITY;
