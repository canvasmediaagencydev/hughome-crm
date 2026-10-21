-- 029_expiry_warning_sms.sql — เตือนแต้มใกล้หมดอายุทาง SMS (ประชุมลูกค้า 2026-10-21)
--
-- ลูกค้าตกลง: แจ้งเตือนผู้ใช้งาน "เฉพาะแต้มจะหมดอายุ" และ "ผ่าน SMS" เท่านั้น
-- (LINE push ปิดอยู่แล้วตาม Q7 · NOTIFICATIONS_ENABLED=false)
--
-- ทำไมต้องเป็น kind ใหม่ ไม่ใช้ 'expiry_warning' เดิม:
--   ช่วงที่ปิด LINE push อยู่ pushMessage() คืนเฉยๆ โดยไม่ throw → cron เดิมนับว่า "ส่งแล้ว" และ log
--   'expiry_warning' ของ lot เหล่านั้นไปแล้วทั้งที่ลูกค้าไม่ได้รับอะไร ถ้าใช้ kind เดิม SMS จะถูก dedupe
--   ข้ามคนกลุ่มนี้ทั้งหมด · kind ใหม่เริ่มนับใหม่ และ log เดิมคงไว้เป็นประวัติ
--
-- ไม่แตะแต้ม/เงิน · แก้เฉพาะ CHECK ของ notification_log.kind (022 ประกาศ CHECK แบบ inline —
-- Postgres ตั้งชื่อให้เป็น notification_log_kind_check)

ALTER TABLE notification_log DROP CONSTRAINT notification_log_kind_check;
ALTER TABLE notification_log
  ADD CONSTRAINT notification_log_kind_check
  CHECK (kind IN ('expiry_warning', 'expiry_executed', 'birthday', 'expiry_warning_sms'));
