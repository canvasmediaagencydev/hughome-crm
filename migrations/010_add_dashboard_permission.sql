-- Add dashboard.view permission and assign to super_admin
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM admin_permissions WHERE permission_key = 'dashboard.view') THEN
    INSERT INTO admin_permissions (permission_key, category, display_name, description)
    VALUES ('dashboard.view', 'dashboard', 'เข้าถึง Dashboard', 'อนุญาตให้ดูหน้า Dashboard และข้อมูลภาพรวม');
  END IF;
END $$;

-- Ensure super_admin role has the dashboard permission
INSERT INTO admin_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM admin_roles r
JOIN admin_permissions p ON p.permission_key = 'dashboard.view'
LEFT JOIN admin_role_permissions rp ON rp.role_id = r.id AND rp.permission_id = p.id
WHERE r.name = 'super_admin' AND rp.role_id IS NULL;
