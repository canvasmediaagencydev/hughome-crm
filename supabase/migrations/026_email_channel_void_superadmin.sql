-- 026_email_channel_void_superadmin.sql — Sprint 10 (คำตอบลูกค้า 2026-09-21: Q6/Q11 + Q3)
--
-- 1. notification_channels.type รับ 'email' (แจ้งทีมผ่านอีเมล · Q6/Q11: ตัด Telegram ออกจาก UI,
--    ค่า 'telegram' / 'line_group' ยังอยู่ใน CHECK — แถวเก่าไม่พัง, migration ที่ apply แล้วไม่แก้)
--    target_id ของ email = ที่อยู่อีเมลผู้รับ · ไม่ใช้ token (API key อยู่ใน env RESEND_API_KEY)
-- 2. Q3: "ยกเลิกทั้งชุด (Rollback)" เฉพาะ admin สูงสุด → ถอด batches.void ออกจาก manager
--    (manager ยัง approve/ปฏิเสธชุดที่รอได้ผ่าน batches.approve — ปฏิเสธก่อนแต้มเข้าใช้ void route
--    เหมือนกัน จึงต้องแยก: ดู route void — pending_approval ใช้ batches.approve, committed ใช้ batches.void)

ALTER TABLE notification_channels DROP CONSTRAINT IF EXISTS notification_channels_type_check;
ALTER TABLE notification_channels
  ADD CONSTRAINT notification_channels_type_check CHECK (type IN ('telegram', 'line_group', 'email'));

DELETE FROM admin_role_permissions rp
USING admin_roles r, admin_permissions p
WHERE rp.role_id = r.id AND rp.permission_id = p.id
  AND r.name = 'manager' AND p.permission_key = 'batches.void';
