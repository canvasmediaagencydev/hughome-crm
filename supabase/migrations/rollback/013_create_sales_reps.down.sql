-- rollback 013_create_sales_reps.sql
-- ต้องถอย 015 ก่อน (point_batch_ledger.sales_rep_id อ้าง sales_reps อยู่)
DROP TABLE IF EXISTS sales_reps;
