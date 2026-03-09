-- Migration 015: Remove auto-generate customer_code trigger
-- ให้ admin เป็นคนกำหนด customer_code เอง แทนที่จะ auto-generate

-- Drop trigger (ใช้ IF EXISTS เพื่อความปลอดภัย)
DROP TRIGGER IF EXISTS auto_generate_customer_code ON user_profiles;
DROP TRIGGER IF EXISTS generate_customer_code_trigger ON user_profiles;
DROP TRIGGER IF EXISTS set_customer_code ON user_profiles;

-- Drop related functions
DROP FUNCTION IF EXISTS generate_customer_code();
DROP FUNCTION IF EXISTS auto_generate_customer_code();

-- customer_code column คงอยู่เหมือนเดิม (nullable)
-- ไม่มีการเปลี่ยนแปลง column definition
