-- rollback 019_batch_committed_by.sql
-- ต้องถอย 020 ก่อน (RPC v3 เขียนคอลัมน์นี้อยู่)
DROP INDEX IF EXISTS point_batches_committed_by_idx;
ALTER TABLE point_batches DROP CONSTRAINT IF EXISTS point_batches_commit_actor;
ALTER TABLE point_batches DROP COLUMN IF EXISTS committed_by;
