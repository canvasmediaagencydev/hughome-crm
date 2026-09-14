-- rollback 022_notification_log_reconcile.sql
-- ⚠️ ประวัติว่าส่ง LINE เตือนใครไปแล้วหาย → cron เตือนหมดอายุจะส่งซ้ำให้ lot เดิมได้
DROP FUNCTION IF EXISTS reconcile_balances();
DROP TABLE IF EXISTS balance_reconcile_log;
DROP TABLE IF EXISTS notification_log;
