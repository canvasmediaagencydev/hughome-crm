-- ═══════════════════════════════════════════════════════════════════════════
-- _apply_026_026.sql — HugHome CRM · migration 026–026 เท่านั้น (incremental)
-- สร้างอัตโนมัติด้วย: node scripts/build-apply-all.js --from 026 --to 026
-- (อย่าแก้ไฟล์นี้มือ — แก้ที่ migration ต้นทางแล้วรัน generator ใหม่)
--
-- ⚠️ ใช้กับ DB ที่ apply migration ก่อน 026 ไปแล้วเท่านั้น
--    ถ้าเป็น DB ใหม่เปล่า ๆ ให้ใช้ _apply_all.sql แทน
-- ไม่มี INSERT tenant_code ในไฟล์นี้ (ตั้งไปแล้วตอน apply ชุดแรก)
-- วิธี apply: Supabase Dashboard → SQL Editor → New query → วางทั้งไฟล์ → Run
-- ═══════════════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════════════════
-- ▶ FILE: 026_email_channel_void_superadmin.sql
-- ═══════════════════════════════════════════════════════════════════════════
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


-- ═══════════════════════════════════════════════════════════════════════════
-- ▶ VERIFICATION — รันหลัง apply เพื่อเช็คว่าขึ้นครบ
-- ═══════════════════════════════════════════════════════════════════════════
-- SELECT count(*) FROM pg_tables WHERE schemaname='public';                    -- คาดหวัง 20
-- SELECT count(*) FROM pg_tables WHERE schemaname='public'
--   AND tablename IN ('receipts','receipt_images','promo_codes');         -- คาดหวัง 0
-- SELECT count(*) FROM pg_tables WHERE schemaname='public'
--   AND tablename IN ('sales_reps','point_campaigns','redemption_lots','notification_log','balance_reconcile_log');  -- คาดหวัง 5
-- SELECT count(*) FROM admin_permissions;                                 -- คาดหวัง 29
-- SELECT count(*) FROM admin_roles;                                       -- คาดหวัง 6
-- SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
--   WHERE n.nspname='public' AND p.proname IN ('award_points_from_batch','void_batch','redeem_reward','expire_ledger_batches','adjust_points_manual','cancel_redemption','reconcile_balances');  -- คาดหวัง 7
-- SELECT conname FROM pg_constraint WHERE conname='point_campaigns_no_overlap';  -- คาดหวัง 1 แถว
-- SELECT indexname FROM pg_indexes WHERE indexname='pbl_bill_no_active_idx';     -- คาดหวัง 1 แถว
-- SELECT pg_get_function_identity_arguments(p.oid) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
--   WHERE n.nspname='public' AND p.proname='award_points_from_batch';       -- คาดหวัง 'uuid, uuid' (1 แถว)
-- SELECT count(*) FROM information_schema.columns WHERE table_name='point_batches' AND column_name='committed_by';  -- คาดหวัง 1
