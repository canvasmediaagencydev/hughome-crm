-- 018_permissions_campaigns_salesreps.sql — MIGRATION_PLAN.md §7
-- promos.* → campaigns.* (โปรโมชันไม่ใช่โค้ดแล้ว เป็นแคมเปญช่วงวันที่)
-- + salesreps.* สำหรับจัดการรายชื่อพนักงานขายที่ป้อน dropdown ในไฟล์ Excel
-- Idempotent (ON CONFLICT DO NOTHING) รันซ้ำได้
-- permission รวม: 27 − 2 (promos) + 4 = 29

INSERT INTO admin_permissions (permission_key, category, display_name) VALUES
  ('campaigns.view',   'campaigns', 'ดูแคมเปญแต้ม'),
  ('campaigns.manage', 'campaigns', 'จัดการแคมเปญแต้ม'),
  ('salesreps.view',   'salesreps', 'ดูพนักงานขาย'),
  ('salesreps.manage', 'salesreps', 'จัดการพนักงานขาย')
ON CONFLICT (permission_key) DO NOTHING;

-- super_admin: ทุก permission (belt-and-suspenders; code ก็ bypass อยู่แล้ว)
INSERT INTO admin_role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM admin_roles r JOIN admin_permissions p ON true
WHERE r.name = 'super_admin'
  AND p.permission_key IN ('campaigns.view', 'campaigns.manage', 'salesreps.view', 'salesreps.manage')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- manager: ดูได้เท่านั้น — ตอนสุ่มตรวจต้องรู้ว่าแถวนั้นได้ตัวคูณจาก campaign ไหน
-- และพนักงานขายชื่ออะไร แต่ไม่ควรแก้ตัวคูณเองได้ (แยกคนตั้งกฎออกจากคนตรวจ)
INSERT INTO admin_role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM admin_roles r JOIN admin_permissions p ON true
WHERE r.name = 'manager'
  AND p.permission_key IN ('campaigns.view', 'salesreps.view')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- accounting: ดูแคมเปญ (ตรวจ preview) + จัดการรายชื่อพนักงานขาย
-- (บัญชีเป็นคนออก template ให้พนักงาน จึงต้องเพิ่ม/ปิดรายชื่อได้เอง)
-- แต่ตั้งตัวคูณแคมเปญไม่ได้ — คนคีย์ยอดต้องไม่ใช่คนตั้งตัวคูณ
INSERT INTO admin_role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM admin_roles r JOIN admin_permissions p ON true
WHERE r.name = 'accounting'
  AND p.permission_key IN ('campaigns.view', 'salesreps.view', 'salesreps.manage')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ลบ promos.* — ไม่มีระบบ promo code อีกแล้ว
-- mapping ใน admin_role_permissions หายตาม ON DELETE CASCADE ของ permission_id
DELETE FROM admin_permissions WHERE permission_key IN ('promos.view', 'promos.manage');
