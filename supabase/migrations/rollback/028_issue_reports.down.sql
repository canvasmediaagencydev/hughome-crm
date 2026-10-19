-- rollback 028_issue_reports.sql
-- ⚠️ ลบรายการแจ้งปัญหาทั้งหมด — export ก่อนถ้ายังต้องใช้
-- mapping ใน admin_role_permissions หายตาม ON DELETE CASCADE ของ permission_id
-- แถว notification_channels ที่ติ๊ก 'issue.reported' ไว้ไม่ถูกแก้ (event ที่ไม่มีใครยิงก็แค่ไม่เคยถูกส่ง)

DROP TABLE IF EXISTS issue_reports;
DELETE FROM admin_permissions WHERE permission_key IN ('issues.report', 'issues.manage');
