-- rollback 010_rpc_points_functions.sql
DROP FUNCTION IF EXISTS adjust_points_manual(uuid, integer, uuid, text);
DROP FUNCTION IF EXISTS expire_ledger_batches(date);
DROP FUNCTION IF EXISTS redeem_reward(uuid, uuid, integer);
DROP FUNCTION IF EXISTS void_batch(uuid, uuid, text);
DROP FUNCTION IF EXISTS award_points_from_batch(uuid);
