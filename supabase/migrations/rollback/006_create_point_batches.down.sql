-- rollback 006_create_point_batches.sql
ALTER TABLE point_transactions DROP CONSTRAINT IF EXISTS point_transactions_source_batch_id_fkey;
DROP TABLE IF EXISTS point_batches;
