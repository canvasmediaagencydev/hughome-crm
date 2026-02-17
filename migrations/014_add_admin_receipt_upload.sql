-- Track which admin uploaded receipts and seed upload permission
ALTER TABLE receipts
ADD COLUMN IF NOT EXISTS uploaded_by_admin_id uuid REFERENCES admin_users(id);

CREATE INDEX IF NOT EXISTS idx_receipts_uploaded_by_admin_id
  ON receipts(uploaded_by_admin_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM admin_permissions WHERE permission_key = 'receipts.upload'
  ) THEN
    INSERT INTO admin_permissions (permission_key, category, display_name, description)
    VALUES (
      'receipts.upload',
      'receipts',
      'อัปโหลดใบเสร็จแทนลูกค้า',
      'อนุญาตให้แอดมินอัปโหลดใบเสร็จแทนลูกค้าและส่งเข้าระบบ'
    );
  END IF;
END $$;

INSERT INTO admin_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM admin_roles r
JOIN admin_permissions p ON p.permission_key = 'receipts.upload'
LEFT JOIN admin_role_permissions rp ON rp.role_id = r.id AND rp.permission_id = p.id
WHERE r.name IN ('super_admin', 'receipt_manager')
  AND rp.role_id IS NULL;
