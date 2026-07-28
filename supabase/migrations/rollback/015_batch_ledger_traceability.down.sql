-- rollback 015_batch_ledger_traceability.sql
-- ⚠️ ทำลายข้อมูล: purchase_date / bill_no / sales_rep_id ของทุก ledger lot หายถาวร
--    (สาวกลับบิลไม่ได้อีก) · ถอยได้เฉพาะตอน pilot ที่ข้อมูลยังทิ้งได้

-- คืนตาราง promo_codes ตามรูปเดิมใน 005_create_promo_codes.sql
CREATE TABLE IF NOT EXISTS promo_codes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code        text UNIQUE NOT NULL,
  name        text NOT NULL,
  description text,
  multiplier  numeric(4,2) NOT NULL CHECK (multiplier > 0),
  starts_at   timestamptz NOT NULL,
  expires_at  timestamptz NOT NULL,
  max_uses    integer CHECK (max_uses IS NULL OR max_uses > 0),
  usage_count integer NOT NULL DEFAULT 0 CHECK (usage_count >= 0),
  is_active   boolean NOT NULL DEFAULT true,
  created_by  uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_at > starts_at)
);
CREATE UNIQUE INDEX IF NOT EXISTS promo_codes_code_upper_idx ON promo_codes (upper(code));
ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;

-- คืนคอลัมน์ promo_code_id
ALTER TABLE point_batch_ledger
  ADD COLUMN IF NOT EXISTS promo_code_id uuid REFERENCES promo_codes(id) ON DELETE SET NULL;

-- ถอนของที่ 015 เพิ่ม
DROP INDEX IF EXISTS pbl_bill_no_active_idx;
DROP INDEX IF EXISTS pbl_purchase_date_idx;
DROP INDEX IF EXISTS pbl_sales_rep_idx;

ALTER TABLE point_batch_ledger DROP CONSTRAINT IF EXISTS pbl_batch_traceability;
ALTER TABLE point_batch_ledger DROP CONSTRAINT IF EXISTS pbl_bill_no_len;

ALTER TABLE point_batch_ledger
  DROP COLUMN IF EXISTS purchase_date,
  DROP COLUMN IF EXISTS bill_no,
  DROP COLUMN IF EXISTS sales_rep_id,
  DROP COLUMN IF EXISTS campaign_id,
  DROP COLUMN IF EXISTS voided;
