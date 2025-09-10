-- Hughome CRM Database Performance Optimizations
-- Run these commands in Supabase SQL Editor one by one (not as a transaction)

-- 1. Create index for line_user_id lookups (most frequent query)
-- This fixes the "CREATE INDEX CONCURRENTLY cannot run inside a transaction block" error
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_profiles_line_user_id 
ON user_profiles(line_user_id);

-- 2. Create composite index for onboarding status checks
-- This optimizes the middleware authentication queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_profiles_onboarding_status 
ON user_profiles(line_user_id, role, first_name, last_name, phone) 
WHERE role IS NOT NULL AND first_name IS NOT NULL AND last_name IS NOT NULL AND phone IS NOT NULL;

-- 3. Create index for admin users (faster admin checks)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_profiles_admin 
ON user_profiles(line_user_id) 
WHERE is_admin = true;

-- 4. Create index for last_login_at (for analytics and cleanup)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_profiles_last_login 
ON user_profiles(last_login_at DESC);

-- 5. Create index for points balance queries (dashboard performance)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_profiles_points 
ON user_profiles(line_user_id, points_balance);

-- 6. Optimize point_transactions table for user point history
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_point_transactions_user_date 
ON point_transactions(user_id, created_at DESC);

-- 7. Create index for receipt queries by user
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_receipts_user_status 
ON receipts(user_id, status, created_at DESC);

-- 8. Create index for redemption queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_redemptions_user_status 
ON redemptions(user_id, status, created_at DESC);

-- 9. Add database statistics update (run after indexes are created)
-- This helps PostgreSQL query planner choose optimal execution plans
ANALYZE user_profiles;
ANALYZE point_transactions;
ANALYZE receipts;
ANALYZE redemptions;

-- 10. Optional: Create materialized view for user dashboard data (advanced optimization)
-- This can significantly speed up dashboard queries
CREATE MATERIALIZED VIEW IF NOT EXISTS user_dashboard AS
SELECT 
    up.id,
    up.line_user_id,
    up.display_name,
    up.picture_url,
    up.first_name,
    up.last_name,
    up.phone,
    up.role,
    up.points_balance,
    up.is_admin,
    up.last_login_at,
    CASE 
        WHEN up.role IS NOT NULL 
        AND up.first_name IS NOT NULL 
        AND up.last_name IS NOT NULL 
        AND up.phone IS NOT NULL 
        THEN true 
        ELSE false 
    END as is_onboarded,
    COALESCE(pt.total_earned, 0) as total_points_earned,
    COALESCE(r.total_receipts, 0) as total_receipts
FROM user_profiles up
LEFT JOIN (
    SELECT user_id, SUM(points) as total_earned
    FROM point_transactions 
    WHERE type = 'earned'
    GROUP BY user_id
) pt ON up.id = pt.user_id
LEFT JOIN (
    SELECT user_id, COUNT(*) as total_receipts
    FROM receipts 
    WHERE status = 'approved'
    GROUP BY user_id
) r ON up.id = r.user_id;

-- Create index on the materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_dashboard_line_user_id 
ON user_dashboard(line_user_id);

-- 11. Create function to refresh materialized view efficiently
CREATE OR REPLACE FUNCTION refresh_user_dashboard()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY user_dashboard;
END;
$$ LANGUAGE plpgsql;

-- 12. Set up automatic refresh every 5 minutes (optional)
-- Note: This requires pg_cron extension to be enabled in Supabase
-- SELECT cron.schedule('refresh-user-dashboard', '*/5 * * * *', 'SELECT refresh_user_dashboard();');

-- Performance Monitoring Queries (for checking optimization results)
-- Run these after creating indexes to verify performance improvements

-- Check index usage
-- SELECT schemaname, tablename, indexname, idx_tup_read, idx_tup_fetch 
-- FROM pg_stat_user_indexes 
-- WHERE schemaname = 'public' 
-- ORDER BY idx_tup_read DESC;

-- Check slow queries
-- SELECT query, mean_exec_time, calls, total_exec_time
-- FROM pg_stat_statements 
-- WHERE query LIKE '%user_profiles%'
-- ORDER BY mean_exec_time DESC
-- LIMIT 10;

-- Verify table statistics
-- SELECT schemaname, tablename, n_tup_ins, n_tup_upd, n_tup_del, n_live_tup
-- FROM pg_stat_user_tables 
-- WHERE schemaname = 'public';