-- 028_issue_reports.sql — ปุ่ม "แจ้งปัญหาการใช้งาน" ในหลังบ้าน (เจ้าของโปรเจกต์ขอ 2026-10-19)
--
-- admin ทุกคนกดแจ้งปัญหา/bug ได้จากทุกหน้า → เข้ากล่องของผู้ดูแลระบบ (super_admin = บัญชี canvas)
-- ที่ /admin/issues · ผู้ดูแลเปลี่ยนสถานะ + เขียนบันทึกการแก้ · คนแจ้งเห็นสถานะรายการของตัวเอง
-- แจ้งทางอีเมลผ่าน notification_channels เดิม (event 'issue.reported' — ติ๊กที่ /admin/notifications)
--
-- ไม่แตะแต้ม/เงิน · เขียนผ่าน API route (service role) ได้ตามปกติ ไม่ต้องเป็น RPC

CREATE TABLE issue_reports (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reported_by  uuid NOT NULL REFERENCES admin_users(id) ON DELETE RESTRICT,
  category     text NOT NULL CHECK (category IN ('bug', 'question', 'request', 'other')),
  title        text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 120),
  description  text NOT NULL CHECK (char_length(btrim(description)) BETWEEN 1 AND 4000),
  -- หน้าที่กดแจ้ง (path + query) และเบราว์เซอร์ — ช่วยหาที่มาของ bug
  page_url     text CHECK (page_url IS NULL OR char_length(page_url) <= 500),
  user_agent   text CHECK (user_agent IS NULL OR char_length(user_agent) <= 500),
  status       text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'wont_fix')),
  admin_note   text CHECK (admin_note IS NULL OR char_length(admin_note) <= 4000),
  handled_by   uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  handled_at   timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX issue_reports_status_created_idx ON issue_reports (status, created_at DESC);
CREATE INDEX issue_reports_reported_by_idx    ON issue_reports (reported_by, created_at DESC);

-- เหมือนตารางอื่น: เปิด RLS ไม่มี policy → เข้าถึงได้เฉพาะ service role (API route)
ALTER TABLE issue_reports ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- permissions
--   issues.report — แจ้งปัญหา + ดูรายการที่ตัวเองแจ้ง → ทุก role
--   issues.manage — ดูทุกรายการ + เปลี่ยนสถานะ → super_admin เท่านั้น (ผู้ดูแลระบบ canvas)
-- ---------------------------------------------------------------------------
INSERT INTO admin_permissions (permission_key, category, display_name) VALUES
  ('issues.report', 'issues', 'แจ้งปัญหาการใช้งาน'),
  ('issues.manage', 'issues', 'จัดการรายการแจ้งปัญหา')
ON CONFLICT (permission_key) DO NOTHING;

INSERT INTO admin_role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM admin_roles r JOIN admin_permissions p ON true
WHERE p.permission_key = 'issues.report'
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO admin_role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM admin_roles r JOIN admin_permissions p ON true
WHERE r.name = 'super_admin' AND p.permission_key = 'issues.manage'
ON CONFLICT (role_id, permission_id) DO NOTHING;
