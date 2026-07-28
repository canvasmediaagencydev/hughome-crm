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
