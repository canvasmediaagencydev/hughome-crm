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
