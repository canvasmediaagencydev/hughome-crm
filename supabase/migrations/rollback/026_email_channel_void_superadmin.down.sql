-- rollback 026_email_channel_void_superadmin.sql
-- ⚠️ channel type 'email' ที่สร้างไว้ต้องลบก่อน ไม่งั้น CHECK เดิมใส่กลับไม่ได้
DELETE FROM notification_channels WHERE type = 'email';

ALTER TABLE notification_channels DROP CONSTRAINT IF EXISTS notification_channels_type_check;
ALTER TABLE notification_channels
  ADD CONSTRAINT notification_channels_type_check CHECK (type IN ('telegram', 'line_group'));

-- คืน batches.void ให้ manager (ตาม 012)
INSERT INTO admin_role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM admin_roles r JOIN admin_permissions p ON true
WHERE r.name = 'manager' AND p.permission_key = 'batches.void'
ON CONFLICT (role_id, permission_id) DO NOTHING;
