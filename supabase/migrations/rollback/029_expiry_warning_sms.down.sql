-- rollback 029_expiry_warning_sms.sql
-- ⚠️ ลบ log การส่ง SMS เตือนหมดอายุทั้งหมดก่อน (CHECK เดิมไม่รับ kind นี้)
--    ถ้า deploy 029 ใหม่ภายหลัง ลูกค้าที่เคยได้ SMS แล้วจะได้ซ้ำอีกครั้งสำหรับ lot เดิม

DELETE FROM notification_log WHERE kind = 'expiry_warning_sms';
ALTER TABLE notification_log DROP CONSTRAINT notification_log_kind_check;
ALTER TABLE notification_log
  ADD CONSTRAINT notification_log_kind_check
  CHECK (kind IN ('expiry_warning', 'expiry_executed', 'birthday'));
