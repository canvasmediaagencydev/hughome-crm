-- Database Performance Optimization - Indexes for Hughome CRM
-- This script creates indexes to optimize the most common queries

-- 1. Primary lookup index for user authentication (most critical)
-- This index should already exist, but let's ensure it's optimized
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_profiles_line_user_id 
ON user_profiles (line_user_id) 
WHERE line_user_id IS NOT NULL;

-- 2. Composite index for user profile queries with role filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_profiles_line_role 
ON user_profiles (line_user_id, role) 
WHERE line_user_id IS NOT NULL;

-- 3. Index for onboarding status checks (performance critical for middleware)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_profiles_onboarding_fields 
ON user_profiles (line_user_id, role, first_name, last_name, phone) 
WHERE role IS NOT NULL AND first_name IS NOT NULL AND last_name IS NOT NULL AND phone IS NOT NULL;

-- 4. Index for admin queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_profiles_admin 
ON user_profiles (is_admin, created_at DESC) 
WHERE is_admin = true;

-- 5. Index for last login tracking and analytics
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_profiles_last_login 
ON user_profiles (last_login_at DESC NULLS LAST) 
WHERE last_login_at IS NOT NULL;

-- 6. Points and engagement indexes for dashboard queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_profiles_points_balance 
ON user_profiles (points_balance DESC) 
WHERE points_balance > 0;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_profiles_total_points 
ON user_profiles (total_points_earned DESC) 
WHERE total_points_earned > 0;

-- 7. Index for user creation date queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_profiles_created_at 
ON user_profiles (created_at DESC);

-- 8. Partial index for active users (users who have logged in)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_profiles_active_users 
ON user_profiles (line_user_id, last_login_at DESC, role) 
WHERE last_login_at IS NOT NULL;

-- 9. Receipts table optimizations (if exists)
-- Assuming receipts table structure from the architecture
DO $$ 
BEGIN 
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'receipts') THEN
        -- Index for receipt ownership queries
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_receipts_user_status 
        ON receipts (user_id, status, created_at DESC);
        
        -- Index for receipt approval workflow
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_receipts_approval_status 
        ON receipts (status, created_at DESC) 
        WHERE status IN ('pending', 'approved', 'rejected');
        
        -- Index for OCR processing status
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_receipts_ocr_status 
        ON receipts (ocr_status, created_at DESC) 
        WHERE ocr_status IS NOT NULL;
    END IF;
END $$;

-- 10. Point transactions optimization (if exists)
DO $$ 
BEGIN 
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'point_transactions') THEN
        -- Index for user point history
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_point_transactions_user_date 
        ON point_transactions (user_id, created_at DESC);
        
        -- Index for transaction type analytics
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_point_transactions_type_date 
        ON point_transactions (transaction_type, created_at DESC);
    END IF;
END $$;

-- 11. Rewards table optimization (if exists)
DO $$ 
BEGIN 
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'rewards') THEN
        -- Index for active rewards catalog
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_rewards_active 
        ON rewards (is_active, points_cost ASC) 
        WHERE is_active = true;
        
        -- Index for reward availability
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_rewards_availability 
        ON rewards (is_active, quantity_available DESC, points_cost ASC) 
        WHERE is_active = true AND quantity_available > 0;
    END IF;
END $$;

-- 12. Performance monitoring and statistics
-- Enable query statistics collection for performance monitoring
ALTER SYSTEM SET shared_preload_libraries = 'pg_stat_statements';
-- Note: This requires a PostgreSQL restart to take effect

-- 13. Update table statistics for better query planning
ANALYZE user_profiles;

-- Check if other tables exist and analyze them
DO $$ 
BEGIN 
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'receipts') THEN
        ANALYZE receipts;
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'point_transactions') THEN
        ANALYZE point_transactions;
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'rewards') THEN
        ANALYZE rewards;
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'redemptions') THEN
        ANALYZE redemptions;
    END IF;
END $$;

-- 14. Connection pooling settings (if running with elevated privileges)
-- These settings should be configured at the PostgreSQL server level
/*
ALTER SYSTEM SET max_connections = '100';
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '1GB';
ALTER SYSTEM SET maintenance_work_mem = '64MB';
ALTER SYSTEM SET checkpoint_completion_target = 0.9;
ALTER SYSTEM SET wal_buffers = '16MB';
ALTER SYSTEM SET default_statistics_target = 100;
*/

-- 15. Create a performance monitoring view
CREATE OR REPLACE VIEW performance_stats AS
SELECT 
    schemaname,
    tablename,
    attname,
    inherited,
    null_frac,
    avg_width,
    n_distinct,
    most_common_vals,
    most_common_freqs,
    histogram_bounds
FROM pg_stats 
WHERE schemaname = 'public'
AND tablename IN ('user_profiles', 'receipts', 'point_transactions', 'rewards', 'redemptions')
ORDER BY tablename, attname;

-- 16. Performance monitoring function for cache hit ratios
CREATE OR REPLACE FUNCTION get_cache_hit_ratio() 
RETURNS TABLE(
    database_name text,
    cache_hit_ratio numeric,
    buffer_cache_hit_ratio numeric
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        current_database()::text as database_name,
        ROUND(
            (sum(heap_blks_hit) * 100.0 / NULLIF(sum(heap_blks_hit + heap_blks_read), 0))::numeric, 
            2
        ) as cache_hit_ratio,
        ROUND(
            (sum(heap_blks_hit) * 100.0 / NULLIF(sum(heap_blks_hit + heap_blks_read), 0))::numeric, 
            2
        ) as buffer_cache_hit_ratio
    FROM pg_statio_user_tables;
END;
$$ LANGUAGE plpgsql;

-- Note: To apply these indexes in production:
-- 1. Run during low-traffic periods
-- 2. Monitor index creation progress with: SELECT * FROM pg_stat_progress_create_index;
-- 3. CONCURRENTLY option prevents blocking, but takes longer
-- 4. Test query performance before and after with EXPLAIN ANALYZE

COMMENT ON INDEX idx_user_profiles_line_user_id IS 'Critical index for user authentication lookups - primary performance bottleneck';
COMMENT ON INDEX idx_user_profiles_onboarding_fields IS 'Optimizes middleware onboarding status checks';
COMMENT ON FUNCTION get_cache_hit_ratio IS 'Monitors database cache performance - aim for >95% hit ratio';