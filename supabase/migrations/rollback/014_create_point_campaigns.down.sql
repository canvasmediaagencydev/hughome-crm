-- rollback 014_create_point_campaigns.sql
-- ต้องถอย 015 ก่อน (point_batch_ledger.campaign_id อ้าง point_campaigns อยู่)
DROP TABLE IF EXISTS point_campaigns;
