-- 012_seed_permissions_roles.sql — MIGRATION_PLAN.md §7
-- Permissions + 6 system roles for the new batch/points model.
-- (No OCR/scan permissions — that flow is removed in the new system, §7.)
-- Idempotent (ON CONFLICT DO NOTHING) so it can be re-run safely.

-- --- Permissions -----------------------------------------------------------
INSERT INTO admin_permissions (permission_key, category, display_name) VALUES
  ('dashboard.view',       'dashboard',     'ดูแดชบอร์ด'),
  ('users.view',           'users',         'ดูผู้ใช้'),
  ('users.edit',           'users',         'แก้ไขผู้ใช้'),
  ('users.manage_points',  'users',         'จัดการแต้มผู้ใช้'),
  ('users.manage_notes',   'users',         'จัดการโน้ตผู้ใช้'),
  ('users.manage_tags',    'users',         'จัดการแท็กผู้ใช้'),
  ('tags.view',            'tags',          'ดูแท็ก'),
  ('tags.manage',          'tags',          'จัดการแท็ก'),
  ('rewards.view',         'rewards',       'ดูรางวัล'),
  ('rewards.create',       'rewards',       'สร้างรางวัล'),
  ('rewards.edit',         'rewards',       'แก้ไขรางวัล'),
  ('rewards.delete',       'rewards',       'ลบรางวัล'),
  ('redemptions.view',     'redemptions',   'ดูคำขอแลก'),
  ('redemptions.process',  'redemptions',   'ดำเนินการคำขอแลก'),
  ('redemptions.deliver',  'redemptions',   'ส่งมอบของรางวัล'),
  ('batches.view',         'batches',       'ดู batch'),
  ('batches.upload',       'batches',       'อัปโหลด batch'),
  ('batches.commit',       'batches',       'commit batch'),
  ('batches.review',       'batches',       'สุ่มตรวจ batch'),
  ('batches.void',         'batches',       'ยกเลิก batch'),
  ('promos.view',          'promos',        'ดูโปรโมชัน'),
  ('promos.manage',        'promos',        'จัดการโปรโมชัน'),
  ('notifications.manage', 'notifications', 'จัดการการแจ้งเตือน'),
  ('reports.view',         'reports',       'ดูรายงาน'),
  ('settings.edit',        'settings',      'แก้ไขการตั้งค่า'),
  ('admins.manage',        'admins',        'จัดการแอดมิน'),
  ('sales.entry',          'sales',         'คีย์ยอดขาย')
ON CONFLICT (permission_key) DO NOTHING;

-- --- Roles (all is_system so they can't be deleted via UI) -----------------
INSERT INTO admin_roles (name, display_name, is_system, description) VALUES
  ('super_admin',      'Super Admin',      true, 'สิทธิ์ทั้งหมด (bypass ใน admin-auth.ts)'),
  ('manager',          'ผู้จัดการ',          true, 'ดูภาพรวม สุ่มตรวจ/ยกเลิก batch จัดการคำขอแลก'),
  ('accounting',       'บัญชี',              true, 'อัปโหลดและ commit batch'),
  ('sales_staff',      'พนักงานขาย',         true, 'คีย์ยอดขาย'),
  ('reward_manager',   'Reward Manager',   true, 'จัดการรางวัลและการแลก'),
  ('customer_support', 'Customer Support', true, 'ดูแลผู้ใช้และคำขอแลก')
ON CONFLICT (name) DO NOTHING;

-- --- Role → permission mappings --------------------------------------------
-- super_admin: every permission (belt-and-suspenders; code also bypasses).
INSERT INTO admin_role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM admin_roles r CROSS JOIN admin_permissions p
WHERE r.name = 'super_admin'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- manager
INSERT INTO admin_role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM admin_roles r JOIN admin_permissions p ON true
WHERE r.name = 'manager' AND p.permission_key IN (
  'dashboard.view', 'reports.view',
  'batches.view', 'batches.review', 'batches.void',
  'redemptions.view', 'redemptions.process', 'redemptions.deliver',
  'users.view'
) ON CONFLICT (role_id, permission_id) DO NOTHING;

-- accounting
INSERT INTO admin_role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM admin_roles r JOIN admin_permissions p ON true
WHERE r.name = 'accounting' AND p.permission_key IN (
  'batches.view', 'batches.upload', 'batches.commit',
  'promos.view', 'users.view'
) ON CONFLICT (role_id, permission_id) DO NOTHING;

-- sales_staff
INSERT INTO admin_role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM admin_roles r JOIN admin_permissions p ON true
WHERE r.name = 'sales_staff' AND p.permission_key IN (
  'sales.entry', 'users.view'
) ON CONFLICT (role_id, permission_id) DO NOTHING;

-- reward_manager
INSERT INTO admin_role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM admin_roles r JOIN admin_permissions p ON true
WHERE r.name = 'reward_manager' AND p.permission_key IN (
  'rewards.view', 'rewards.create', 'rewards.edit', 'rewards.delete',
  'redemptions.view', 'redemptions.process', 'redemptions.deliver'
) ON CONFLICT (role_id, permission_id) DO NOTHING;

-- customer_support
INSERT INTO admin_role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM admin_roles r JOIN admin_permissions p ON true
WHERE r.name = 'customer_support' AND p.permission_key IN (
  'users.view', 'users.edit', 'users.manage_notes', 'redemptions.view'
) ON CONFLICT (role_id, permission_id) DO NOTHING;
