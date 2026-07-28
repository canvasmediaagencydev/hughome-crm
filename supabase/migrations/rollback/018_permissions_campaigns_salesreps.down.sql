-- rollback 018_permissions_campaigns_salesreps.sql
-- คืน promos.* + ลบ campaigns.* / salesreps.*
-- (mapping ใน admin_role_permissions หายตาม CASCADE ของ permission_id)

INSERT INTO admin_permissions (permission_key, category, display_name) VALUES
  ('promos.view',   'promos', 'ดูโปรโมชัน'),
  ('promos.manage', 'promos', 'จัดการโปรโมชัน')
ON CONFLICT (permission_key) DO NOTHING;

-- super_admin ได้ทุก permission
INSERT INTO admin_role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM admin_roles r JOIN admin_permissions p ON true
WHERE r.name = 'super_admin' AND p.permission_key IN ('promos.view', 'promos.manage')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- accounting เดิมมี promos.view
INSERT INTO admin_role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM admin_roles r JOIN admin_permissions p ON true
WHERE r.name = 'accounting' AND p.permission_key = 'promos.view'
ON CONFLICT (role_id, permission_id) DO NOTHING;

DELETE FROM admin_permissions
  WHERE permission_key IN ('campaigns.view', 'campaigns.manage', 'salesreps.view', 'salesreps.manage');
