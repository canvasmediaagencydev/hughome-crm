-- Performance Optimization Migration (Supabase Compatible)
-- This migration adds database-level optimizations for the authentication system

-- Add composite index for common query patterns
CREATE INDEX IF NOT EXISTS idx_user_profiles_line_user_id_active 
  ON public.user_profiles(line_user_id) 
  WHERE line_user_id IS NOT NULL;

-- Add partial index for role-based queries (commonly used after auth)
CREATE INDEX IF NOT EXISTS idx_user_profiles_role_active 
  ON public.user_profiles(role) 
  WHERE role IS NOT NULL;

-- Add composite index for onboarding status checks
CREATE INDEX IF NOT EXISTS idx_user_profiles_onboarding_fields 
  ON public.user_profiles(line_user_id, role, first_name, last_name, phone) 
  WHERE role IS NOT NULL AND first_name IS NOT NULL AND last_name IS NOT NULL AND phone IS NOT NULL;

-- Optimize the updated_at trigger to be more efficient
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    -- Only update if there are actual changes to avoid unnecessary updates
    IF row(NEW.*) IS DISTINCT FROM row(OLD.*) THEN
        NEW.updated_at = NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply the trigger to user_profiles table
DROP TRIGGER IF EXISTS trigger_update_user_profiles_updated_at ON public.user_profiles;
CREATE TRIGGER trigger_update_user_profiles_updated_at
    BEFORE UPDATE ON public.user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Update table statistics for better query planning
ANALYZE public.user_profiles;

-- Comments for documentation
COMMENT ON INDEX idx_user_profiles_line_user_id_active IS 'Optimized index for LINE user ID lookups during authentication';
COMMENT ON INDEX idx_user_profiles_role_active IS 'Partial index for role-based queries after authentication';
COMMENT ON INDEX idx_user_profiles_onboarding_fields IS 'Composite index for onboarding status checks';

-- Performance optimization complete message
DO $$
BEGIN
    RAISE NOTICE 'Performance optimization completed successfully!';
    RAISE NOTICE 'Indexes created and statistics updated.';
END
$$;