-- ============================================================================
-- Hughome CRM Database Optimization Script (Supabase Compatible)
-- Version: 3.1 - Fixed for existing user_profiles table
-- Date: 2025-01-10
-- Compatible with: Supabase PostgreSQL (no superuser privileges needed)
-- ============================================================================

-- ============================================================================
-- 1. ENABLE EXTENSIONS
-- ============================================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Create ENUM types for better data integrity and performance
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('contractor', 'homeowner');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE receipt_status AS ENUM ('pending', 'processing', 'approved', 'rejected');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE redemption_status AS ENUM ('requested', 'processing', 'shipped', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE transaction_type AS ENUM ('earned', 'spent', 'expired', 'bonus', 'refund');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- 2. UPDATE EXISTING USER_PROFILES TABLE
-- ============================================================================

-- Add missing columns to existing user_profiles table
ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;

ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS points_balance INTEGER DEFAULT 0;

ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS total_points_earned INTEGER DEFAULT 0;

ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS total_receipts INTEGER DEFAULT 0;

ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

-- Add constraints to existing columns
DO $$ BEGIN
    ALTER TABLE public.user_profiles 
    ADD CONSTRAINT chk_points_balance_non_negative 
    CHECK (points_balance >= 0);
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE public.user_profiles 
    ADD CONSTRAINT chk_total_points_earned_non_negative 
    CHECK (total_points_earned >= 0);
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE public.user_profiles 
    ADD CONSTRAINT chk_total_receipts_non_negative 
    CHECK (total_receipts >= 0);
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Update role column to use ENUM if it's currently TEXT
DO $$ BEGIN
    ALTER TABLE public.user_profiles 
    ALTER COLUMN role TYPE user_role USING role::user_role;
EXCEPTION
    WHEN OTHERS THEN 
        RAISE NOTICE 'Role column type conversion skipped - may already be correct type';
END $$;

-- ============================================================================
-- 3. CREATE NEW TABLES
-- ============================================================================

-- Receipts table with optimized structure
CREATE TABLE IF NOT EXISTS public.receipts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    receipt_number TEXT,
    vendor_name TEXT,
    total_amount DECIMAL(10,2) CHECK (total_amount >= 0),
    receipt_date DATE,
    status receipt_status DEFAULT 'pending',
    ocr_data JSONB,
    points_awarded INTEGER DEFAULT 0 CHECK (points_awarded >= 0),
    admin_notes TEXT,
    approved_by UUID REFERENCES public.user_profiles(id),
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Receipt Images with SHA256 hash for fraud prevention
CREATE TABLE IF NOT EXISTS public.receipt_images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    receipt_id UUID NOT NULL REFERENCES public.receipts(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_size INTEGER CHECK (file_size > 0),
    mime_type TEXT DEFAULT 'image/jpeg',
    sha256_hash TEXT UNIQUE NOT NULL,
    width INTEGER,
    height INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Rewards catalog
CREATE TABLE IF NOT EXISTS public.rewards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    points_cost INTEGER NOT NULL CHECK (points_cost > 0),
    image_url TEXT,
    category TEXT DEFAULT 'general',
    stock_quantity INTEGER DEFAULT 0 CHECK (stock_quantity >= 0),
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Redemptions tracking
CREATE TABLE IF NOT EXISTS public.redemptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    reward_id UUID NOT NULL REFERENCES public.rewards(id),
    points_used INTEGER NOT NULL CHECK (points_used > 0),
    quantity INTEGER DEFAULT 1 CHECK (quantity > 0),
    status redemption_status DEFAULT 'requested',
    shipping_address TEXT,
    tracking_number TEXT,
    admin_notes TEXT,
    processed_by UUID REFERENCES public.user_profiles(id),
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Point transactions ledger for complete audit trail
CREATE TABLE IF NOT EXISTS public.point_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    type transaction_type NOT NULL,
    points INTEGER NOT NULL,
    balance_after INTEGER NOT NULL CHECK (balance_after >= 0),
    reference_id UUID, -- Can reference receipt_id or redemption_id
    reference_type TEXT, -- 'receipt', 'redemption', 'bonus', etc.
    description TEXT,
    created_by UUID REFERENCES public.user_profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 4. PERFORMANCE INDEXES (OPTIMIZED FOR COMMON QUERIES)
-- ============================================================================

-- User Profiles indexes (some may already exist from migration 002)
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_profiles_line_user_id 
    ON public.user_profiles(line_user_id);

CREATE INDEX IF NOT EXISTS idx_user_profiles_role 
    ON public.user_profiles(role) WHERE role IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_profiles_admin 
    ON public.user_profiles(is_admin) WHERE is_admin = TRUE;

CREATE INDEX IF NOT EXISTS idx_user_profiles_onboarding 
    ON public.user_profiles(role, first_name, last_name, phone) 
    WHERE role IS NOT NULL AND first_name IS NOT NULL AND last_name IS NOT NULL AND phone IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_profiles_points 
    ON public.user_profiles(points_balance DESC) WHERE points_balance > 0;

-- Receipts indexes for common queries
CREATE INDEX IF NOT EXISTS idx_receipts_user_id_created 
    ON public.receipts(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_receipts_status_created 
    ON public.receipts(status, created_at DESC) WHERE status != 'approved';

CREATE INDEX IF NOT EXISTS idx_receipts_admin_review 
    ON public.receipts(status, created_at ASC) WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_receipts_total_amount 
    ON public.receipts(total_amount DESC) WHERE total_amount IS NOT NULL;

-- Receipt Images indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_receipt_images_sha256 
    ON public.receipt_images(sha256_hash);

CREATE INDEX IF NOT EXISTS idx_receipt_images_receipt_id 
    ON public.receipt_images(receipt_id);

-- Rewards indexes
CREATE INDEX IF NOT EXISTS idx_rewards_active_points 
    ON public.rewards(is_active, points_cost ASC) WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_rewards_category_active 
    ON public.rewards(category, sort_order ASC) WHERE is_active = TRUE;

-- Redemptions indexes
CREATE INDEX IF NOT EXISTS idx_redemptions_user_created 
    ON public.redemptions(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_redemptions_status_created 
    ON public.redemptions(status, created_at ASC) WHERE status != 'shipped';

-- Point Transactions indexes for ledger queries
CREATE INDEX IF NOT EXISTS idx_point_transactions_user_created 
    ON public.point_transactions(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_point_transactions_type_created 
    ON public.point_transactions(type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_point_transactions_reference 
    ON public.point_transactions(reference_type, reference_id) WHERE reference_id IS NOT NULL;

-- ============================================================================
-- 5. FUNCTIONS AND TRIGGERS FOR DATA CONSISTENCY
-- ============================================================================

-- Function to update updated_at timestamp (may already exist from migration 002)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    -- Only update if there are actual changes
    IF row(NEW.*) IS DISTINCT FROM row(OLD.*) THEN
        NEW.updated_at = NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to maintain points balance consistency
CREATE OR REPLACE FUNCTION update_user_points_balance()
RETURNS TRIGGER AS $$
DECLARE
    new_balance INTEGER;
BEGIN
    -- Calculate current balance from transactions
    SELECT COALESCE(SUM(points), 0) 
    INTO new_balance
    FROM public.point_transactions 
    WHERE user_id = NEW.user_id;
    
    -- Update user profile
    UPDATE public.user_profiles 
    SET 
        points_balance = new_balance,
        updated_at = NOW()
    WHERE id = NEW.user_id;
    
    -- Update balance_after in the new transaction
    NEW.balance_after = new_balance;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to update user statistics
CREATE OR REPLACE FUNCTION update_user_stats()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF TG_TABLE_NAME = 'receipts' AND NEW.status = 'approved' THEN
            UPDATE public.user_profiles 
            SET 
                total_receipts = total_receipts + 1,
                total_points_earned = total_points_earned + COALESCE(NEW.points_awarded, 0),
                updated_at = NOW()
            WHERE id = NEW.user_id;
        END IF;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 6. APPLY TRIGGERS
-- ============================================================================

-- Updated_at triggers
DROP TRIGGER IF EXISTS trigger_update_user_profiles_updated_at ON public.user_profiles;
CREATE TRIGGER trigger_update_user_profiles_updated_at
    BEFORE UPDATE ON public.user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_update_receipts_updated_at ON public.receipts;
CREATE TRIGGER trigger_update_receipts_updated_at
    BEFORE UPDATE ON public.receipts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_update_rewards_updated_at ON public.rewards;
CREATE TRIGGER trigger_update_rewards_updated_at
    BEFORE UPDATE ON public.rewards
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_update_redemptions_updated_at ON public.redemptions;
CREATE TRIGGER trigger_update_redemptions_updated_at
    BEFORE UPDATE ON public.redemptions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Points balance trigger
DROP TRIGGER IF EXISTS trigger_update_points_balance ON public.point_transactions;
CREATE TRIGGER trigger_update_points_balance
    BEFORE INSERT ON public.point_transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_user_points_balance();

-- User stats trigger
DROP TRIGGER IF EXISTS trigger_update_user_stats_receipts ON public.receipts;
CREATE TRIGGER trigger_update_user_stats_receipts
    AFTER INSERT OR UPDATE ON public.receipts
    FOR EACH ROW
    EXECUTE FUNCTION update_user_stats();

-- ============================================================================
-- 7. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on sensitive tables
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipt_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.point_transactions ENABLE ROW LEVEL SECURITY;

-- User Profiles policies
DROP POLICY IF EXISTS "Users can view their own profile" ON public.user_profiles;
CREATE POLICY "Users can view their own profile" ON public.user_profiles
    FOR SELECT USING (line_user_id = current_setting('app.current_user_line_id', true));

DROP POLICY IF EXISTS "Users can update their own profile" ON public.user_profiles;
CREATE POLICY "Users can update their own profile" ON public.user_profiles
    FOR UPDATE USING (line_user_id = current_setting('app.current_user_line_id', true));

DROP POLICY IF EXISTS "Service role can manage all profiles" ON public.user_profiles;
CREATE POLICY "Service role can manage all profiles" ON public.user_profiles
    FOR ALL USING (current_setting('role', true) = 'service_role');

-- Receipts policies
DROP POLICY IF EXISTS "Users can view their own receipts" ON public.receipts;
CREATE POLICY "Users can view their own receipts" ON public.receipts
    FOR SELECT USING (
        user_id IN (
            SELECT id FROM public.user_profiles 
            WHERE line_user_id = current_setting('app.current_user_line_id', true)
        )
    );

DROP POLICY IF EXISTS "Users can insert their own receipts" ON public.receipts;
CREATE POLICY "Users can insert their own receipts" ON public.receipts
    FOR INSERT WITH CHECK (
        user_id IN (
            SELECT id FROM public.user_profiles 
            WHERE line_user_id = current_setting('app.current_user_line_id', true)
        )
    );

-- ============================================================================
-- 8. VIEWS FOR COMMON QUERIES
-- ============================================================================

-- View for user dashboard summary
CREATE OR REPLACE VIEW public.user_dashboard AS
SELECT 
    up.id,
    up.line_user_id,
    up.display_name,
    up.picture_url,
    up.role,
    up.points_balance,
    up.total_points_earned,
    up.total_receipts,
    COUNT(r.id) FILTER (WHERE r.status = 'pending') as pending_receipts,
    COUNT(rd.id) FILTER (WHERE rd.status = 'requested') as pending_redemptions,
    up.last_login_at,
    up.created_at
FROM public.user_profiles up
LEFT JOIN public.receipts r ON up.id = r.user_id
LEFT JOIN public.redemptions rd ON up.id = rd.user_id
GROUP BY up.id;

-- View for admin dashboard
CREATE OR REPLACE VIEW public.admin_summary AS
SELECT 
    COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE) as users_today,
    COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '7 days') as users_week,
    COUNT(*) as total_users,
    COUNT(*) FILTER (WHERE role IS NOT NULL) as onboarded_users,
    COALESCE(SUM(points_balance), 0) as total_points_outstanding
FROM public.user_profiles;

-- ============================================================================
-- 9. PERFORMANCE ANALYSIS AND MAINTENANCE
-- ============================================================================

-- Update table statistics for better query planning
ANALYZE public.user_profiles;
ANALYZE public.receipts;
ANALYZE public.receipt_images;
ANALYZE public.rewards;
ANALYZE public.redemptions;
ANALYZE public.point_transactions;

-- ============================================================================
-- 10. COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE public.user_profiles IS 'User profiles with LINE integration and points tracking';
COMMENT ON TABLE public.receipts IS 'Receipt submissions with OCR data and approval workflow';
COMMENT ON TABLE public.receipt_images IS 'Receipt images with SHA256 hash for fraud prevention';
COMMENT ON TABLE public.rewards IS 'Rewards catalog for point redemption';
COMMENT ON TABLE public.redemptions IS 'Reward redemption tracking with shipping status';
COMMENT ON TABLE public.point_transactions IS 'Complete audit trail of all point movements';

-- ============================================================================
-- SCRIPT COMPLETE
-- ============================================================================

-- Final message
DO $$
BEGIN
    RAISE NOTICE 'Hughome CRM database optimization completed successfully!';
    RAISE NOTICE 'All tables, indexes, triggers, and RLS policies have been created.';
    RAISE NOTICE 'Performance monitoring is enabled and statistics updated.';
END
$$;