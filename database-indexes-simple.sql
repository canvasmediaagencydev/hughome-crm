-- Hughome CRM Database Indexes - Transaction Safe Version
-- Run these in Supabase SQL Editor (works in transaction mode)

-- 1. Create index for line_user_id lookups (most critical)
CREATE INDEX IF NOT EXISTS idx_user_profiles_line_user_id 
ON user_profiles(line_user_id);

-- 2. Create composite index for onboarding status checks
CREATE INDEX IF NOT EXISTS idx_user_profiles_onboarding_status 
ON user_profiles(line_user_id, role, first_name, last_name, phone);

-- 3. Create index for admin users
CREATE INDEX IF NOT EXISTS idx_user_profiles_admin 
ON user_profiles(line_user_id, is_admin);

-- 4. Create index for points balance queries
CREATE INDEX IF NOT EXISTS idx_user_profiles_points 
ON user_profiles(line_user_id, points_balance);

-- 5. Update table statistics for better query planning
ANALYZE user_profiles;